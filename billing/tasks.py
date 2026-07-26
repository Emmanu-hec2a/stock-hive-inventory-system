import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from .models import MpesaPayment, Subscription
from .mpesa import query_stk_status

logger = logging.getLogger(__name__)

@shared_task
def expire_subscriptions_task():
    """
    Background task to expire subscriptions past their end date.
    """
    expired = Subscription.objects.filter(
        status=Subscription.STATUS_ACTIVE,
        end_date__isnull=False,
        end_date__lt=timezone.now().date(),
    )
    count = expired.update(status=Subscription.STATUS_EXPIRED)
    logger.info(f"Expired {count} subscriptions.")
    return f"Expired {count} subscriptions."

@shared_task
def reconcile_pending_payments():
    """
    Check for M-Pesa payments that have been 'Pending' for more than 5 minutes
    and query Safaricom for their real status.
    """
    threshold = timezone.now() - timedelta(minutes=5)
    pending_payments = MpesaPayment.objects.filter(
        status=MpesaPayment.STATUS_PENDING,
        created_at__lt=threshold
    )
    
    count = 0
    for payment in pending_payments:
        try:
            status_data = query_stk_status(payment.checkout_request_id)
            result_code = status_data.get("ResultCode")
            
            # ResultCode "0" means success
            if result_code == "0":
                payment.status = MpesaPayment.STATUS_SUCCESS
                payment.result_code = 0
                payment.result_desc = status_data.get("ResultDesc", "Success (Reconciled)")
                payment.save()
                
                # Activate subscription
                if payment.business.subscription:
                    payment.business.subscription.activate(payment.plan)
                    logger.info(f"Reconciled and activated payment {payment.checkout_request_id}")
                
            elif result_code in ["1032", "1037", "2001", "1"]: 
                # 1032: Cancelled by user
                # 1037: Timeout
                # 2001: Invalid initiator password
                # 1: Insufficient funds
                payment.status = MpesaPayment.STATUS_FAILED
                payment.result_code = int(result_code)
                payment.result_desc = status_data.get("ResultDesc", "Failed (Reconciled)")
                payment.save()
                logger.info(f"Reconciled failed payment {payment.checkout_request_id}")
            
            # If ResultCode is not found or is 'pending' in Safaricom's side, 
            # we leave it as is to check again later.
                
        except Exception as e:
            logger.error(f"Error reconciling payment {payment.checkout_request_id}: {str(e)}")
            
        count += 1
        
    return f"Processed {count} pending payments."
