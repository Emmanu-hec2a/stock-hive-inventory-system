from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError

from billing.constants import PLAN_LIMITS
from inventory.models import Shop


class ShopScopedMixin:
    """
    Scopes queryset and writes to user's assigned shop.
    Super admins must send ?shop_id for shop-scoped endpoints.
    """

    def get_shop(self):
        user = self.request.user

        if user.role == "super_admin":
            shop_id = self.request.query_params.get("shop_id")
            if not shop_id:
                raise ValidationError(
                    {"shop_id": "super_admin must provide ?shop_id query param."}
                )
            shop = get_object_or_404(Shop, id=shop_id, business=user.business)
            self._enforce_plan_scope(user, shop)
            return shop

        if not user.shop:
            raise PermissionDenied("User is not assigned to any shop.")
        if not user.shop.is_active:
            raise PermissionDenied("Assigned shop is inactive.")
        self._enforce_plan_scope(user, user.shop)
        return user.shop

    def _enforce_plan_scope(self, user, shop):
        subscription = getattr(user.business, "subscription", None)
        plan = subscription.plan if subscription else "free"
        shop_limit = PLAN_LIMITS.get(plan, {}).get("shops")
        if shop_limit is None:
            return
        active_shop_ids = list(
            Shop.objects.filter(business=user.business, is_active=True)
            .order_by("created_at")
            .values_list("id", flat=True)
        )
        writable_ids = set(active_shop_ids[:shop_limit])
        if shop.id not in writable_ids and self.request.method not in ("GET", "HEAD", "OPTIONS"):
            raise PermissionDenied(
                "This shop is read-only on your current plan. Upgrade to modify it."
            )

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.filter(shop=self.get_shop())


class AuditLogMixin:
    """
    Automatically records Create, Update, and Delete actions to AuditLog.
    """
    def perform_create(self, serializer):
        instance = serializer.save()
        self._log_action("create", instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        self._log_action("update", instance)

    def perform_destroy(self, instance):
        instance_id = str(instance.id)
        self._log_action("delete", instance)
        instance.delete()

    def _log_action(self, action, instance):
        from inventory.models import AuditLog
        
        # Get business and shop
        business = self.request.user.business
        shop = getattr(instance, 'shop', None)
        
        # Calculate changes for updates
        changes = None
        if action == "update":
            # This is a simplified version; for complex models, 
            # we'd compare serializer.initial_data with model_to_dict(instance)
            changes = {"info": "Record updated"}

        AuditLog.objects.create(
            user=self.request.user,
            business=business,
            shop=shop,
            action=action,
            model_name=instance.__class__.__name__,
            target_id=str(instance.id),
            changes=changes
        )
