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
    Supplier,
    AuditLog,
)
from inventory.models import StockTransfer
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


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "business", "name", "email", "phone", "address", "is_active", "created_at"]
        read_only_fields = ["id", "business", "created_at"]


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    shop_name = serializers.CharField(source="shop.name", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user",
            "user_name",
            "shop",
            "shop_name",
            "action",
            "model_name",
            "target_id",
            "changes",
            "created_at",
        ]


class ProductSerializer(serializers.ModelSerializer):
    current_stock = serializers.SerializerMethodField()
    initial_stock = serializers.IntegerField(write_only=True, required=False, min_value=0, help_text="Set initial stock quantity for the product")

    class Meta:
        model = Product
        fields = [
            "id",
            "shop",
            "category",
            "name",
            "sku",
            "barcode",
            "buying_price",
            "selling_price",
            "unit",
            "image",
            "low_stock_threshold",
            "is_active",
            "created_at",
            "current_stock",
            "initial_stock",
        ]
        read_only_fields = ["id", "shop", "created_at", "current_stock"]

    def get_current_stock(self, obj):
        return get_current_stock(obj)


class StockEntrySerializer(serializers.ModelSerializer):
    supplier_display_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = StockEntry
        fields = [
            "id",
            "product",
            "shop",
            "quantity",
            "buying_price_at_entry",
            "supplier",
            "supplier_display_name",
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
    payment_method = serializers.ChoiceField(
        choices=["cash", "mpesa", "credit"],
        required=False,
        default="cash",
        help_text="Payment method for this item (supports split billing)"
    )

    def validate_product_id(self, value):
        if not value:
            raise serializers.ValidationError("Product ID cannot be empty.")
        return value


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    payment_method_display = serializers.CharField(source="get_payment_method_display", read_only=True)

    class Meta:
        model = SaleItem
        fields = ["id", "product", "product_name", "quantity", "unit_price", "subtotal", "payment_method", "payment_method_display"]


class StockTransferSerializer(serializers.ModelSerializer):
    from_shop_name = serializers.CharField(source="from_shop.name", read_only=True)
    to_shop_name = serializers.CharField(source="to_shop.name", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = StockTransfer
        fields = [
            "id",
            "product",
            "product_name",
            "product_sku",
            "from_shop",
            "from_shop_name",
            "to_shop",
            "to_shop_name",
            "quantity",
            "reference",
            "note",
            "transferred_by",
            "created_at",
        ]
        read_only_fields = ["id", "transferred_by", "created_at"]


class ProductExportSerializer(serializers.ModelSerializer):
    current_stock = serializers.SerializerMethodField()
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    category_name = serializers.CharField(source="category.name", default="", allow_null=True)

    class Meta:
        model = Product
        fields = ["sku", "barcode", "name", "shop_name", "category_name", "buying_price", "selling_price", "unit", "current_stock", "low_stock_threshold"]

    def get_current_stock(self, obj):
        return get_current_stock(obj)


class SaleExportSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    served_by_name = serializers.CharField(source="served_by.full_name", default="", allow_null=True)
    items_data = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = ["created_at", "shop_name", "total_amount", "payment_method", "served_by_name", "items_data"]

    def get_items_data(self, obj):
        return [{"name": item.product.name, "sku": item.product.sku, "qty": item.quantity, "price": item.unit_price, "subtotal": item.subtotal, "payment": item.payment_method} for item in obj.items.all()]


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemInputSerializer(many=True, write_only=True)
    line_items = SaleItemSerializer(many=True, source="items", read_only=True)
    discount_display = serializers.SerializerMethodField()

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
            "discount_type",
            "discount_value",
            "discount_reason",
            "discount_display",
        ]
        read_only_fields = ["id", "shop", "served_by", "total_amount", "created_at", "line_items", "discount_given_by"]

    def get_discount_display(self, obj):
        """Format discount for display"""
        if not obj.discount_value:
            return None
        
        if obj.discount_type == 'percent':
            return f"{obj.discount_value}% off"
        else:
            return f"KES {obj.discount_value:.2f} off"

    def validate_discount(self, data):
        """Validate discount values"""
        discount_type = data.get("discount_type")
        discount_value = data.get("discount_value")
        
        # Both must be provided or both must be None
        if (discount_type and not discount_value) or (discount_value and not discount_type):
            raise serializers.ValidationError("Both discount_type and discount_value must be provided together.")
        
        if discount_value is not None:
            if discount_value < 0:
                raise serializers.ValidationError("Discount value cannot be negative.")
            
            if discount_type == 'percent' and discount_value > 100:
                raise serializers.ValidationError("Discount percentage cannot exceed 100%.")
        
        return data

    @transaction.atomic
    def create(self, validated_data):
        import logging
        logger = logging.getLogger(__name__)
        
        request = self.context["request"]
        shop = self.context["shop"]
        items_data = validated_data.pop("items")
        
        # Extract discount fields
        discount_type = validated_data.pop("discount_type", None)
        discount_value = validated_data.pop("discount_value", None)
        discount_reason = validated_data.pop("discount_reason", None)
        
        logger.info(f"Creating sale with {len(items_data)} items, payment: {validated_data['payment_method']}, discount: {discount_type}/{discount_value}")

        # VALIDATE ALL ITEMS FIRST before creating any records
        validated_items = []
        subtotal = Decimal("0.00")
        
        for item in items_data:
            logger.info(f"Validating item: product_id={item['product_id']}, qty={item['quantity']}")
            product = Product.objects.select_for_update().get(id=item["product_id"], shop=shop, is_active=True)
            qty = item["quantity"]
            payment_method = item.get("payment_method", "cash")
            
            current = get_current_stock(product)
            if qty > current:
                raise serializers.ValidationError(
                    f"Insufficient stock for '{product.name}'. Available: {current}, requested: {qty}."
                )
            
            if qty <= 0:
                raise serializers.ValidationError(
                    f"Quantity for '{product.name}' must be greater than 0."
                )
            
            unit_price = product.selling_price
            item_subtotal = unit_price * qty
            
            validated_items.append({
                'product': product,
                'quantity': qty,
                'unit_price': unit_price,
                'subtotal': item_subtotal,
                'payment_method': payment_method,
            })
            subtotal += item_subtotal
        
        # Calculate final total with discount
        final_total = subtotal
        if discount_type and discount_value:
            if discount_type == 'percent':
                discount_amount = subtotal * (Decimal(discount_value) / Decimal(100))
            else:  # fixed
                discount_amount = Decimal(discount_value)
            
            final_total = subtotal - discount_amount
            if final_total < 0:
                final_total = Decimal("0.00")
        
        # Create the sale
        sale = Sale.objects.create(
            shop=shop, 
            served_by=request.user, 
            payment_method=validated_data["payment_method"],
            total_amount=final_total,
            discount_type=discount_type,
            discount_value=discount_value,
            discount_reason=discount_reason,
            discount_given_by=request.user if discount_type else None,
        )
        
        # Create sale items
        for item in validated_items:
            logger.info(f"Adding item: {item['product'].name}, qty={item['quantity']}, unit_price={item['unit_price']}, subtotal={item['subtotal']}, payment={item['payment_method']}")
            SaleItem.objects.create(
                sale=sale,
                product=item['product'],
                quantity=item['quantity'],
                unit_price=item['unit_price'],
                subtotal=item['subtotal'],
                payment_method=item['payment_method'],
            )
        
        logger.info(f"Sale created: id={sale.id}, subtotal={subtotal}, discount={discount_type}/{discount_value}, final={final_total}")
        return sale

    def update(self, instance, validated_data):
        """
        Sales are immutable after creation.
        Raise error if update is attempted.
        """
        raise serializers.ValidationError(
            "Sales cannot be modified after creation. Create a new sale instead."
        )


