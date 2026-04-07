from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html
from datetime import date, timedelta
from unfold.admin import ModelAdmin
from unfold.decorators import action, display

from billing.models import MpesaPayment, Subscription


# ─── SUBSCRIPTION ADMIN ──────────────────────────────────────

class SubscriptionAdmin(ModelAdmin):
    list_display = [
        "business_name", "display_plan", "display_status",
        "start_date", "end_date", "days_remaining", "auto_renew"
    ]
    list_filter = ["plan", "status", "auto_renew"]
    search_fields = ["business__name", "business__owner__email"]
    readonly_fields = ["start_date", "created_at", "updated_at"]
    ordering = ["-created_at"]

    fieldsets = (
        ("Subscription", {
            "fields": ("business", "plan", "status", "auto_renew")
        }),
        ("Dates", {
            "fields": ("start_date", "end_date", "created_at", "updated_at")
        }),
    )

    @display(description="Business", ordering="business__name")
    def business_name(self, obj):
        return obj.business.name

    @display(description="Plan", label=True)
    def display_plan(self, obj):
        colors = {
            "free": "gray",
            "basic": "blue",
            "pro": "amber",
            "enterprise": "green"
        }
        return obj.plan.upper(), colors.get(obj.plan, "gray")

    @display(description="Status", label=True)
    def display_status(self, obj):
        colors = {
            "active": "green",
            "expired": "red",
            "cancelled": "gray",
            "past_due": "amber"
        }
        return obj.status.upper(), colors.get(obj.status, "gray")

    @display(description="Days Left")
    def days_remaining(self, obj):
        if obj.plan == "free":
            return "∞"
        if not obj.end_date:
            return "—"
        delta = (obj.end_date - date.today()).days
        if delta < 0:
            return format_html('<span style="color:red">Expired</span>')
        return f"{delta} days"

    @action(description="Extend by 30 days")
    def extend_30_days(self, request, queryset):
        for sub in queryset:
            if sub.end_date and sub.end_date >= date.today():
                sub.end_date += timedelta(days=30)
            else:
                sub.end_date = date.today() + timedelta(days=30)
            sub.status = "active"
            sub.save()
        self.message_user(request, f"Extended {queryset.count()} subscription(s) by 30 days.")

    @action(description="Set to Free plan")
    def downgrade_to_free(self, request, queryset):
        queryset.update(plan="free", status="active", end_date=None)
        self.message_user(request, f"Downgraded {queryset.count()} subscription(s) to Free.")

    @action(description="Expire selected subscriptions")
    def force_expire(self, request, queryset):
        queryset.update(status="expired")
        self.message_user(request, f"Expired {queryset.count()} subscription(s).")

    actions = ["extend_30_days", "downgrade_to_free", "force_expire"]


# ─── M-PESA PAYMENTS ADMIN ───────────────────────────────────

class MpesaPaymentAdmin(ModelAdmin):
    list_display = [
        "display_receipt", "business_name", "plan", "display_amount",
        "phone_number", "display_status", "created_at"
    ]
    list_filter = ["status", "plan"]
    search_fields = [
        "business__name", "mpesa_receipt",
        "phone_number", "checkout_request_id"
    ]
    readonly_fields = [
        "business", "plan", "amount", "phone_number",
        "merchant_request_id", "checkout_request_id",
        "mpesa_receipt", "result_code", "result_desc",
        "created_at", "updated_at"
    ]
    ordering = ["-created_at"]

    fieldsets = (
        ("Payment Info", {
            "fields": ("business", "plan", "amount", "phone_number", "status")
        }),
        ("M-PESA Details", {
            "fields": (
                "merchant_request_id", "checkout_request_id",
                "mpesa_receipt", "result_code", "result_desc"
            ),
            "classes": ("collapse",)
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )

    # Payments are read-only — never manually edited
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False  # Read-only panel

    def has_delete_permission(self, request, obj=None):
        return False  # Never delete payment records

    @display(description="Receipt")
    def display_receipt(self, obj):
        return obj.mpesa_receipt or (obj.checkout_request_id[:12] + "...") if obj.checkout_request_id else "—"

    @display(description="Business")
    def business_name(self, obj):
        return obj.business.name

    @display(description="Amount")
    def display_amount(self, obj):
        return f"KES {int(obj.amount):,}"

    @display(description="Status", label=True)
    def display_status(self, obj):
        colors = {
            "success": "green",
            "pending": "amber",
            "failed": "red"
        }
        return obj.status.upper(), colors.get(obj.status, "gray")

