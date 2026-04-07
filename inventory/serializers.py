from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from rest_framework import serializers

from accounts.models import User
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
from inventory.utils import get_current_stock


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = ["id", "name", "logo", "owner", "created_at"]
        read_only_fields = ["id", "owner", "created_at"]


class ShopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shop
        fields = ["id", "business", "name", "location", "phone", "is_active", "created_at"]
        read_only_fields = ["id", "business", "created_at"]


class StaffSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    shop_name = serializers.CharField(source="shop.name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "password",
            "full_name",
            "role",
            "business",
            "shop",
            "shop_name",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "business"]

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user
        role = attrs.get("role", getattr(self.instance, "role", None))
        shop = attrs.get("shop", getattr(self.instance, "shop", None))

        if user.role == "shop_admin":
            attrs["role"] = "cashier" if role == "super_admin" else role
            attrs["shop"] = user.shop
        elif user.role == "super_admin":
            if role != "super_admin" and not shop:
                raise serializers.ValidationError("shop is required for non-super_admin staff.")
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.business = self.context["request"].user.business
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "shop", "name"]
        read_only_fields = ["id", "shop"]


class ProductSerializer(serializers.ModelSerializer):
    current_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "shop",
            "category",
            "name",
            "sku",
            "buying_price",
            "selling_price",
            "unit",
            "image",
            "low_stock_threshold",
            "is_active",
            "created_at",
            "current_stock",
        ]
        read_only_fields = ["id", "shop", "created_at", "current_stock"]

    def get_current_stock(self, obj):
        return get_current_stock(obj)


class StockEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = StockEntry
        fields = [
            "id",
            "product",
            "shop",
            "quantity",
            "buying_price_at_entry",
            "supplier_name",
            "note",
            "entered_by",
            "created_at",
        ]
        read_only_fields = ["id", "shop", "entered_by", "created_at"]


class StockAdjustmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockAdjustment
        fields = ["id", "product", "shop", "quantity", "reason", "note", "adjusted_by", "created_at"]
        read_only_fields = ["id", "shop", "adjusted_by", "created_at"]


class SaleItemInputSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)

    def validate_product_id(self, value):
        if not value:
            raise serializers.ValidationError("Product ID cannot be empty.")
        return value


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = SaleItem
        fields = ["id", "product", "product_name", "quantity", "unit_price", "subtotal"]


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemInputSerializer(many=True, write_only=True)
    line_items = SaleItemSerializer(many=True, source="items", read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id",
            "shop",
            "served_by",
            "total_amount",
            "payment_method",
            "created_at",
            "items",
            "line_items",
        ]
        read_only_fields = ["id", "shop", "served_by", "total_amount", "created_at", "line_items"]

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("At least one sale item is required.")
        return items

    @transaction.atomic
    def create(self, validated_data):
        import logging
        logger = logging.getLogger(__name__)
        
        request = self.context["request"]
        shop = self.context["shop"]
        items_data = validated_data.pop("items")
        
        logger.info(f"Creating sale with {len(items_data)} items, payment: {validated_data['payment_method']}")

        sale = Sale.objects.create(shop=shop, served_by=request.user, payment_method=validated_data["payment_method"])
        total = Decimal("0.00")

        for item in items_data:
            logger.info(f"Processing item: product_id={item['product_id']}, qty={item['quantity']}")
            product = Product.objects.select_for_update().get(id=item["product_id"], shop=shop, is_active=True)
            qty = item["quantity"]

            current = get_current_stock(product)
            if qty > current:
                raise serializers.ValidationError(
                    f"Insufficient stock for {product.name}. Available: {current}, requested: {qty}."
                )

            unit_price = product.selling_price
            subtotal = unit_price * qty
            logger.info(f"Adding item: {product.name}, qty={qty}, unit_price={unit_price}, subtotal={subtotal}")
            SaleItem.objects.create(
                sale=sale,
                product=product,
                quantity=qty,
                unit_price=unit_price,
                subtotal=subtotal,
            )
            total += subtotal

        sale.total_amount = total
        sale.save(update_fields=["total_amount"])
        logger.info(f"Sale created: id={sale.id}, total_amount={total}")
        return sale


