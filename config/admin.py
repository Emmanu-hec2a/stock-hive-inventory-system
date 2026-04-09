from django.contrib.admin import AdminSite
from django.template.response import TemplateResponse
from django.db.models import Sum, Count
from django.utils.html import format_html
from datetime import date

from billing.models import Subscription, MpesaPayment
from inventory.models import Business, Shop, Product, Sale, SaleItem, Category, StockEntry, StockAdjustment
from accounts.models import User
from alerts.models import InAppNotification, StockAlert, SupportTicket, WhatsAppConnection
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.urls import path, reverse
from django.db.models import Q

class StockHiveAdminSite(AdminSite):
    """Custom admin site for StockHive system owner panel."""
    
    site_header = "StockHive"
    site_title = "StockHive Admin"
    index_title = "System Overview"
    site_url = None

    def search_view(self, request: HttpRequest) -> HttpResponse:
        """Custom search view for admin command palette (django-unfold compatible)."""
        q = request.GET.get('q', '').strip()
        
        if len(q) < 2:
            return HttpResponse(
                '<div id="command-results-note" class="p-4 text-center text-gray-500">'
                'Type at least 2 characters to search...'
                '</div>'
            )
        
        results = []
        
        # Users
        users = User.objects.filter(
            Q(full_name__icontains=q) | Q(email__icontains=q)
        )[:6]
        for user in users:
            url = reverse('admin:accounts_user_change', args=[user.pk])
            results.append((
                user.get_full_name() or user.email,
                'User',
                url
            ))
        
        # Businesses
        businesses = Business.objects.filter(
            Q(name__icontains=q)
        )[:6]
        for biz in businesses:
            url = reverse('admin:inventory_business_change', args=[biz.pk])
            results.append((
                biz.name,
                f'Business',
                url
            ))
        
        # Shops
        shops = Shop.objects.filter(
            Q(name__icontains=q) | Q(location__icontains=q)
        )[:6]
        for shop in shops:
            url = reverse('admin:inventory_shop_change', args=[shop.pk])
            subtitle = shop.business.name if shop.business else 'No business'
            results.append((
                shop.name,
                f'Shop • {subtitle}',
                url
            ))
        
        # Subscriptions
        subs = Subscription.objects.filter(
            Q(plan__icontains=q) | Q(status__icontains=q)
        )[:4]
        for sub in subs:
            url = reverse('admin:billing_subscription_change', args=[sub.pk])
            results.append((
                f'{sub.plan.upper()} - {sub.business.name}' if sub.business else sub.plan.upper(),
                'Subscription',
                url
            ))
        
        # Products (limited)
        products = Product.objects.filter(
            Q(name__icontains=q)
        )[:4]
        for prod in products:
            url = reverse('admin:inventory_product_change', args=[prod.pk])
            subtitle = f'{prod.shop.name if prod.shop else "No shop"}'
            results.append((
                prod.name,
                f'Product • {subtitle}',
                url
            ))
        
        html_items = ''
        for title, subtitle, url in results:
            html_items += f'''
            <li class="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-700 last:border-b-0 cursor-pointer group">
                <a href="{url}" class="block no-underline">
                    <div class="font-medium text-gray-900 dark:text-white group-hover:text-blue-600">{title}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">{subtitle}</div>
                </a>
            </li>'''
        
        note = f'<div id="command-results-note" class="p-4 text-center text-sm text-gray-500 dark:text-gray-400">Found {len(results)} results</div>'
        
        response_html = f'''
        <ul id="command-results-list" class="divide-y divide-gray-200 dark:divide-gray-700">
            {html_items}
        </ul>
        {note}'''
        
        return HttpResponse(response_html)
    
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
    
    def get_urls(self):
        from django.urls import path
        
        urls = super().get_urls()
        custom_urls = [
            path('search/', self.admin_view(self.search_view), name='search'),
        ]
        return custom_urls + urls
    
    
# Create the custom admin site instance
admin_site = StockHiveAdminSite(name="stockhive_admin")

# Import admin classes (without site=None registration)
from accounts.admin import UserAdmin
from inventory.admin import BusinessAdmin, ShopAdmin
from billing.admin import SubscriptionAdmin, MpesaPaymentAdmin
from alerts.admin import InAppNotificationAdmin, StockAlertAdmin, SupportTicketAdmin, WhatsAppConnectionAdmin

# Register models with the custom site
admin_site.register(User, UserAdmin)
admin_site.register(Business, BusinessAdmin)
admin_site.register(Shop, ShopAdmin)
admin_site.register(Subscription, SubscriptionAdmin)
admin_site.register(MpesaPayment, MpesaPaymentAdmin)
admin_site.register(InAppNotification, InAppNotificationAdmin)
admin_site.register(StockAlert, StockAlertAdmin)
admin_site.register(WhatsAppConnection, WhatsAppConnectionAdmin)
admin_site.register(SupportTicket, SupportTicketAdmin)

# Basic registrations
admin_site.register(Product)
admin_site.register(Sale)
admin_site.register(SaleItem)
admin_site.register(Category)
admin_site.register(StockEntry)
admin_site.register(StockAdjustment)
