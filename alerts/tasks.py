import logging
from celery import shared_task
from django.utils import timezone
from .models import StockAlert, WhatsAppConnection
from .whatsapp import send_whatsapp_alert

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3)
def send_whatsapp_alert_task(self, alert_id, phone, shop_name, product_name, current_stock, unit):
    """
    Background task to send WhatsApp alerts with retry logic.
    """
    try:
        success, error = send_whatsapp_alert(
            phone=phone,
            shop_name=shop_name,
            product_name=product_name,
            current_stock=current_stock,
            unit=unit,
        )

        alert = StockAlert.objects.get(id=alert_id)
        alert.status = "sent" if success else "failed"
        alert.error_msg = error
        alert.save()

        if success:
            # Update last message time on connection
            WhatsAppConnection.objects.filter(phone_number=phone).update(
                last_message_at=timezone.now()
            )
        else:
            # If not success, and not a terminal error, we could retry
            # For now, just log the error
            logger.error(f"WhatsApp alert failed for alert {alert_id}: {error}")
            
    except Exception as exc:
        logger.error(f"Error in send_whatsapp_alert_task for alert {alert_id}: {str(exc)}")
        try:
            self.retry(exc=exc, countdown=60 * 5)  # Retry in 5 minutes
        except Exception:
            # Handle case where MaxRetriesExceededError might not be imported or other retry issues
            logger.error(f"Max retries exceeded or retry failed for WhatsApp alert {alert_id}")
            StockAlert.objects.filter(id=alert_id).update(
                status="failed", 
                error_msg="Retry failed or max retries exceeded"
            )
