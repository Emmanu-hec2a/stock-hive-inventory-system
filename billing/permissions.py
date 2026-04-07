from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from accounts.models import User
from billing.constants import PLAN_FEATURES, PLAN_LIMITS
from inventory.models import Product, Shop


class SubscriptionPermission(BasePermission):
    def has_permission(self, request, view):
        business = request.user.business
        subscription = getattr(business, "subscription", None)
        if not subscription or not subscription.is_active:
            raise PermissionDenied("Your subscription has expired. Please renew to continue.")
        return True


def require_feature(feature):
    class FeaturePermission(BasePermission):
        def has_permission(self, request, view):
            subscription = getattr(request.user.business, "subscription", None)
            plan = subscription.plan if subscription else "free"
            allowed = PLAN_FEATURES.get(plan, [])
            if "*" in allowed or feature in allowed:
                return True
            raise PermissionDenied(
                f"'{feature}' is not available on your current plan. Please upgrade."
            )

    return FeaturePermission


def can_use_feature(business, feature):
    subscription = getattr(business, "subscription", None)
    plan = subscription.plan if subscription else "free"
    allowed = PLAN_FEATURES.get(plan, [])
    return "*" in allowed or feature in allowed


def check_limit(business, resource):
    subscription = getattr(business, "subscription", None)
    plan = subscription.plan if subscription else "free"
    limit = PLAN_LIMITS.get(plan, {}).get(resource)

    if limit is None:
        return

    counts = {
        "products": Product.objects.filter(shop__business=business, is_active=True).count(),
        "shops": Shop.objects.filter(business=business, is_active=True).count(),
        "staff": User.objects.filter(business=business, is_active=True, is_superuser=False).count(),
    }

    if counts.get(resource, 0) >= limit:
        raise PermissionDenied(
            f"You have reached the {resource} limit for your plan ({limit}). Upgrade to add more."
        )
