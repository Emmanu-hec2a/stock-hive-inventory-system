from django.contrib import admin
from django.db.models import Sum, Count
from django.utils.html import format_html
from django.utils import timezone
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import action, display

from inventory.models import (
    Business,
    Category,
    Product,
    Sale,
    SaleItem,
    Shop,
    StockAdjustment,
    StockEntry,
)


# ─── BUSINESS ADMIN ──────────────────────────────────────────

class ShopInline(TabularInline):
    model = Shop
    extra = 0
    fields = ["name", "location", "is_active"]
    readonly_fields = ["name", "location"]
    show_change_link = True
    can_delete = False


class BusinessAdmin(ModelAdmin):
    list_display = [
        "name", "owner_email", "display_plan", "display_status",
        "shop_count", "display_end_date", "created_at"
    ]
    list_filter = ["subscription__plan", "subscription__status"]
    search_fields = ["name", "owner__email", "owner__full_name"]
    readonly_fields = ["created_at"]
    inlines = [ShopInline]
    ordering = ["-created_at"]

    fieldsets = (
        ("Business Info", {
            "fields": ("name", "owner", "logo", "created_at")
        }),
    )

    @display(description="Owner Email", ordering="owner__email")
    def owner_email(self, obj):
        return obj.owner.email if obj.owner else "—"

    @display(description="Plan", label=True)
    def display_plan(self, obj):
        colors = {
            "free": "gray",
            "basic": "blue",
            "pro": "amber",
            "enterprise": "green",
        }
        plan = getattr(obj.subscription, "plan", "free") if hasattr(obj, 'subscription') else "free"
        color = colors.get(plan, "gray")
        return plan.upper(), color

    @display(description="Status", label=True)
    def display_status(self, obj):
        sub = getattr(obj, "subscription", None)
        if not sub:
            return "NO SUBSCRIPTION", "red"
        colors = {
            "active": "green",
            "expired": "red",
            "cancelled": "gray",
            "past_due": "amber",
        }
        return sub.status.upper(), colors.get(sub.status, "gray")

    @display(description="Shops")
    def shop_count(self, obj):
        return obj.shops.filter(is_active=True).count()

    @display(description="Expires")
    def display_end_date(self, obj):
        sub = getattr(obj, "subscription", None)
        if not sub or sub.plan == "free":
            return "—"
        delta = (sub.end_date - timezone.now().date()).days
        if delta < 0:
            return format_html('<span style="color:red">Expired</span>')
        if delta <= 5:
            return format_html(f'<span style="color:orange">In {delta}d</span>')
        return format_html(f'<span style="color:green">In {delta}d</span>')

    @action(description="Suspend selected businesses")
    def suspend_businesses(self, request, queryset):
        for biz in queryset:
            sub = getattr(biz, "subscription", None)
            if sub:
                sub.status = "cancelled"
                sub.save()
        self.message_user(request, f"{queryset.count()} business(es) suspended.")

    @action(description="Grant 30-day Pro trial")
    def grant_pro_trial(self, request, queryset):
        from datetime import date, timedelta
        for biz in queryset:
            sub = getattr(biz, "subscription", None)
            if sub:
                sub.plan = "pro"
                sub.status = "active"
                sub.end_date = date.today() + timedelta(days=30)
                sub.save()
        self.message_user(request, f"Pro trial granted to {queryset.count()} business(es).")

    actions = ["suspend_businesses", "grant_pro_trial"]


# ─── SHOP ADMIN ──────────────────────────────────────────────

class ShopAdmin(ModelAdmin):
    list_display = ["name", "business", "location", "display_status", "product_count", "created_at"]
    list_filter = ["is_active", "business__subscription__plan"]
    search_fields = ["name", "business__name", "location"]
    readonly_fields = ["created_at"]

    @display(description="Status", label=True)
    def display_status(self, obj):
        return ("ACTIVE", "green") if obj.is_active else ("INACTIVE", "red")

    @display(description="Products")
    def product_count(self, obj):
        return obj.products.filter(is_active=True).count()


# ─── REMAINING MODELS (BASIC REGISTRATION) ──────────────────

admin.site.register(Category)
admin.site.register(Product)
admin.site.register(StockEntry)
admin.site.register(StockAdjustment)
admin.site.register(Sale)
admin.site.register(SaleItem)

