"""
Payment monitoring and metrics collection (Phase 3).
Tracks conversion rates, success rates, and latencies for analytics.
"""
import logging
from datetime import timedelta
from django.db.models import Count, Q, F, Avg
from django.utils import timezone
from billing.models import MpesaPayment

logger = logging.getLogger("billing.metrics")


class PaymentMetricsCollector:
    """Collect and report on payment processing metrics."""
    
    @staticmethod
    def get_success_rate(time_window_hours=24):
        """
        Calculate payment success rate over time window.
        Returns: (success_rate_percent, total_count, success_count)
        """
        cutoff_time = timezone.now() - timedelta(hours=time_window_hours)
        
        payments = MpesaPayment.objects.filter(
            created_at__gte=cutoff_time
        ).exclude(status=MpesaPayment.STATUS_PENDING)
        
        total_count = payments.count()
        if total_count == 0:
            return 0, 0, 0
        
        success_count = payments.filter(status=MpesaPayment.STATUS_SUCCESS).count()
        success_rate = (success_count / total_count) * 100
        
        return success_rate, total_count, success_count
    
    @staticmethod
    def get_conversion_rate(time_window_hours=24):
        """
        Calculate conversion rate: successful payments / initiated payments.
        Returns: (conversion_rate_percent, initiated_count, successful_count)
        """
        cutoff_time = timezone.now() - timedelta(hours=time_window_hours)
        
        initiated = MpesaPayment.objects.filter(created_at__gte=cutoff_time).count()
        if initiated == 0:
            return 0, 0, 0
        
        successful = MpesaPayment.objects.filter(
            created_at__gte=cutoff_time,
            status=MpesaPayment.STATUS_SUCCESS
        ).count()
        
        conversion_rate = (successful / initiated) * 100
        return conversion_rate, initiated, successful
    
    @staticmethod
    def get_average_time_to_completion(time_window_hours=24):
        """
        Calculate average time from payment initiation to completion.
        Returns: average_seconds
        """
        cutoff_time = timezone.now() - timedelta(hours=time_window_hours)
        
        completed = MpesaPayment.objects.filter(
            created_at__gte=cutoff_time
        ).exclude(status=MpesaPayment.STATUS_PENDING)
        
        if completed.count() == 0:
            return 0
        
        # Approximate by using updated_at - created_at
        durations = []
        for payment in completed:
            duration = (payment.updated_at - payment.created_at).total_seconds()
            durations.append(duration)
        
        return sum(durations) / len(durations) if durations else 0
    
    @staticmethod
    def get_failure_breakdown(time_window_hours=24):
        """
        Get breakdown of failure reasons.
        Returns: dict with result_code -> count
        """
        cutoff_time = timezone.now() - timedelta(hours=time_window_hours)
        
        failures = MpesaPayment.objects.filter(
            created_at__gte=cutoff_time,
            status=MpesaPayment.STATUS_FAILED,
            result_code__isnull=False
        )
        
        breakdown = {}
        for payment in failures:
            code = payment.result_code
            breakdown[code] = breakdown.get(code, 0) + 1
        
        return breakdown
    
    @staticmethod
    def get_pending_payment_count():
        """Get count of payments still pending (may indicate webhook delay)."""
        return MpesaPayment.objects.filter(
            status=MpesaPayment.STATUS_PENDING
        ).count()
    
    @staticmethod
    def get_pending_payments_older_than_minutes(minutes=30):
        """Get payments pending for more than X minutes (may be stuck)."""
        cutoff_time = timezone.now() - timedelta(minutes=minutes)
        return MpesaPayment.objects.filter(
            status=MpesaPayment.STATUS_PENDING,
            created_at__lt=cutoff_time
        )
    
    @staticmethod
    def get_monthly_revenue(year, month):
        """Get total revenue for a specific month (successful payments only)."""
        from django.db.models import Sum
        from datetime import date
        
        # Get first and last day of month
        first_day = date(year, month, 1)
        if month == 12:
            last_day = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)
        
        revenue = MpesaPayment.objects.filter(
            status=MpesaPayment.STATUS_SUCCESS,
            created_at__date__gte=first_day,
            created_at__date__lte=last_day
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        return revenue
    
    @staticmethod
    def get_subscriptions_by_plan():
        """Get count of active subscriptions by plan."""
        from billing.models import Subscription
        
        breakdown = {}
        plans = Subscription.objects.filter(
            status=Subscription.STATUS_ACTIVE
        ).values('plan').annotate(count=Count('id'))
        
        for item in plans:
            breakdown[item['plan']] = item['count']
        
        return breakdown


def log_daily_metrics():
    """
    Log daily metrics summary (can be called by scheduled task).
    """
    collector = PaymentMetricsCollector()
    
    success_rate, total, success = collector.get_success_rate(24)
    conversion_rate, initiated, completed = collector.get_conversion_rate(24)
    avg_time = collector.get_average_time_to_completion(24)
    pending_count = collector.get_pending_payment_count()
    
    logger.info(
        f"Daily Metrics: Success Rate={success_rate:.1f}% ({success}/{total}), "
        f"Conversion Rate={conversion_rate:.1f}% ({completed}/{initiated}), "
        f"Avg Time={avg_time:.0f}s, Pending={pending_count}"
    )
    
    # Check for stuck payments
    stuck_payments = collector.get_pending_payments_older_than_minutes(30)
    if stuck_payments.count() > 0:
        logger.warning(f"[ALERT] {stuck_payments.count()} payments pending >30 min (may be stuck)")
