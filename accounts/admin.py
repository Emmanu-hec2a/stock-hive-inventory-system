from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from unfold.admin import ModelAdmin
from unfold.decorators import display, action

from accounts.models import User


class UserAdmin(ModelAdmin):
    list_display = [
        "full_name", "email", "display_role",
        "shop_name", "display_status", "created_at"
    ]
    list_filter = ["role", "is_active"]
    search_fields = ["email", "full_name", "shop__name", "business__name"]
    readonly_fields = ["created_at", "last_login"]
    ordering = ["-created_at"]

    fieldsets = (
        ("Personal Info", {
            "fields": ("full_name", "email", "password")
        }),
        ("Role & Access", {
            "fields": ("role", "business", "shop", "is_active")
        }),
        ("Permissions", {
            "fields": ("is_staff", "is_superuser", "groups", "user_permissions"),
            "classes": ("collapse",)
        }),
        ("Meta", {
            "fields": ("created_at", "last_login"),
            "classes": ("collapse",)
        }),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "full_name", "role", "business", "shop", "password1", "password2"),
        }),
    )

    @display(description="Role", label=True)
    def display_role(self, obj):
        colors = {
            "super_admin": "green",
            "shop_admin": "amber",
            "cashier": "blue"
        }
        label = obj.role.replace("_", " ").title()
        return label, colors.get(obj.role, "gray")

    @display(description="Shop")
    def shop_name(self, obj):
        return obj.shop.name if obj.shop else "— (Owner)"

    @display(description="Status", label=True)
    def display_status(self, obj):
        return ("ACTIVE", "green") if obj.is_active else ("INACTIVE", "red")

    @action(description="Deactivate selected users")
    def deactivate_users(self, request, queryset):
        queryset.exclude(id=request.user.id).update(is_active=False)
        self.message_user(request, "Selected users deactivated.")

    @action(description="Activate selected users")
    def activate_users(self, request, queryset):
        queryset.update(is_active=True)
        self.message_user(request, "Selected users activated.")

    actions = ["deactivate_users", "activate_users"]

