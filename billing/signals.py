from datetime import date

from django.db.models.signals import post_save
from django.dispatch import receiver

from billing.models import Subscription
from inventory.models import Business


@receiver(post_save, sender=Business)
def create_default_subscription(sender, instance, created, **kwargs):
    if created:
        Subscription.objects.get_or_create(
            business=instance,
            defaults={
                "plan": Subscription.PLAN_FREE,
                "status": Subscription.STATUS_ACTIVE,
                "start_date": date.today(),
                "end_date": None,
                "auto_renew": True,
            },
        )
