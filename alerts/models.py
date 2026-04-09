import uuid
from django.db import models
from django.utils import timezone


class StockAlert(models.Model):
    """Audit log for all stock alerts — tracks sent/failed WhatsApp and in-app alerts."""
    
    CHANNEL_CHOICES = [
        ("in_app", "In-App"),
        ("whatsapp", "WhatsApp"),
    ]
    STATUS_CHOICES = [
        ("sent", "Sent"),
        ("failed", "Failed"),
        ("pending", "Pending"),
    ]

    product = models.ForeignKey(
        "inventory.Product", 
        on_delete=models.CASCADE, 
        related_name="stock_alerts"
    )
    shop = models.ForeignKey(
        "inventory.Shop", 
        on_delete=models.CASCADE,
        related_name="stock_alerts"
    )
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    stock_level = models.IntegerField()  # Stock at time of alert
    threshold = models.IntegerField()    # Threshold at time of alert
    error_msg = models.TextField(null=True, blank=True)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-sent_at"]
        indexes = [
            models.Index(fields=["product", "channel", "sent_at"]),
            models.Index(fields=["shop", "sent_at"]),
        ]

    def __str__(self):
        return f"{self.product.name} - {self.channel} - {self.status}"


class InAppNotification(models.Model):
    """In-app notifications displayed to shop users."""
    
    TYPE_CHOICES = [
        ("low_stock", "Low Stock"),
        ("out_of_stock", "Out of Stock"),
        ("subscription_expiring", "Subscription Expiring"),
        ("payment_success", "Payment Success"),
        ("payment_failed", "Payment Failed"),
    ]

    shop = models.ForeignKey(
        "inventory.Shop", 
        on_delete=models.CASCADE, 
        related_name="notifications"
    )
    type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    title = models.CharField(max_length=100)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    product = models.ForeignKey(
        "inventory.Product", 
        null=True, 
        blank=True, 
        on_delete=models.SET_NULL,
        related_name="notifications"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shop", "is_read", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.shop.name} - {self.type} - {self.title}"


class WhatsAppConnection(models.Model):
    """Stores WhatsApp number connected by shop admin for alerts."""
    
    shop = models.OneToOneField(
        "inventory.Shop", 
        on_delete=models.CASCADE, 
        related_name="whatsapp_connection"
    )
    phone_number = models.CharField(max_length=15)  # Format: 2547XXXXXXXX
    is_active = models.BooleanField(default=True)
    connected_at = models.DateTimeField(auto_now_add=True)
    last_message_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "WhatsApp Connection"
        verbose_name_plural = "WhatsApp Connections"

    def __str__(self):
        return f"{self.shop.name} - {self.phone_number}"


class SupportTicket(models.Model):
    PRIORITY_LOW = "low"
    PRIORITY_MEDIUM = "medium"
    PRIORITY_HIGH = "high"
    PRIORITY_CRITICAL = "critical"
    PRIORITY_CHOICES = [
        (PRIORITY_LOW, "Low"),
        (PRIORITY_MEDIUM, "Medium"),
        (PRIORITY_HIGH, "High"),
        (PRIORITY_CRITICAL, "Critical"),
    ]

    STATUS_OPEN = "open"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_RESOLVED = "resolved"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = [
        (STATUS_OPEN, "Open"),
        (STATUS_IN_PROGRESS, "In Progress"),
        (STATUS_RESOLVED, "Resolved"),
        (STATUS_CLOSED, "Closed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey("inventory.Business", on_delete=models.CASCADE, related_name="support_tickets")
    subject = models.CharField(max_length=255)
    description = models.TextField()
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default=PRIORITY_MEDIUM)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.priority.upper()}] {self.subject} - {self.business.name}"
