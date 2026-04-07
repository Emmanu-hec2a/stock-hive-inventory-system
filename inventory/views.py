from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
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
from inventory.mixins import ShopScopedMixin
from inventory.models import (
    Business,
    Category,
    Product,
    Sale,
    Shop,
    StockAdjustment,
    StockEntry,
)
from inventory.permissions import CanRecordSales, IsSuperAdmin, IsSuperOrShopAdmin
from inventory.serializers import (
    BusinessSerializer,
    CategorySerializer,
    ProductSerializer,
    SaleSerializer,
    ShopSerializer,
    StaffSerializer,
    StockAdjustmentSerializer,
    StockEntrySerializer,
)
from inventory.utils import get_current_stock


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


class CategoryViewSet(ShopScopedMixin, viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, IsSuperOrShopAdmin, SubscriptionPermission]
    queryset = Category.objects.all()

    def perform_create(self, serializer):
        serializer.save(shop=self.get_shop())


class ProductViewSet(ShopScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated, IsSuperOrShopAdmin, SubscriptionPermission]
    queryset = Product.objects.filter(is_active=True)

    def perform_create(self, serializer):
        check_limit(self.request.user.business, "products")
        serializer.save(shop=self.get_shop())

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"])
    def stock(self, request, pk=None):
        product = self.get_object()
        return Response({"product_id": str(product.id), "current_stock": get_current_stock(product)})


class StockEntryViewSet(ShopScopedMixin, mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = StockEntrySerializer
    permission_classes = [IsAuthenticated, IsSuperOrShopAdmin, SubscriptionPermission]
    queryset = StockEntry.objects.select_related("product")

    def perform_create(self, serializer):
        serializer.save(shop=self.get_shop(), entered_by=self.request.user)


class StockAdjustmentViewSet(
    ShopScopedMixin, mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    serializer_class = StockAdjustmentSerializer
    permission_classes = [IsAuthenticated, IsSuperOrShopAdmin, SubscriptionPermission]
    queryset = StockAdjustment.objects.select_related("product")

    def perform_create(self, serializer):
        """Create stock adjustment and trigger alerts if quantity is negative."""
        adjustment = serializer.save(shop=self.get_shop(), adjusted_by=self.request.user)
        
        # Only trigger alerts on negative (removal) adjustments
        if adjustment.quantity < 0:
            from alerts.services import trigger_low_stock_alerts
            trigger_low_stock_alerts(adjustment.product)


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


class SaleViewSet(ShopScopedMixin, viewsets.ModelViewSet):
    serializer_class = SaleSerializer
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
        sale = serializer.save(shop=self.get_shop(), served_by=self.request.user)
        
        # Trigger low stock alerts for each product sold
        from alerts.services import trigger_low_stock_alerts
        for item in sale.items.all():
            trigger_low_stock_alerts(item.product)


class DashboardReportView(APIView, ShopScopedMixin):
    permission_classes = [IsAuthenticated, SubscriptionPermission]

    def get(self, request):
        shop = self.get_shop()
        
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
        for product in Product.objects.filter(shop=shop, is_active=True):
            current = get_current_stock(product)
            stock_value += product.buying_price * current
            if current <= product.low_stock_threshold:
                low_stock_count += 1
        return Response(
            {
                "total_sales_today": total_sales_today,
                "stock_value": stock_value,
                "low_stock_count": low_stock_count,
            }
        )


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
