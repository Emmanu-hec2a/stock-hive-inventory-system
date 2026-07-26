from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import F, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.core.cache import cache
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from billing.permissions import (
    SubscriptionPermission,
    can_use_feature,
    check_limit,
)
from inventory.mixins import ShopScopedMixin, AuditLogMixin
from inventory.models import (
    Business,
    Category,
    Product,
    Sale,
    Shop,
    StockAdjustment,
    StockEntry,
    Supplier,
    AuditLog,
)
from inventory.permissions import CanRecordSales, IsSuperAdmin, IsSuperOrShopAdmin, IsInventoryManager
from inventory.models import StockTransfer
from inventory.serializers import (
    BusinessSerializer,
    CategorySerializer,
    ProductSerializer,
    ProductExportSerializer,
    SaleSerializer,
    SaleExportSerializer,
    ShopSerializer,
    StaffSerializer,
    StockAdjustmentSerializer,
    StockEntrySerializer,
    StockTransferSerializer,
    SupplierSerializer,
    AuditLogSerializer,
)
from inventory.utils import get_current_stock
from billing.permissions import require_feature, SubscriptionPermission
# from rest_framework_csv.renderers import CSVRenderer  # Native CSV impl below


class ExportMixin:
    def get_export_queryset(self):
        shop = self.get_shop() if hasattr(self, 'get_shop') else None
        queryset = self.get_queryset()
        if shop:
            queryset = queryset.filter(shop=shop)
        return queryset

    @action(detail=False, methods=['get'])
    def export(self, request, *args, **kwargs):
        if not can_use_feature(request.user.business, 'export_csv'):
            raise PermissionDenied("Export available on Basic plan and above.")
        
        export_format = request.query_params.get('export_format', kwargs.get('format', 'csv')).lower()
        if export_format not in ('csv', 'json'):
            return Response({'error': 'Format must be csv or json'}, status=400)
        
        queryset = self.get_export_queryset()
        serializer = self.export_serializer_class(queryset, many=True)
        
        if export_format == 'csv':
            from django.http import HttpResponse
            import csv
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="{self.model.__name__.lower()}_{timezone.now().strftime("%Y%m%d")}.csv"'
            
            writer = csv.DictWriter(response, fieldnames=serializer.child.fields.keys())
            writer.writeheader()
            for row in serializer.data:
                writer.writerow(row)
            return response
        
        response = Response(serializer.data)
        response['Content-Disposition'] = f'attachment; filename="{self.model.__name__.lower()}_{timezone.now().strftime("%Y%m%d")}.json"'
        return response


class BusinessView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin, SubscriptionPermission]

    def get(self, request):
        serializer = BusinessSerializer(request.user.business)
        return Response(serializer.data)

    def put(self, request):
        serializer = BusinessSerializer(request.user.business, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, IsSuperOrShopAdmin, require_feature("suppliers"), SubscriptionPermission]

    def get_queryset(self):
        return Supplier.objects.filter(business=self.request.user.business, is_active=True)

    def perform_create(self, serializer):
        serializer.save(business=self.request.user.business)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ShopViewSet(viewsets.ModelViewSet):
    serializer_class = ShopSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin, SubscriptionPermission]

    def get_queryset(self):
        return Shop.objects.filter(business=self.request.user.business)

    def perform_create(self, serializer):
        business = self.request.user.business
        if not can_use_feature(business, "multi_branch"):
            raise PermissionDenied("'multi_branch' is not available on your current plan. Please upgrade.")
        check_limit(business, "shops")
        serializer.save(business=self.request.user.business)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class StaffViewSet(viewsets.ModelViewSet):
    serializer_class = StaffSerializer
    permission_classes = [IsAuthenticated, IsSuperOrShopAdmin, SubscriptionPermission]

    def get_queryset(self):
        user = self.request.user
        if not user.business:
            return User.objects.none()
        queryset = User.objects.filter(business=user.business, is_superuser=False)
        if user.role == "shop_admin":
            queryset = queryset.filter(shop=user.shop)
        return queryset

    def perform_create(self, serializer):
        check_limit(self.request.user.business, "staff")
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        staff = self.get_object()
        staff.is_active = False
        staff.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class CategoryViewSet(ShopScopedMixin, AuditLogMixin, viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, IsInventoryManager, SubscriptionPermission]
    queryset = Category.objects.all()

    def perform_create(self, serializer):
        with transaction.atomic():
            serializer.save(shop=self.get_shop())
            super().perform_create(serializer)


