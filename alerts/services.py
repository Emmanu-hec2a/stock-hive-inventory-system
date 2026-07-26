from django.utils import timezone
from django.db.models import Sum
from datetime import timedelta
from .models import StockAlert, InAppNotification
from billing.constants import PLAN_FEATURES


def get_current_stock(product):
    """
    Calculate current stock for a product by summing:
    - Stock entries (added)
    - Minus sales (removed)
    - Plus adjustments (can be positive or negative)
    """
    from inventory.models import StockEntry, SaleItem, StockAdjustment

    entries = StockEntry.objects.filter(product=product).aggregate(t=Sum("quantity"))["t"] or 0
    sold = SaleItem.objects.filter(product=product).aggregate(t=Sum("quantity"))["t"] or 0
    adjusted = StockAdjustment.objects.filter(product=product).aggregate(t=Sum("quantity"))["t"] or 0

    return entries + adjusted - sold


def already_alerted_today(product, channel):
    """
    Check if an alert was already sent for this product on this channel today.
    Used for deduplication — one alert per product per channel per day.
    """
    today = timezone.now().date()
    return StockAlert.objects.filter(
        product=product,
        channel=channel,
        sent_at__date=today,
        status="sent"
    ).exists()


def is_feature_allowed(shop, feature):
    """
    Check if the shop's business plan includes the given feature.
    Free plan only gets in-app alerts, no WhatsApp or custom threshold.
    """
    try:
        plan = shop.business.subscription.plan
    except:
        plan = "free"
    
    allowed = PLAN_FEATURES.get(plan, [])
    return "*" in allowed or feature in allowed


def trigger_low_stock_alerts(product):
    """
    Main entry point for alert triggering.
    Call this after any stock-reducing operation (sale, negative adjustment).
    
    Logic:
    1. Calculate current stock
    2. If above threshold, do nothing
    3. Create in-app notification (all plans) with dedup
    4. If plan allows WhatsApp and number is connected, send WhatsApp
    5. Handle errors gracefully — never break the calling flow
    """
    try:
        shop = product.shop
        current_stock = get_current_stock(product)
        threshold = product.low_stock_threshold

        # Stock is fine, no alert needed
        if current_stock > threshold:
            return

        # ── IN-APP NOTIFICATION ──────────────────────────────────
        # All plans get in-app alerts
        if not already_alerted_today(product, "in_app"):
            is_out_of_stock = current_stock <= 0
            alert_type = "out_of_stock" if is_out_of_stock else "low_stock"
            title = f"{'Out of Stock' if is_out_of_stock else 'Low Stock'}: {product.name}"
            message = (
                f"{product.name} is "
                f"{'out of stock' if is_out_of_stock else f'running low ({current_stock} {product.unit} remaining)'}. "
                f"Restock soon to avoid stockouts."
            )

            InAppNotification.objects.create(
                shop=shop,
                type=alert_type,
                title=title,
                message=message,
                product=product,
            )

            StockAlert.objects.create(
                product=product,
                shop=shop,
                channel="in_app",
                status="sent",
                stock_level=current_stock,
                threshold=threshold,
            )

        # ── WHATSAPP NOTIFICATION ────────────────────────────────
        # Only for Basic, Pro, Enterprise plans
        if not is_feature_allowed(shop, "low_stock_alerts"):
            return

        if already_alerted_today(product, "whatsapp"):
            return

        # Check if WhatsApp is connected
        connection = getattr(shop, "whatsapp_connection", None)
        if not connection or not connection.is_active:
            return

        # Create alert record and attempt to send
        from .tasks import send_whatsapp_alert_task
        
        alert = StockAlert.objects.create(
            product=product,
            shop=shop,
            channel="whatsapp",
            status="pending",
            stock_level=current_stock,
            threshold=threshold,
        )

        # Trigger background task
        try:
            send_whatsapp_alert_task.delay(
                alert_id=alert.id,
                phone=connection.phone_number,
                shop_name=shop.name,
                product_name=product.name,
                current_stock=current_stock,
                unit=product.unit,
            )
        except Exception as celery_err:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to enqueue WhatsApp alert for {product.id}: {str(celery_err)}")
            # We don't raise here, so the sale can still finish successfully.
            # The background reconciliation task or a manual check can handle this later.
            alert.status = "failed"
            alert.error_msg = f"Broker error: {str(celery_err)}"
            alert.save()

    except Exception as e:
        # Log but never raise — we don't want alert failures to break sales flow
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error triggering low stock alert for {product.id}: {str(e)}")
