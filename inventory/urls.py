from django.urls import include, path
from rest_framework.routers import DefaultRouter

from inventory.views import (
    BusinessView,
    CategoryViewSet,
    DashboardReportView,
    LowStockView,
    OverviewReportView,
    ProductReportView,
    ProductViewSet,
    SaleViewSet,
    SalesReportView,
    ShopViewSet,
    StaffViewSet,
    StockAdjustmentViewSet,
    StockEntryViewSet,
    StockTransferViewSet,
    StockValueReportView,
    SupplierSpendReportView,
    SupplierViewSet,
    AuditLogViewSet,
)
from inventory.bulk_import import bulk_import_products, confirm_bulk_import
from inventory.product_utils import lookup_barcode, suggest_categories
from inventory.analytics import (
    sales_analytics,
    inventory_analytics,
    products_analytics,
    profit_analytics,
    staff_analytics,
)

router = DefaultRouter()
router.register("suppliers", SupplierViewSet, basename="suppliers")
router.register("shops", ShopViewSet, basename="shops")
router.register("staff", StaffViewSet, basename="staff")
router.register("products", ProductViewSet, basename="products")
router.register("categories", CategoryViewSet, basename="categories")
router.register("stock/entries", StockEntryViewSet, basename="stock-entries")
router.register("stock/adjustments", StockAdjustmentViewSet, basename="stock-adjustments")
router.register("stock/transfers", StockTransferViewSet, basename="stock-transfers")
router.register("sales", SaleViewSet, basename="sales")

urlpatterns = [
    path("business/", BusinessView.as_view(), name="business"),
    path("stock/low/", LowStockView.as_view(), name="stock-low"),
    path("reports/dashboard/", DashboardReportView.as_view(), name="report-dashboard"),
    path("reports/sales/", SalesReportView.as_view(), name="report-sales"),
    path("reports/products/", ProductReportView.as_view(), name="report-products"),
    path("reports/stock-value/", StockValueReportView.as_view(), name="report-stock-value"),
    path("reports/supplier-spend/", SupplierSpendReportView.as_view(), name="report-supplier-spend"),
    path("reports/overview/", OverviewReportView.as_view(), name="report-overview"),
    path("audit-logs/", AuditLogViewSet.as_view({"get": "list"}), name="audit-logs"),
    # Bulk Import
    path("products/bulk-import/preview/", bulk_import_products, name="bulk-import-preview"),
    path("products/bulk-import/confirm/", confirm_bulk_import, name="bulk-import-confirm"),
    # Product Utilities
    path("products/lookup/barcode/", lookup_barcode, name="lookup-barcode"),
    path("products/suggest/categories/", suggest_categories, name="suggest-categories"),
    # Advanced Analytics Endpoints
    path("analytics/sales/", sales_analytics, name="analytics-sales"),
    path("analytics/inventory/", inventory_analytics, name="analytics-inventory"),
    path("analytics/products/", products_analytics, name="analytics-products"),
    path("analytics/profit/", profit_analytics, name="analytics-profit"),
    path("analytics/staff/", staff_analytics, name="analytics-staff"),
    path("", include(router.urls)),
]
