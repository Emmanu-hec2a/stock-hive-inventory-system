from rest_framework import serializers
from .models import InAppNotification, WhatsAppConnection, StockAlert


class InAppNotificationSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    time_ago = serializers.SerializerMethodField()

    class Meta:
        model = InAppNotification
        fields = ["id", "type", "title", "message", "is_read", "product", "product_name", "created_at", "time_ago"]
        read_only_fields = ["created_at"]

    def get_time_ago(self, obj):
        """Returns a human-readable 'time ago' string."""
        from django.utils.timesince import timesince
        return f"{timesince(obj.created_at)} ago"


class WhatsAppConnectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatsAppConnection
        fields = ["phone_number", "is_active", "connected_at", "last_message_at"]
        read_only_fields = ["connected_at", "last_message_at"]


class StockAlertSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    shop_name = serializers.CharField(source="shop.name", read_only=True)

    class Meta:
        model = StockAlert
        fields = ["id", "product", "product_name", "shop", "shop_name", "channel", "status", 
                  "stock_level", "threshold", "error_msg", "sent_at"]
        read_only_fields = ["sent_at"]
