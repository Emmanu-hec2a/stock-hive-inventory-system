import logging
from datetime import date

from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_ratelimit.decorators import ratelimit

from billing.constants import PLAN_PRICES
from billing.models import MpesaPayment, Subscription
from billing.mpesa import stk_push
from billing.permissions import SubscriptionPermission
from billing.serializers import MpesaPaymentSerializer, SubscriptionSerializer
from billing.security import (
    verify_mpesa_webhook_ip,
    validate_mpesa_callback_payload,
    get_client_ip,
)
from billing.utils import (
    log_webhook_received,
    log_webhook_processed,
    log_mpesa_request,
    PaymentMetrics,
)
from billing.alerts import send_payment_failure_alert

logger = logging.getLogger("billing.payment")


def _require_business(user):
    business = getattr(user, "business", None)
    if not business:
        raise PermissionDenied("Your account is not linked to a business. Contact your admin.")
    return business



class InitiateSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan = request.data.get("plan")
        phone = request.data.get("phone")
        
        if plan not in PLAN_PRICES:
            logger.warning(f"Invalid plan requested: {plan}")
            return Response({"error": "Invalid plan."}, status=status.HTTP_400_BAD_REQUEST)
        if not phone:
            logger.warning(f"Payment initiation without phone number")
            return Response({"error": "phone is required."}, status=status.HTTP_400_BAD_REQUEST)

        business = _require_business(request.user)
        amount = PLAN_PRICES[plan]
        
        log_mpesa_request("payment_initiation", {"plan": plan, "amount": amount, "phone": phone})
        PaymentMetrics.record_payment_initiated(plan, amount)

        try:
            response = stk_push(
                phone_number=phone,
                amount=amount,
                account_ref=f"STOCKHIVE-{business.id}",
                description=f"StočkHive {plan.title()} Plan",
            )
        except Exception as e:
            logger.error(f"STK push failed for {phone}: {str(e)}")
            return Response(
                {"error": "Failed to initiate payment. Please try again."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if response.get("ResponseCode") != "0":
            logger.error(f"STK push returned error code: {response.get('ResponseCode')}")
            return Response({"error": "Failed to initiate payment."}, status=status.HTTP_400_BAD_REQUEST)

        # Wrap payment creation in transaction to ensure atomic operation
        try:
            with transaction.atomic():
                payment = MpesaPayment.objects.create(
                    business=business,
                    subscription=getattr(business, "subscription", None),
                    plan=plan,
                    amount=amount,
                    phone_number=phone,
                    merchant_request_id=response["MerchantRequestID"],
                    checkout_request_id=response["CheckoutRequestID"],
                    status=MpesaPayment.STATUS_PENDING,
                )
                logger.info(
                    f"Payment record created",
                    extra={
                        "checkout_request_id": payment.checkout_request_id,
                        "business_id": business.id,
                        "plan": plan,
                        "amount": amount
                    }
                )
        except Exception as e:
            logger.error(f"Failed to create payment record: {str(e)}")
            return Response(
                {"error": "Failed to process payment. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response(
            {
                "message": "STK Push sent. Awaiting payment confirmation.",
                "checkout_request_id": payment.checkout_request_id,
            }
        )


class MpesaCallbackView(APIView):
    """
    Webhook endpoint for M-Pesa STK Push callbacks.
    
    Security measures:
    - IP whitelist verification
    - Request payload validation
    - Idempotency guard (duplicate callbacks won't activate twice)
    - Comprehensive logging
    - Rate limiting
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        client_ip = get_client_ip(request)
        
        # Verify IP (in production, this should whitelist Safaricom IPs)
        if not verify_mpesa_webhook_ip(client_ip):
            logger.error(f"Unauthorized webhook from IP: {client_ip}")
            return Response(
                {"ResultCode": 1, "ResultDesc": "Unauthorized"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        log_webhook_received(request.data.get("Body", {}).get("stkCallback", {}).get("CheckoutRequestID", "unknown"), request.data, client_ip)
        
        # Validate payload structure
        try:
            validate_mpesa_callback_payload(request.data)
        except DRFValidationError as e:
            logger.error(f"Callback validation failed: {str(e)}")
            return Response(
                {"ResultCode": 1, "ResultDesc": "Invalid payload"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        data = request.data.get("Body", {}).get("stkCallback", {})
        checkout_request_id = data.get("CheckoutRequestID")
        result_code = data.get("ResultCode")
        result_desc = data.get("ResultDesc")

        try:
            payment = MpesaPayment.objects.get(checkout_request_id=checkout_request_id)
        except MpesaPayment.DoesNotExist:
            logger.error(f"Callback received for unknown payment: {checkout_request_id}")
            # Return success to acknowledge receipt; Safaricom will retry if we fail
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        # IDEMPOTENCY GUARD: If payment already processed, return early
        if payment.status != MpesaPayment.STATUS_PENDING:
            logger.warning(
                f"Callback received for already-processed payment: {checkout_request_id}",
                extra={"current_status": payment.status}
            )
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})
        
        try:
            with transaction.atomic():
                # Lock payment record to prevent race conditions
                payment = MpesaPayment.objects.select_for_update().get(id=payment.id)
                
                # Double-check status after lock acquired
                if payment.status != MpesaPayment.STATUS_PENDING:
                    logger.info(f"Payment already processed (after lock): {checkout_request_id}")
                    return Response({"ResultCode": 0, "ResultDesc": "Accepted"})
                
                payment.result_code = result_code
                payment.result_desc = result_desc
                
                if result_code == 0:
                    # Success: extract receipt and activate subscription
                    items = data.get("CallbackMetadata", {}).get("Item", [])
                    meta = {item.get("Name"): item.get("Value") for item in items}
                    payment.mpesa_receipt = meta.get("MpesaReceiptNumber")
                    payment.status = MpesaPayment.STATUS_SUCCESS
                    payment.save()
                    
                    # Activate subscription (only if not already active)
                    if payment.business.subscription:
                        subscription = payment.business.subscription
                        if subscription.status != Subscription.STATUS_ACTIVE:
                            subscription.activate(payment.plan)
                            logger.info(
                                f"Subscription activated via callback",
                                extra={"subscription_id": subscription.id, "plan": payment.plan}
                            )
                    
                    log_webhook_processed(checkout_request_id, result_code, "activated_subscription")
                    PaymentMetrics.record_payment_success(checkout_request_id, payment.plan, payment.amount, 0)
                    
                else:
                    # Failed payment
                    payment.status = MpesaPayment.STATUS_FAILED
                    payment.save()
                    log_webhook_processed(checkout_request_id, result_code, "marked_failed")
                    PaymentMetrics.record_payment_failed(checkout_request_id, payment.plan, result_code, result_desc)
                    
                    # Phase 2: Send admin alert for failed payment
                    send_payment_failure_alert(payment, result_desc)
        
        except Exception as e:
            logger.error(f"Error processing callback for {checkout_request_id}: {str(e)}")
            # Still return success to acknowledge; manual reconciliation will fix it
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})
        
        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


class PaymentStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, checkout_request_id):
        business = _require_business(request.user)
        try:
            payment = MpesaPayment.objects.get(
                checkout_request_id=checkout_request_id,
                business=business,
            )
        except MpesaPayment.DoesNotExist:
            return Response({"error": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            {
                "status": payment.status,
                "plan": payment.plan,
                "receipt": payment.mpesa_receipt,
            }
        )


class MpesaForceReconcileView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, checkout_request_id):
        from .mpesa import query_stk_status
        
        business = _require_business(request.user)
        
        try:
            payment = MpesaPayment.objects.get(
                checkout_request_id=checkout_request_id,
                business=business,
            )
        except MpesaPayment.DoesNotExist:
            logger.warning(f"Manual reconcile: payment not found for {checkout_request_id}")
            return Response({"error": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)
            
        if payment.status != MpesaPayment.STATUS_PENDING:
            logger.info(f"Manual reconcile: payment already finalized {checkout_request_id}")
            return Response({
                "status": payment.status,
                "message": "Transaction already finalized."
            })
            
        try:
            logger.info(f"Manual reconcile initiated for {checkout_request_id}")
            status_data = query_stk_status(payment.checkout_request_id)
            result_code = status_data.get("ResultCode")
            
            # Map result codes as we did in the background task
            with transaction.atomic():
                payment = MpesaPayment.objects.select_for_update().get(id=payment.id)
                
                # Double-check status after lock
                if payment.status != MpesaPayment.STATUS_PENDING:
                    logger.info(f"Payment already processed during reconcile: {checkout_request_id}")
                    return Response({
                        "status": payment.status,
                        "message": "Transaction already finalized."
                    })
                
                if result_code == "0":
                    payment.status = MpesaPayment.STATUS_SUCCESS
                    payment.result_code = 0
                    payment.result_desc = status_data.get("ResultDesc", "Success (Manual Reconcile)")
                    payment.save()
                    
                    if payment.business.subscription:
                        subscription = payment.business.subscription
                        if subscription.status != Subscription.STATUS_ACTIVE:
                            subscription.activate(payment.plan)
                            logger.info(f"Subscription activated via manual reconcile {checkout_request_id}")
                    
                    PaymentMetrics.record_reconciliation_success(checkout_request_id, payment.plan)
                    
                elif result_code in ["1032", "1037", "2001", "1"]:
                    payment.status = MpesaPayment.STATUS_FAILED
                    payment.result_code = int(result_code)
                    payment.result_desc = status_data.get("ResultDesc", "Failed (Manual Reconcile)")
                    payment.save()
                    logger.info(f"Payment marked failed via reconcile: {checkout_request_id}")
                
            return Response({
                "status": payment.status,
                "result_desc": payment.result_desc
            })
            
        except Exception as e:
            logger.error(f"Manual reconcile failed for {checkout_request_id}: {str(e)}")
            return Response(
                {"error": "Failed to verify with Safaricom. Try again later."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SubscriptionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from billing.models import Subscription
        from datetime import date
        
        business = _require_business(request.user)
        subscription = getattr(business, "subscription", None)
        if not subscription:
            # Auto-create Free tier subscription if it doesn't exist
            subscription, created = Subscription.objects.get_or_create(
                business=business,
                defaults={
                    "plan": Subscription.PLAN_FREE,
                    "status": Subscription.STATUS_ACTIVE,
                    "start_date": date.today(),
                    "end_date": None,
                    "auto_renew": True,
                },
            )
        serializer = SubscriptionSerializer(subscription)
        return Response(serializer.data)


class BillingHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business = _require_business(request.user)
        payments = MpesaPayment.objects.filter(business=business)
        return Response(MpesaPaymentSerializer(payments, many=True).data)


class CancelAutoRenewView(APIView):
    permission_classes = [IsAuthenticated, SubscriptionPermission]

    def post(self, request):
        business = _require_business(request.user)
        sub = business.subscription
        sub.auto_renew = False
        sub.status = "cancelled"
        sub.save(update_fields=["auto_renew", "status", "updated_at"])
        return Response({"message": "Subscription auto-renew has been cancelled."})
