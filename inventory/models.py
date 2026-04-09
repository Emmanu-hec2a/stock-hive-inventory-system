import uuid

from django.db import models
from django.utils import timezone


class Business(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    logo = models.ImageField(upload_to="business_logos/", null=True, blank=True)
    owner = models.OneToOneField(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="owned_business",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class Shop(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="shops")
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
    phone = models.CharField(max_length=30, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("business", "name")

    def __str__(self):
        return f"{self.name} ({self.business.name})"


class Category(models.Model):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=120)

    class Meta:
        unique_together = ("shop", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


class Product(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="products")
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="products"
    )
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=120)
    buying_price = models.DecimalField(max_digits=12, decimal_places=2)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2)
    unit = models.CharField(max_length=50)
    image = models.ImageField(upload_to="product_images/", null=True, blank=True)
    low_stock_threshold = models.PositiveIntegerField(default=10)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("shop", "sku")

    def __str__(self):
        return self.name


class StockEntry(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_entries")
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="stock_entries")
    quantity = models.PositiveIntegerField()
    buying_price_at_entry = models.DecimalField(max_digits=12, decimal_places=2)
    supplier_name = models.CharField(max_length=255, null=True, blank=True)
    note = models.TextField(null=True, blank=True)
    entered_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="entered_stocks"
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]


class StockAdjustment(models.Model):
    REASON_DAMAGED = "damaged"
    REASON_EXPIRED = "expired"
    REASON_CORRECTION = "correction"
    REASON_THEFT = "theft"
    REASON_OTHER = "other"
    REASON_CHOICES = [
        (REASON_DAMAGED, "Damaged"),
        (REASON_EXPIRED, "Expired"),
        (REASON_CORRECTION, "Correction"),
        (REASON_THEFT, "Theft"),
        (REASON_OTHER, "Other"),
    ]

    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="stock_adjustments"
    )
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="stock_adjustments")
    quantity = models.IntegerField()
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    note = models.TextField(null=True, blank=True)
    adjusted_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="stock_adjustments"
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]


class Sale(models.Model):
    PAYMENT_CASH = "cash"
    PAYMENT_MPESA = "mpesa"
    PAYMENT_CREDIT = "credit"
    PAYMENT_CHOICES = [
        (PAYMENT_CASH, "Cash"),
        (PAYMENT_MPESA, "M-Pesa"),
        (PAYMENT_CREDIT, "Credit"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="sales")
    served_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="served_sales"
    )
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_CHOICES)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]


class StockTransfer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="stock_transfers")
    from_shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="outgoing_transfers")
    to_shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="incoming_transfers")
    quantity = models.PositiveIntegerField()
    reference = models.CharField(max_length=100, blank=True, null=True)
    note = models.TextField(blank=True, null=True)
    transferred_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="stock_transfers"
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.quantity} {self.product.name} from {self.from_shop.name} to {self.to_shop.name}"


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="sale_items")
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["id"]
