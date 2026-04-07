import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_SUPER_ADMIN = "super_admin"
    ROLE_SHOP_ADMIN = "shop_admin"
    ROLE_CASHIER = "cashier"
    ROLE_CHOICES = [
        (ROLE_SUPER_ADMIN, "Super Admin"),
        (ROLE_SHOP_ADMIN, "Shop Admin"),
        (ROLE_CASHIER, "Cashier"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_CASHIER)
    business = models.ForeignKey(
        "inventory.Business",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="users",
    )
    shop = models.ForeignKey(
        "inventory.Shop",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff",
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    objects = UserManager()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.email

    def clean(self):
        super().clean()
        if self.role == self.ROLE_SUPER_ADMIN:
            self.shop = None
