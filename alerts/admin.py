from django.contrib import admin
from unfold.admin import ModelAdmin
from unfold.decorators import display
from .models import StockAlert, InAppNotification, WhatsAppConnection


class StockAlertAdmin(ModelAdmin):
    list_display = ['product', 'shop', 'channel', 'display_status', 'stock_level', 'threshold', 'sent_at']
    list_filter = ['channel', 'status', 'sent_at', 'shop']
    search_fields = ['product__name', 'shop__name']
    readonly_fields = ['sent_at', 'error_msg']
    ordering = ['-sent_at']

    @display(description="Status", label=True)
    def display_status(self, obj):
        colors = {
            "sent": "green",
            "failed": "red",
            "pending": "amber"
        }
        return obj.status.upper(), colors.get(obj.status, "gray")


class InAppNotificationAdmin(ModelAdmin):
    list_display = ['title', 'type', 'shop', 'display_read_status', 'created_at']
    list_filter = ['type', 'is_read', 'created_at', 'shop']
    search_fields = ['title', 'message', 'shop__name', 'product__name']
    readonly_fields = ['created_at']
    ordering = ['-created_at']

    @display(description="Read Status", label=True)
    def display_read_status(self, obj):
        return ("READ", "green") if obj.is_read else ("UNREAD", "amber")


class WhatsAppConnectionAdmin(ModelAdmin):
    list_display = ['shop', 'phone_number', 'display_active', 'connected_at', 'last_message_at']
    list_filter = ['is_active', 'connected_at']
    search_fields = ['shop__name', 'phone_number']
    readonly_fields = ['connected_at']

    @display(description="Status", label=True)
    def display_active(self, obj):
        return ("ACTIVE", "green") if obj.is_active else ("INACTIVE", "red")

