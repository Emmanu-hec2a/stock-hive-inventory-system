from datetime import date, timedelta

from django.db import models
from django.utils import timezone


class Subscription(models.Model):
    PLAN_FREE = "free"
    PLAN_BASIC = "basic"
    PLAN_PRO = "pro"
    PLAN_ENTERPRISE = "enterprise"
    PLAN_CHOICES = [
        (PLAN_FREE, "Free"),
        (PLAN_BASIC, "Basic"),
        (PLAN_PRO, "Pro"),
        (PLAN_ENTERPRISE, "Enterprise"),
    ]
    STATUS_ACTIVE = "active"
    STATUS_EXPIRED = "expired"
    STATUS_CANCELLED = "cancelled"
    STATUS_PAST_DUE = "past_due"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_EXPIRED, "Expired"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_PAST_DUE, "Past Due"),
    ]

    business = models.OneToOneField(
        "inventory.Business",
        on_delete=models.CASCADE,
        related_name="subscription",
    )
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default=PLAN_FREE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    start_date = models.DateField(default=date.today)
    end_date = models.DateField(null=True, blank=True)
    auto_renew = models.BooleanField(default=True)
    custom_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Custom negotiated price for Enterprise plan. If set, this overrides the default plan price.",
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_active(self):
        if self.plan == self.PLAN_FREE:
            return self.status == self.STATUS_ACTIVE
        return self.status == self.STATUS_ACTIVE and bool(self.end_date and self.end_date >= date.today())

    def activate(self, plan, custom_price=None):
        """
        Activate subscription with a given plan.
        For Enterprise plans, custom_price should be provided.
        """
        self.plan = plan
        self.status = self.STATUS_ACTIVE
        self.start_date = date.today()
        self.end_date = None if plan == self.PLAN_FREE else date.today() + timedelta(days=30)
        
        # Store custom price for Enterprise plan
        if plan == self.PLAN_ENTERPRISE and custom_price:
            self.custom_price = custom_price
        
        self.save()


class MpesaPayment(models.Model):
    STATUS_PENDING = "pending"
    STATUS_SUCCESS = "success"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_SUCCESS, "Success"),
        (STATUS_FAILED, "Failed"),
    ]

    business = models.ForeignKey("inventory.Business", on_delete=models.CASCADE, related_name="mpesa_payments")
    subscription = models.ForeignKey(
        Subscription, on_delete=models.SET_NULL, null=True, blank=True, related_name="payments"
    )
    plan = models.CharField(max_length=20)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    phone_number = models.CharField(max_length=15)
    merchant_request_id = models.CharField(max_length=100)
    checkout_request_id = models.CharField(max_length=100, unique=True)
    mpesa_receipt = models.CharField(max_length=50, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    result_code = models.IntegerField(null=True, blank=True)
    result_desc = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
