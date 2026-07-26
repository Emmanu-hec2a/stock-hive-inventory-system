import re
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from accounts.models import User
from inventory.models import Business, Shop


class BusinessTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "email"

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["shop_id"] = str(user.shop_id) if user.shop_id else None
        token["business_id"] = str(user.business_id) if user.business_id else None
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        if user.role != "super_admin" and user.shop and not user.shop.is_active:
            raise serializers.ValidationError("Your assigned shop is inactive. Contact business admin.")
        data["user"] = {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "shop_id": str(user.shop_id) if user.shop_id else None,
            "business_id": str(user.business_id) if user.business_id else None,
        }
        return data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)
    business_name = serializers.CharField(write_only=True)
    shop_name = serializers.CharField(write_only=True, required=False)
    phone_number = serializers.CharField(required=True)

    class Meta:
        model = User
        fields = [
            "email",
            "full_name",
            "phone_number",
            "password",
            "password_confirm",
            "business_name",
            "shop_name",
        ]

    def validate_phone_number(self, value):
        # Regex for Kenyan phone numbers: 254... or 07... or 01...
        # Supports: 254712345678, 0712345678, 0112345678
        pattern = r"^(?:254|\+254|0)?(7|1)\d{8}$"
        if not re.match(pattern, value):
            raise serializers.ValidationError("Invalid Kenyan phone number format.")

        # Normalize to 254...
        clean = value.replace("+", "")
        if clean.startswith("0"):
            clean = "254" + clean[1:]
        elif not clean.startswith("254"):
            clean = "254" + clean

        return clean

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password": "Passwords do not match."})
        if User.objects.filter(email=attrs["email"]).exists():
            raise serializers.ValidationError({"email": "This email is already registered."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        business_name = validated_data.pop("business_name")
        shop_name = validated_data.pop("shop_name", business_name + " Main")

        # Create business
        business = Business.objects.create(name=business_name)

        # Create user as super_admin
        user = User.objects.create(**validated_data, role="super_admin", business=business)
        user.set_password(password)
        user.save()

        # Create default shop
        Shop.objects.create(business=business, name=shop_name, location="")

        # Subscription will be auto-created by signal
        return user
