from django.contrib.admin import AdminSite
from django.template.response import TemplateResponse
from django.db.models import Sum, Count
from django.utils.html import format_html
from datetime import date

from billing.models import Subscription, MpesaPayment
from inventory.models import Business, Shop, Product, Sale, SaleItem, Category, StockEntry, StockAdjustment
from accounts.models import User
from alerts.models import InAppNotification, StockAlert, WhatsAppConnection


class StockHiveAdminSite(AdminSite):
    """Custom admin site for StockHive system owner panel."""
    
    site_header = "StockHive"
    site_title = "StockHive Admin"
    index_title = "System Overview"
    site_url = None

    def index(self, request, extra_context=None):
        """Override default admin index with platform statistics."""
        today = date.today()

        # Key platform metrics
        total_businesses = Business.objects.count()
        active_subs = Subscription.objects.filter(status="active").exclude(plan="free").count()
        free_subs = Subscription.objects.filter(plan="free").count()
        expired_subs = Subscription.objects.filter(status="expired").count()
        
        mrr_data = MpesaPayment.objects.filter(
            status="success",
            created_at__month=today.month,
            created_at__year=today.year
        ).aggregate(total=Sum("amount"))
        mrr = mrr_data["total"] or 0
        
        new_this_month = Business.objects.filter(
            created_at__month=today.month,
            created_at__year=today.year
        ).count()
        
        failed_payments = MpesaPayment.objects.filter(status="failed").count()
        
        plan_breakdown = Subscription.objects.values("plan").annotate(count=Count("id"))
        
        extra_context = extra_context or {}
        extra_context.update({
            "total_businesses": total_businesses,
            "active_subs": active_subs,
            "free_subs": free_subs,
            "expired_subs": expired_subs,
            "mrr": f"KES {int(mrr):,}",
            "new_this_month": new_this_month,
            "failed_payments": failed_payments,
            "plan_breakdown": plan_breakdown,
        })
        
        return super().index(request, extra_context)


# Create the custom admin site instance
admin_site = StockHiveAdminSite(name="stockhive_admin")

# Import admin classes (without site=None registration)
from accounts.admin import UserAdmin
from inventory.admin import BusinessAdmin, ShopAdmin
from billing.admin import SubscriptionAdmin, MpesaPaymentAdmin
from alerts.admin import InAppNotificationAdmin, StockAlertAdmin, WhatsAppConnectionAdmin

# Register models with the custom site
admin_site.register(User, UserAdmin)
admin_site.register(Business, BusinessAdmin)
admin_site.register(Shop, ShopAdmin)
admin_site.register(Subscription, SubscriptionAdmin)
admin_site.register(MpesaPayment, MpesaPaymentAdmin)
admin_site.register(InAppNotification, InAppNotificationAdmin)
admin_site.register(StockAlert, StockAlertAdmin)
admin_site.register(WhatsAppConnection, WhatsAppConnectionAdmin)

# Basic registrations
admin_site.register(Product)
admin_site.register(Sale)
admin_site.register(SaleItem)
admin_site.register(Category)
admin_site.register(StockEntry)
admin_site.register(StockAdjustment)
