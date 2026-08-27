import logging
from datetime import timedelta
from celery import shared_task
from django.utils import timezone
from django.db import transaction

from .models import MpesaPayment, Subscription
from .mpesa import query_stk_status
from .utils import log_reconciliation_task, PaymentMetrics
from .alerts import send_reconciliation_failure_alert, send_high_failure_rate_alert

logger = logging.getLogger("billing.reconciliation")


@shared_task
def expire_subscriptions_task():
    """
    Background task to expire subscriptions past their end date.
    Runs daily at midnight UTC.
    """
    try:
        expired = Subscription.objects.filter(
            status=Subscription.STATUS_ACTIVE,
            end_date__isnull=False,
            end_date__lt=timezone.now().date(),
        )
        count = expired.update(status=Subscription.STATUS_EXPIRED)
        logger.info(f"Expired {count} subscriptions.")
        return f"Expired {count} subscriptions."
    except Exception as e:
        logger.error(f"Error in expire_subscriptions_task: {str(e)}")
        raise

@shared_task
def reconcile_pending_payments():
    """
    Background task to reconcile M-Pesa payments pending >5 minutes.
    Queries Safaricom for real status and updates local records.
    Runs every 10 minutes.
    Sends admin alerts if failure rate is high.
    """
    start_time = timezone.now()
    threshold = start_time - timedelta(minutes=5)
    pending_payments = MpesaPayment.objects.filter(
        status=MpesaPayment.STATUS_PENDING,
        created_at__lt=threshold
    )
    
    count = 0
    success_count = 0
    error_count = 0
    api_error_count = 0
    
    for payment in pending_payments:
        try:
            status_data = query_stk_status(payment.checkout_request_id)
            result_code = status_data.get("ResultCode")
            
            with transaction.atomic():
                # Lock payment to prevent race with webhook
                payment = MpesaPayment.objects.select_for_update().get(id=payment.id)
                
                # Skip if already processed by webhook
                if payment.status != MpesaPayment.STATUS_PENDING:
                    logger.debug(f"Payment {payment.checkout_request_id} already processed")
                    count += 1
                    continue
                
                # ResultCode "0" means success
                if result_code == "0":
                    payment.status = MpesaPayment.STATUS_SUCCESS
                    payment.result_code = 0
                    payment.result_desc = status_data.get("ResultDesc", "Success (Reconciled)")
                    payment.save()
                    
                    # Activate subscription if not already active
                    if payment.business.subscription:
                        subscription = payment.business.subscription
                        if subscription.status != Subscription.STATUS_ACTIVE:
                            subscription.activate(payment.plan)
                            logger.info(f"Reconciled and activated payment {payment.checkout_request_id}")
                            PaymentMetrics.record_reconciliation_success(payment.checkout_request_id, payment.plan)
                            success_count += 1
                
                elif result_code in ["1032", "1037", "2001", "1"]: 
                    # 1032: Cancelled by user
                    # 1037: Timeout
                    # 2001: Invalid initiator password
                    # 1: Insufficient funds
                    payment.status = MpesaPayment.STATUS_FAILED
                    payment.result_code = int(result_code)
                    payment.result_desc = status_data.get("ResultDesc", "Failed (Reconciled)")
                    payment.save()
                    logger.info(f"Reconciled failed payment {payment.checkout_request_id} (code: {result_code})")
                
                count += 1
                
        except Exception as e:
            logger.error(f"Error reconciling payment {payment.checkout_request_id}: {str(e)}")
            api_error_count += 1
            error_count += 1
            count += 1
    
    duration = (timezone.now() - start_time)
    log_reconciliation_task(duration, count, success_count, error_count)
    
    # Phase 2: Alert on high API error rates
    if count > 0 and api_error_count > count * 0.2:  # >20% error rate
        send_high_failure_rate_alert(api_error_count, 5)
    
    return f"Processed {count} pending payments ({success_count} reconciled, {error_count} errors)."


@shared_task
def log_daily_metrics_task():
    """
    Phase 3: Log daily payment metrics for monitoring.
    Runs once daily to track success rates, conversion rates, etc.
    """
    from .monitoring import log_daily_metrics
    
    try:
        log_daily_metrics()
        logger.info("Daily metrics logging completed")
        return "Daily metrics logged successfully"
    except Exception as e:
        logger.error(f"Error logging daily metrics: {str(e)}")
        raise

