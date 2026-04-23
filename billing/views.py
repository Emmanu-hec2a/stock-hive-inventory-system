from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.constants import PLAN_PRICES
from billing.models import MpesaPayment
from billing.mpesa import stk_push
from billing.permissions import SubscriptionPermission
from billing.serializers import MpesaPaymentSerializer, SubscriptionSerializer


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
            return Response({"error": "Invalid plan."}, status=status.HTTP_400_BAD_REQUEST)
        if not phone:
            return Response({"error": "phone is required."}, status=status.HTTP_400_BAD_REQUEST)

        business = _require_business(request.user)
        amount = PLAN_PRICES[plan]

        response = stk_push(
            phone_number=phone,
            amount=amount,
            account_ref=f"STOCKHIVE-{business.id}",
            description=f"StočkHive {plan.title()} Plan",
        )
        if response.get("ResponseCode") != "0":
            return Response({"error": "Failed to initiate payment."}, status=status.HTTP_400_BAD_REQUEST)

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
        return Response(
            {
                "message": "STK Push sent. Awaiting payment confirmation.",
                "checkout_request_id": payment.checkout_request_id,
            }
        )


class MpesaCallbackView(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        data = request.data.get("Body", {}).get("stkCallback", {})
        checkout_request_id = data.get("CheckoutRequestID")
        result_code = data.get("ResultCode")
        result_desc = data.get("ResultDesc")

        try:
            payment = MpesaPayment.objects.get(checkout_request_id=checkout_request_id)
        except MpesaPayment.DoesNotExist:
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        payment.result_code = result_code
        payment.result_desc = result_desc
        if result_code == 0:
            items = data.get("CallbackMetadata", {}).get("Item", [])
            meta = {item.get("Name"): item.get("Value") for item in items}
            payment.mpesa_receipt = meta.get("MpesaReceiptNumber")
            payment.status = MpesaPayment.STATUS_SUCCESS
            payment.save()
            payment.business.subscription.activate(payment.plan)
        else:
            payment.status = MpesaPayment.STATUS_FAILED
            payment.save()
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
