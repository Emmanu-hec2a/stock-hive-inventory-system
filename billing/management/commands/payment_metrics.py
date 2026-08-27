"""
Management command to display payment metrics and analytics.
Phase 3: Enables admins to check payment health via CLI.
Usage: python manage.py payment_metrics
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from billing.monitoring import PaymentMetricsCollector


class Command(BaseCommand):
    help = "Display payment metrics and analytics"

    def add_arguments(self, parser):
        parser.add_argument(
            '--hours',
            type=int,
            default=24,
            help='Time window in hours (default: 24)'
        )
        parser.add_argument(
            '--month',
            type=str,
            help='Month in YYYY-MM format for revenue report'
        )
        parser.add_argument(
            '--plans',
            action='store_true',
            help='Show subscription breakdown by plan'
        )
        parser.add_argument(
            '--failures',
            action='store_true',
            help='Show failure breakdown by result code'
        )

    def handle(self, *args, **options):
        collector = PaymentMetricsCollector()
        hours = options['hours']

        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(self.style.SUCCESS(f"Payment Metrics Report ({hours}h window)"))
        self.stdout.write(self.style.SUCCESS("=" * 60))

        # Success Rate
        success_rate, total, success = collector.get_success_rate(hours)
        self.stdout.write(
            f"\n✓ Success Rate: {success_rate:.1f}% ({success}/{total} payments)"
        )

        # Conversion Rate
        conversion_rate, initiated, completed = collector.get_conversion_rate(hours)
        self.stdout.write(
            f"→ Conversion Rate: {conversion_rate:.1f}% ({completed}/{initiated} conversions)"
        )

        # Average Time
        avg_time = collector.get_average_time_to_completion(hours)
        self.stdout.write(f"⏱ Average Time to Completion: {avg_time:.0f} seconds")

        # Pending Payments
        pending = collector.get_pending_payment_count()
        self.stdout.write(f"⏳ Currently Pending: {pending} payments")

        # Stuck Payments
        stuck = collector.get_pending_payments_older_than_minutes(30)
        if stuck.count() > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"⚠️  Stuck Payments (>30min): {stuck.count()}"
                )
            )
            for payment in stuck[:5]:
                age_minutes = (timezone.now() - payment.created_at).total_seconds() / 60
                self.stdout.write(
                    f"    - {payment.checkout_request_id} ({age_minutes:.0f}min old, "
                    f"{payment.plan} plan, KES {payment.amount})"
                )

        # Show failure breakdown if requested
        if options['failures']:
            self.stdout.write("\n" + self.style.WARNING("Failure Breakdown by Result Code:"))
            failures = collector.get_failure_breakdown(hours)
            if failures:
                for code, count in sorted(failures.items()):
                    reason_map = {
                        1032: "Cancelled by user",
                        1037: "Timeout",
                        2001: "Invalid password",
                        1: "Insufficient funds",
                    }
                    reason = reason_map.get(code, "Unknown")
                    self.stdout.write(f"    Code {code}: {count} ({reason})")
            else:
                self.stdout.write("    No failures in this period")

        # Show plan breakdown if requested
        if options['plans']:
            self.stdout.write("\n" + self.style.SUCCESS("Active Subscriptions by Plan:"))
            plans = collector.get_subscriptions_by_plan()
            if plans:
                for plan, count in sorted(plans.items()):
                    self.stdout.write(f"    {plan}: {count} subscriptions")
            else:
                self.stdout.write("    No active subscriptions")

        # Show monthly revenue if requested
        if options['month']:
            try:
                year, month = map(int, options['month'].split('-'))
                revenue = collector.get_monthly_revenue(year, month)
                self.stdout.write(
                    f"\n💰 Revenue for {year}-{month:02d}: KES {revenue:,.2f}"
                )
            except ValueError:
                self.stdout.write(
                    self.style.ERROR("Invalid month format. Use YYYY-MM")
                )

        self.stdout.write("\n" + self.style.SUCCESS("=" * 60))
