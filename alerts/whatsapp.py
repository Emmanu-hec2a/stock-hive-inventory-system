import africastalking
from django.conf import settings


def send_whatsapp_alert(phone, shop_name, product_name, current_stock, unit):
    """
    Sends a low stock alert via WhatsApp using Africa's Talking API.
    
    Uses a pre-approved template "low_stock_alert" with parameters:
    {{1}} = shop_name
    {{2}} = product_name
    {{3}} = current_stock
    {{4}} = unit
    
    Returns:
        (success: bool, error: str | None)
        - success=True if WhatsApp API accepted the message
        - error contains the exception message if failed
    """
    try:
        # Initialize Africa's Talking SDK
        africastalking.initialize(
            username=settings.AT_USERNAME,
            api_key=settings.AT_API_KEY,
        )

        whatsapp = africastalking.WhatsApp

        response = whatsapp.send_template(
            to=f"+{phone}",
            template_name="low_stock_alert",
            template_params=[
                shop_name,
                product_name,
                str(current_stock),
                unit,
            ],
            from_number=settings.AT_WHATSAPP_NUMBER,
        )

        # Check response for success
        if response:
            return True, None
        else:
            return False, "Empty response from WhatsApp API"

    except Exception as e:
        return False, str(e)
