from django.db.models import Sum

from inventory.models import Product, SaleItem, StockAdjustment, StockEntry


def get_current_stock(product: Product) -> int:
    entries = StockEntry.objects.filter(product=product).aggregate(total=Sum("quantity"))[
        "total"
    ] or 0
    sold = SaleItem.objects.filter(product=product).aggregate(total=Sum("quantity"))["total"] or 0
    adjusted = StockAdjustment.objects.filter(product=product).aggregate(total=Sum("quantity"))[
        "total"
    ] or 0
    return entries + adjusted - sold
