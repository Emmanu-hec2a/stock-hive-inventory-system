from rest_framework import generics, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from .models import InAppNotification, WhatsAppConnection, StockAlert
from .serializers import InAppNotificationSerializer, WhatsAppConnectionSerializer, StockAlertSerializer
from billing.permissions import SubscriptionPermission
from inventory.mixins import ShopScopedMixin


class NotificationListView(ShopScopedMixin, generics.ListAPIView):
    """List unread in-app notifications for the current shop."""
    serializer_class = InAppNotificationSerializer
    permission_classes = [IsAuthenticated, SubscriptionPermission]

    def get_queryset(self):
        return InAppNotification.objects.filter(
            shop=self.get_shop(),
            is_read=False
        )


class NotificationDetailView(ShopScopedMixin, generics.RetrieveUpdateAPIView):
    """Mark a single notification as read."""
    serializer_class = InAppNotificationSerializer
    permission_classes = [IsAuthenticated, SubscriptionPermission]

    def get_queryset(self):
        return InAppNotification.objects.filter(shop=self.get_shop())

    def patch(self, request, *args, **kwargs):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response(self.get_serializer(notification).data)


class MarkAllNotificationsReadView(ShopScopedMixin, generics.GenericAPIView):
    """Mark all unread notifications as read."""
    permission_classes = [IsAuthenticated, SubscriptionPermission]

    def post(self, request):
        InAppNotification.objects.filter(
            shop=self.get_shop(),
            is_read=False
        ).update(is_read=True)
        return Response({"message": "All notifications marked as read."})


class UnreadNotificationCountView(ShopScopedMixin, generics.GenericAPIView):
    """Get count of unread notifications."""
    permission_classes = [IsAuthenticated, SubscriptionPermission]

    def get(self, request):
        count = InAppNotification.objects.filter(
            shop=self.get_shop(),
            is_read=False
        ).count()
        return Response({"unread_count": count})


class WhatsAppConnectionView(ShopScopedMixin, generics.GenericAPIView):
    """Get, create, or delete WhatsApp connection for shop."""
    serializer_class = WhatsAppConnectionSerializer
    permission_classes = [IsAuthenticated, SubscriptionPermission]

    def get(self, request):
        """Get current WhatsApp connection status."""
        shop = self.get_shop()
        try:
            conn = shop.whatsapp_connection
            return Response({
                "connected": conn.is_active,
                "phone_number": conn.phone_number,
                "last_message_at": conn.last_message_at,
            })
        except WhatsAppConnection.DoesNotExist:
            return Response({"connected": False})

    def post(self, request):
        """Connect/update WhatsApp number."""
        phone = request.data.get("phone_number")
        if not phone:
            return Response(
                {"error": "phone_number is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        shop = self.get_shop()
        conn, created = WhatsAppConnection.objects.get_or_create(shop=shop)
        conn.phone_number = phone
        conn.is_active = True
        conn.save()

        return Response({
            "message": "WhatsApp alerts connected.",
            "phone_number": conn.phone_number,
            "is_active": conn.is_active,
        })

    def delete(self, request):
        """Disconnect WhatsApp alerts."""
        shop = self.get_shop()
        try:
            conn = shop.whatsapp_connection
            conn.is_active = False
            conn.save()
            return Response({"message": "WhatsApp alerts disconnected."})
        except WhatsAppConnection.DoesNotExist:
            return Response(
                {"error": "No WhatsApp connection found"},
                status=status.HTTP_404_NOT_FOUND
            )


class StockAlertHistoryViewSet(ShopScopedMixin, viewsets.ReadOnlyModelViewSet):
    """View alert history for the current shop."""
    serializer_class = StockAlertSerializer
    permission_classes = [IsAuthenticated, SubscriptionPermission]

    def get_queryset(self):
        shop = self.get_shop()
        queryset = StockAlert.objects.filter(shop=shop)

        # Filter by channel if provided
        channel = self.request.query_params.get("channel")
        if channel:
            queryset = queryset.filter(channel=channel)

        # Filter by status if provided
        alert_status = self.request.query_params.get("status")
        if alert_status:
            queryset = queryset.filter(status=alert_status)

        return queryset.order_by("-sent_at")
