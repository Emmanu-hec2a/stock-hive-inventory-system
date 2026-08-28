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
    permission_classes = [IsAuthenticated, SubscriptionPermission]
    queryset = Product.objects.filter(is_active=True)

    def get_permissions(self):
        """
        Allow cashiers to read products for sales entry.
        Restrict create/update/delete to inventory managers and above.
        """
        if self.action in ['list', 'retrieve']:
            # Cashiers can view products for sales entry
            return [IsAuthenticated(), SubscriptionPermission()]
        else:
            # Only inventory managers can modify products
            return [IsAuthenticated(), IsInventoryManager(), SubscriptionPermission()]

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

    @action(detail=False, methods=['post'])
    def clone_catalog(self, request):
        from .models import Shop, Product, StockEntry
        from .utils import get_current_stock
        business = request.user.business
        to_shop_id = request.data.get('to_shop_id')
        include_stock = request.data.get('include_stock', False)
        from_shop = self.get_shop() # From ShopScopedMixin
        
        if not to_shop_id:
            return Response({"error": "Destination shop is required."}, status=400)
            
        try:
            to_shop = Shop.objects.get(id=to_shop_id, business=business)
        except Shop.DoesNotExist:
            return Response({"error": "Invalid destination shop."}, status=400)
            
        if from_shop.id == to_shop.id:
            return Response({"error": "Source and destination shops must be different."}, status=400)

        cloned_count = 0
        stock_entries_count = 0
        with transaction.atomic():
            source_products = Product.objects.filter(shop=from_shop, is_active=True)
            for sp in source_products:
                # 1. Skip if the product already exists in the receiving branch
                if Product.objects.filter(shop=to_shop, sku=sp.sku).exists():
                    continue
                
                # 2. Copy only products that are NOT already in the receiving branch
                dest_product = Product.objects.create(
                    shop=to_shop,
                    sku=sp.sku,
                    name=sp.name,
                    barcode=sp.barcode,
                    buying_price=sp.buying_price,
                    selling_price=sp.selling_price,
                    unit=sp.unit,
                    low_stock_threshold=sp.low_stock_threshold
                )
                cloned_count += 1
                
                # 3. If include_stock is True, copy the quantity for these NEW items
                if include_stock:
                    current_qty = get_current_stock(sp)
                    if current_qty > 0:
                        StockEntry.objects.create(
                            product=dest_product,
                            shop=to_shop,
                            quantity=current_qty,
                            buying_price_at_entry=sp.buying_price,
                            note=f"Inventory clone from {from_shop.name}",
                            entered_by=request.user
                        )
                        stock_entries_count += 1
            
            # Invalidate dashboard cache
            cache.delete(f"dashboard_data_{to_shop.id}")

        msg = f"Successfully cloned {cloned_count} product definitions to {to_shop.name}."
        if include_stock:
            msg += f" Copied stock levels for {stock_entries_count} products."
            
        return Response({"message": msg})

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
    # Disable update/partial_update since sales are immutable
    http_method_names = ['get', 'post', 'head', 'options']

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
            self._log_action("create", sale)
            
            # Trigger low stock alerts for each product sold
            from alerts.services import trigger_low_stock_alerts
            for item in sale.items.all():
                trigger_low_stock_alerts(item.product)
            
            # Invalidate dashboard cache
            cache.delete(f"dashboard_data_{self.get_shop().id}")

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated, SubscriptionPermission])
    def receipt(self, request, pk=None):
        """Get receipt data for a sale (Pro/Enterprise only)"""
        from billing.permissions import require_feature
        
        # Check feature permission
        perm = require_feature('receipt_printing')()
        if not perm.has_permission(request, self):
            return Response(
                {"detail": "Receipt printing is not available on your current plan."},
                status=403
            )
        
        sale = self.get_object()
        
        # Format receipt data
        receipt_data = {
            'id': str(sale.id)[:8],  # Short ID for receipt
            'shop_name': sale.shop.name,
            'shop_location': sale.shop.location,
            'seller_name': sale.served_by.full_name if sale.served_by else 'N/A',
            'date': sale.created_at.isoformat(),
            'payment_method': sale.get_payment_method_display(),
            'items': [
                {
                    'product_name': item.product.name,
                    'sku': item.product.sku,
                    'quantity': item.quantity,
                    'unit_price': str(item.unit_price),
                    'subtotal': str(item.subtotal),
                }
                for item in sale.items.all()
            ],
            'total_items': sum(item.quantity for item in sale.items.all()),
            'total_amount': str(sale.total_amount),
        }
        
        return Response(receipt_data)


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

    @action(detail=False, methods=['post'])
    def bulk_transfer(self, request):
        from .models import Shop, Product, StockAdjustment, StockEntry, StockTransfer
        from .utils import get_current_stock
        from billing.permissions import can_use_feature
        
        business = request.user.business
        if not can_use_feature(business, 'stock_transfers'):
            raise PermissionDenied("Bulk stock transfers available on Pro plan and above.")
            
        to_shop_id = request.data.get('to_shop_id')
        from_shop = self.get_shop() # From ShopScopedMixin
        
        if not to_shop_id:
            return Response({"error": "Destination shop is required."}, status=400)
            
        try:
            to_shop = Shop.objects.get(id=to_shop_id, business=business)
        except Shop.DoesNotExist:
            return Response({"error": "Invalid destination shop."}, status=400)
            
        if from_shop.id == to_shop.id:
            return Response({"error": "Source and destination shops must be different."}, status=400)

        transferred_count = 0
        with transaction.atomic():
            products = Product.objects.filter(shop=from_shop, is_active=True)
            for product in products:
                current_qty = get_current_stock(product)
                if current_qty > 0:
                    # Find or create in destination
                    dest_product, _ = Product.objects.get_or_create(
                        shop=to_shop,
                        sku=product.sku,
                        defaults={
                            "name": product.name,
                            "barcode": product.barcode,
                            "buying_price": product.buying_price,
                            "selling_price": product.selling_price,
                            "unit": product.unit,
                        }
                    )
                    
                    # Log the transfer record
                    StockTransfer.objects.create(
                        product=product,
                        from_shop=from_shop,
                        to_shop=to_shop,
                        quantity=current_qty,
                        transferred_by=request.user,
                        note="Bulk inventory move"
                    )
                    
                    # Decrease source
                    StockAdjustment.objects.create(
                        product=product,
                        shop=from_shop,
                        quantity=-current_qty,
                        reason=StockAdjustment.REASON_OTHER,
                        note=f"Bulk transfer to {to_shop.name}",
                        adjusted_by=request.user
                    )
                    
                    # Increase destination
                    StockEntry.objects.create(
                        product=dest_product,
                        shop=to_shop,
                        quantity=current_qty,
                        buying_price_at_entry=product.buying_price,
                        note=f"Bulk transfer from {from_shop.name}",
                        entered_by=request.user
                    )
                    transferred_count += 1
            
            # Invalidate caches
            cache.delete(f"dashboard_data_{from_shop.id}")
            cache.delete(f"dashboard_data_{to_shop.id}")

        return Response({
            "message": f"Successfully transferred {transferred_count} products to {to_shop.name}."
        })

    def perform_create(self, serializer):
        business = self.request.user.business
        if not can_use_feature(business, 'stock_transfers'):
            raise PermissionDenied("Stock transfers available on Pro plan and above.")
        
        with transaction.atomic():
            transfer = serializer.save(transferred_by=self.request.user, from_shop=self.get_shop())
            super().perform_create(serializer)
            
            source_product = transfer.product
            
            # Find or create the product in the destination shop using SKU matching
            dest_product, created = Product.objects.get_or_create(
                shop=transfer.to_shop,
                sku=source_product.sku,
                defaults={
                    "name": source_product.name,
                    "barcode": source_product.barcode,
                    "buying_price": source_product.buying_price,
                    "selling_price": source_product.selling_price,
                    "unit": source_product.unit,
                }
            )
            
            # Create negative adjustment at source shop
            StockAdjustment.objects.create(
                product=source_product,
                shop=transfer.from_shop,
                quantity=-transfer.quantity,
                reason=StockAdjustment.REASON_OTHER,
                note=f"Transfer to {transfer.to_shop.name}. Ref: {transfer.reference}",
                adjusted_by=self.request.user
            )
            
            # Create stock entry at destination shop using the matched/cloned product
            StockEntry.objects.create(
                product=dest_product,
                shop=transfer.to_shop,
                quantity=transfer.quantity,
                buying_price_at_entry=source_product.buying_price,
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
