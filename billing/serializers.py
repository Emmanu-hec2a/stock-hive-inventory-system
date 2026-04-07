from rest_framework import serializers

from billing.models import MpesaPayment, Subscription


class SubscriptionSerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = Subscription
        fields = [
            "id",
            "plan",
            "status",
            "start_date",
            "end_date",
            "auto_renew",
            "is_active",
            "created_at",
            "updated_at",
        ]


class MpesaPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MpesaPayment
        fields = [
            "id",
            "plan",
            "amount",
            "phone_number",
            "checkout_request_id",
            "mpesa_receipt",
            "status",
            "result_code",
            "result_desc",
            "created_at",
        ]
