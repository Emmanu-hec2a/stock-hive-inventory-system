from django.core.management.base import BaseCommand
from django.utils import timezone

from billing.models import Subscription


class Command(BaseCommand):
    help = "Expire subscriptions past their end date"

    def handle(self, *args, **kwargs):
        expired = Subscription.objects.filter(
            status=Subscription.STATUS_ACTIVE,
            end_date__isnull=False,
            end_date__lt=timezone.now().date(),
        )
        count = expired.update(status=Subscription.STATUS_EXPIRED)
        self.stdout.write(f"Expired {count} subscriptions.")