class ProductViewSet(ExportMixin, ShopScopedMixin, AuditLogMixin, viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    export_serializer_class = ProductExportSerializer
    model = Product
    permission_classes = [IsAuthenticated, IsInventoryManager, SubscriptionPermission]
    queryset = Product.objects.filter(is_active=True)

    def perform_create(self, serializer):
        check_limit(self.request.user.business, "products")
        if serializer.validated_data.get("barcode") and not can_use_feature(self.request.user.business, "barcodes"):
            raise PermissionDenied("Barcode support is available on Basic plans and above.")

        with transaction.atomic():
            serializer.save(shop=self.get_shop())
            super().perform_create(serializer)
            # Invalidate dashboard cache
            cache.delete(f"dashboard_data_{self.get_shop().id}")

    def perform_update(self, serializer):
        serializer.save()
        super().perform_update(serializer)
        # Invalidate dashboard cache
        cache.delete(f"dashboard_data_{self.get_shop().id}")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        # Invalidate dashboard cache
        cache.delete(f"dashboard_data_{self.get_shop().id}")
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"])
    def stock(self, request, pk=None):
        product = self.get_object()
        return Response({"product_id": str(product.id), "current_stock": get_current_stock(product)})

    def get_queryset(self):
        queryset = super().get_queryset()
        barcode = self.request.query_params.get("barcode")
        if barcode:
            queryset = queryset.filter(barcode=barcode)
        return queryset


class StockEntryViewSet(ShopScopedMixin, AuditLogMixin, mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = StockEntrySerializer
    permission_classes = [IsAuthenticated, IsInventoryManager, SubscriptionPermission]
    queryset = StockEntry.objects.select_related("product")

    def perform_create(self, serializer):
        with transaction.atomic():
            serializer.save(shop=self.get_shop(), entered_by=self.request.user)
            super().perform_create(serializer)
            # Invalidate dashboard cache
            cache.delete(f"dashboard_data_{self.get_shop().id}")


class StockAdjustmentViewSet(
    ShopScopedMixin, AuditLogMixin, mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    serializer_class = StockAdjustmentSerializer
    permission_classes = [IsAuthenticated, IsInventoryManager, SubscriptionPermission]
    queryset = StockAdjustment.objects.select_related("product")

    def perform_create(self, serializer):
        """Create stock adjustment and trigger alerts if quantity is negative."""
        with transaction.atomic():
            adjustment = serializer.save(shop=self.get_shop(), adjusted_by=self.request.user)
            super().perform_create(serializer)
            
            # Only trigger alerts on negative (removal) adjustments
            if adjustment.quantity < 0:
                from alerts.services import trigger_low_stock_alerts
                trigger_low_stock_alerts(adjustment.product)
            
            # Invalidate dashboard cache
            cache.delete(f"dashboard_data_{self.get_shop().id}")


class LowStockView(APIView, ShopScopedMixin):
    permission_classes = [IsAuthenticated, SubscriptionPermission]

    def get(self, request):
        shop = self.get_shop()
        data = []
        for product in Product.objects.filter(shop=shop, is_active=True):
            current_stock = get_current_stock(product)
            if current_stock <= product.low_stock_threshold:
                data.append(
                    {
                        "product_id": str(product.id),
                        "name": product.name,
                        "sku": product.sku,
                        "current_stock": current_stock,
                        "threshold": product.low_stock_threshold,
                    }
                )
        return Response(data)


class SaleViewSet(ExportMixin, ShopScopedMixin, AuditLogMixin, viewsets.ModelViewSet):
    serializer_class = SaleSerializer
    export_serializer_class = SaleExportSerializer
    model = Sale
    permission_classes = [IsAuthenticated, CanRecordSales, SubscriptionPermission]
    queryset = Sale.objects.prefetch_related("items__product")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["shop"] = self.get_shop()
        return context

    def get_queryset(self):
        queryset = super().get_queryset()
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        return queryset

    def perform_create(self, serializer):
        """Record sale and trigger low stock alerts for products sold."""
        with transaction.atomic():
            sale = serializer.save(shop=self.get_shop(), served_by=self.request.user)
            super().perform_create(serializer)
            
            # Trigger low stock alerts for each product sold
            from alerts.services import trigger_low_stock_alerts
            for item in sale.items.all():
                trigger_low_stock_alerts(item.product)
            
            # Invalidate dashboard cache
            cache.delete(f"dashboard_data_{self.get_shop().id}")


class DashboardReportView(APIView, ShopScopedMixin):
    permission_classes = [IsAuthenticated, SubscriptionPermission]

    def get(self, request):
        shop = self.get_shop()
        cache_key = f"dashboard_data_{shop.id}"
        cached_data = cache.get(cache_key)
        
        if cached_data:
            return Response(cached_data)

        # Use timezone-aware date for proper filtering
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        total_sales_today = (
            Sale.objects.filter(shop=shop, created_at__gte=today_start, created_at__lt=today_end).aggregate(total=Sum("total_amount"))["total"]
            or Decimal("0.00")
        )
        stock_value = Decimal("0.00")
        low_stock_count = 0
        stock_levels = []
        products = Product.objects.filter(shop=shop, is_active=True)
        for product in products:
            current = get_current_stock(product)
            stock_value += product.buying_price * current
            if current <= product.low_stock_threshold:
                low_stock_count += 1
            stock_levels.append(
                {
                    "id": str(product.id),
                    "name": product.name,
                    "sku": product.sku,
                    "unit": product.unit,
                    "current_stock": current,
                    "low_stock_threshold": product.low_stock_threshold,
                }
            )

        stock_levels.sort(key=lambda item: (-item["current_stock"], item["name"].lower()))
        recent_sales = [
            {
                "id": str(sale.id),
                "created_at": sale.created_at,
                "cashier_name": sale.served_by.full_name if sale.served_by and sale.served_by.full_name else "Unknown staff",
                "total_amount": sale.total_amount,
                "payment_method": sale.payment_method,
            }
            for sale in Sale.objects.filter(shop=shop).select_related("served_by").order_by("-created_at")[:5]
        ]
        
        report_data = {
            "total_sales_today": total_sales_today,
            "stock_value": stock_value,
            "low_stock_count": low_stock_count,
            "product_count": products.count(),
            "recent_sales": recent_sales,
            "stock_levels": stock_levels[:4],
        }
        
        # Cache for 5 minutes
        cache.set(cache_key, report_data, 300)
        
        return Response(report_data)


class SalesReportView(APIView, ShopScopedMixin):
    permission_classes = [IsAuthenticated, SubscriptionPermission]

    def get(self, request):
        shop = self.get_shop()
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        queryset = Sale.objects.filter(shop=shop)
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        grouped = queryset.annotate(day=TruncDate("created_at")).values("day").annotate(total=Sum("total_amount"))
        return Response(list(grouped))


class ProductReportView(APIView, ShopScopedMixin):
    permission_classes = [IsAuthenticated, SubscriptionPermission]

    def get(self, request):
        shop = self.get_shop()
        data = (
            Product.objects.filter(shop=shop, is_active=True)
            .annotate(total_qty_sold=Sum("sale_items__quantity"))
            .values("id", "name", "sku", "total_qty_sold")
            .order_by("-total_qty_sold")[:10]
        )
        return Response(list(data))


class StockValueReportView(APIView):
    permission_classes = [IsAuthenticated, SubscriptionPermission]

    def get(self, request):
        user = request.user
        shops = Shop.objects.filter(business=user.business)
        if user.role != "super_admin":
            shops = shops.filter(id=user.shop_id)

        response = []
        for shop in shops:
            total = Decimal("0.00")
            for product in Product.objects.filter(shop=shop, is_active=True):
                total += product.buying_price * get_current_stock(product)
            response.append({"shop_id": str(shop.id), "shop_name": shop.name, "stock_value": total})
        return Response(response)


class StockTransferViewSet(ShopScopedMixin, AuditLogMixin, mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = StockTransferSerializer
    permission_classes = [IsAuthenticated, IsInventoryManager, require_feature('stock_transfers'), SubscriptionPermission]
    queryset = StockTransfer.objects.select_related('product', 'from_shop', 'to_shop', 'transferred_by')

    def get_queryset(self):
        user = self.request.user
        shop_ids = [user.shop.id] if user.shop else []
        if user.role in ('super_admin', 'shop_admin'):
            shop_ids += list(Shop.objects.filter(business=user.business).values_list('id', flat=True))
        return self.queryset.filter(from_shop_id__in=shop_ids)

    def perform_create(self, serializer):
        business = self.request.user.business
        if not can_use_feature(business, 'stock_transfers'):
            raise PermissionDenied("Stock transfers available on Pro plan and above.")
        
        with transaction.atomic():
            transfer = serializer.save(transferred_by=self.request.user, from_shop=self.get_shop())
            super().perform_create(serializer)
            
            # Create negative adjustment at source shop
            StockAdjustment.objects.create(
                product=transfer.product,
                shop=transfer.from_shop,
                quantity=-transfer.quantity,
                reason=StockAdjustment.REASON_OTHER,
                note=f"Transfer to {transfer.to_shop.name}. Ref: {transfer.reference}",
                adjusted_by=self.request.user
            )
            
            # Create stock entry at destination shop
            StockEntry.objects.create(
                product=transfer.product,
                shop=transfer.to_shop,
                quantity=transfer.quantity,
                buying_price_at_entry=transfer.product.buying_price,
                note=f"Transfer from {transfer.from_shop.name}. Ref: {transfer.reference}",
                entered_by=self.request.user
            )
            
            # Invalidate dashboard cache for both shops
            cache.delete(f"dashboard_data_{transfer.from_shop.id}")
            cache.delete(f"dashboard_data_{transfer.to_shop.id}")


class SupplierSpendReportView(APIView):
    permission_classes = [IsAuthenticated, require_feature("suppliers"), SubscriptionPermission]

    def get(self, request):
        business = request.user.business
        
        # Aggregate spend per supplier for this business
        spend_data = (
            StockEntry.objects.filter(shop__business=business)
            .values("supplier__id", "supplier__name")
            .annotate(
                total_spend=Sum(F("quantity") * F("buying_price_at_entry"))
            )
            .order_by("-total_spend")
        )
        
        return Response(list(spend_data))


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsSuperOrShopAdmin, require_feature("audit_logs"), SubscriptionPermission]

    def get_queryset(self):
        return AuditLog.objects.filter(business=self.request.user.business)


class OverviewReportView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin, SubscriptionPermission]

    def get(self, request):
        from datetime import date
        
        shops = Shop.objects.filter(business=request.user.business, is_active=True)
        
        # Monthly revenue (current month)
        today = timezone.now()
        month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month = month_start + timedelta(days=32)
        next_month = next_month.replace(day=1)
        
        total_revenue_month = (
            Sale.objects.filter(
                shop__in=shops,
                created_at__gte=month_start,
                created_at__lt=next_month
            ).aggregate(total=Sum("total_amount")).get("total") or Decimal("0.00")
        )
        
        # Previous month revenue (for percentage change)
        prev_month_start = month_start - timedelta(days=1)
        prev_month_start = prev_month_start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_month_end = month_start
        
        prev_month_revenue = (
            Sale.objects.filter(
                shop__in=shops,
                created_at__gte=prev_month_start,
                created_at__lt=prev_month_end
            ).aggregate(total=Sum("total_amount")).get("total") or Decimal("0.00")
        )
        
        # Calculate percentage change
        revenue_change = None
        if prev_month_revenue > 0:
            revenue_change = round(((total_revenue_month - prev_month_revenue) / prev_month_revenue) * 100, 1)
        
        # Stock value and low stock across all shops
        total_stock_value = Decimal("0.00")
        total_low_stock = 0
        
        shop_data = []
        for shop in shops:
            shop_revenue = (
                Sale.objects.filter(shop=shop).aggregate(total=Sum("total_amount")).get("total") or Decimal("0.00")
            )
            shop_products = Product.objects.filter(shop=shop, is_active=True)
            shop_product_count = shop_products.count()
            
            shop_stock_value = Decimal("0.00")
            shop_low_stock = 0
            for product in shop_products:
                current = get_current_stock(product)
                shop_stock_value += product.buying_price * current
                if current <= product.low_stock_threshold:
                    shop_low_stock += 1
            
            total_stock_value += shop_stock_value
            total_low_stock += shop_low_stock
            
            shop_data.append({
                "id": str(shop.id),
                "name": shop.name,
                "location": shop.location,
                "total_revenue": float(shop_revenue),
                "product_count": shop_product_count,
                "stock_value": float(shop_stock_value),
                "low_stock_count": shop_low_stock,
            })
        
        return Response(
            {
                "total_revenue_month": float(total_revenue_month),
                "total_stock_value": float(total_stock_value),
                "total_low_stock": total_low_stock,
                "active_shops": shops.count(),
                "revenue_change": revenue_change,
                "shops": shop_data,
            }
        )
