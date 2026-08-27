"""
Alert system for critical billing events.
Phase 2: Sends admin notifications for payment failures and reconciliation issues.
"""
import logging
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

logger = logging.getLogger("billing.alerts")

User = get_user_model()


def send_payment_failure_alert(payment, reason):
    """
    Send alert to admins when a payment fails.
    """
    try:
        admins = User.objects.filter(role__in=["super_admin", "shop_admin"])
        admin_emails = [admin.email for admin in admins]
        
        if not admin_emails:
            logger.warning("No admin emails found to notify about payment failure")
            return
        
        subject = f"⚠️ Payment Failed: {payment.checkout_request_id}"
        message = f"""
Payment Failure Alert

Checkout ID: {payment.checkout_request_id}
Business: {payment.business.name}
Plan: {payment.plan}
Amount: KES {payment.amount}
Phone: {payment.phone_number}
Result Code: {payment.result_code}
Reason: {reason}
Time: {payment.updated_at}

Action Required: 
- Review payment status in admin panel
- Contact customer if necessary
- Manual reconciliation may be needed

Admin Panel: {settings.ALLOWED_HOSTS[0]}/admin/billing/mpesapayment/{payment.id}/change/
        """
        
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            admin_emails,
            fail_silently=False,
        )
        logger.info(f"Payment failure alert sent for {payment.checkout_request_id}")
    except Exception as e:
        logger.error(f"Failed to send payment failure alert: {str(e)}")


def send_reconciliation_failure_alert(checkout_request_id, error_message):
    """
    Send alert to admins when reconciliation task fails.
    """
    try:
        admins = User.objects.filter(role__in=["super_admin", "shop_admin"])
        admin_emails = [admin.email for admin in admins]
        
        if not admin_emails:
            logger.warning("No admin emails found to notify about reconciliation failure")
            return
        
        subject = f"⚠️ Reconciliation Failed: {checkout_request_id}"
        message = f"""
Reconciliation Failure Alert

Checkout ID: {checkout_request_id}
Error: {error_message}
Time: {timezone.now()}

Action Required:
- Investigate M-Pesa API connectivity
- Check Redis and Celery status
- Manual reconciliation may be needed
- Review billing logs for details

Admin Panel: {settings.ALLOWED_HOSTS[0]}/admin/billing/mpesapayment/
Logs: Check billing_reconciliation.log
        """
        
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            admin_emails,
            fail_silently=False,
        )
        logger.info(f"Reconciliation failure alert sent for {checkout_request_id}")
    except Exception as e:
        logger.error(f"Failed to send reconciliation failure alert: {str(e)}")


def send_high_failure_rate_alert(failure_count, time_window_minutes):
    """
    Send alert if payment failure rate is high (Phase 3 enhancement).
    """
    try:
        admins = User.objects.filter(role__in=["super_admin", "shop_admin"])
        admin_emails = [admin.email for admin in admins]
        
        if not admin_emails:
            return
        
        subject = f"🚨 High Payment Failure Rate Detected"
        message = f"""
Payment Failure Rate Alert

Failed Payments: {failure_count}
Time Window: Last {time_window_minutes} minutes
Status: CRITICAL

This may indicate:
- M-Pesa API outage
- Network connectivity issues
- Configuration problem
- High volume of user cancellations

Action Required:
- Check M-Pesa Daraja API status
- Verify network connectivity
- Review recent logs
- Contact Safaricom support if needed

Admin Panel: {settings.ALLOWED_HOSTS[0]}/admin/billing/mpesapayment/
        """
        
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            admin_emails,
            fail_silently=False,
        )
        logger.error(f"High payment failure rate alert sent ({failure_count} failures)")
    except Exception as e:
        logger.error(f"Failed to send high failure rate alert: {str(e)}")
