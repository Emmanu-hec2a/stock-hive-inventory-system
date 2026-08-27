"""
Utilities for billing: logging, token caching, and monitoring.
"""
import logging
import json
from datetime import timedelta
from django.core.cache import cache
from django.conf import settings

# Set up dedicated payment logger
payment_logger = logging.getLogger("billing.payment")
webhook_logger = logging.getLogger("billing.webhook")
reconciliation_logger = logging.getLogger("billing.reconciliation")


def log_mpesa_request(endpoint, payload, method="POST"):
    """Log M-Pesa API request for debugging."""
    payment_logger.info(
        f"M-Pesa {method} {endpoint}",
        extra={
            "endpoint": endpoint,
            "payload": json.dumps(payload, default=str)[:500],  # Truncate to 500 chars
            "method": method
        }
    )


def log_mpesa_response(endpoint, response_code, status_code, response_data):
    """Log M-Pesa API response."""
    level = logging.INFO if status_code < 400 else logging.ERROR
    payment_logger.log(
        level,
        f"M-Pesa {endpoint} response: {response_code}",
        extra={
            "endpoint": endpoint,
            "status_code": status_code,
            "response_code": response_code,
            "response": json.dumps(response_data, default=str)[:500]
        }
    )


def log_webhook_received(checkout_request_id, payload, source_ip):
    """Log incoming webhook."""
    webhook_logger.info(
        f"Webhook received for {checkout_request_id}",
        extra={
            "checkout_request_id": checkout_request_id,
            "source_ip": source_ip,
            "payload": json.dumps(payload, default=str)[:500]
        }
    )


def log_webhook_processed(checkout_request_id, result_code, action):
    """Log webhook processing result."""
    webhook_logger.info(
        f"Webhook processed: {checkout_request_id}",
        extra={
            "checkout_request_id": checkout_request_id,
            "result_code": result_code,
            "action": action
        }
    )


def log_reconciliation_task(start_time, processed_count, success_count, error_count):
    """Log reconciliation task completion."""
    reconciliation_logger.info(
        f"Reconciliation task completed",
        extra={
            "duration_seconds": (start_time).total_seconds(),
            "processed": processed_count,
            "success": success_count,
            "errors": error_count
        }
    )


def cache_mpesa_access_token(token, ttl_seconds=1800):
    """
    Cache M-Pesa access token with TTL (default 30 minutes).
    M-Pesa tokens are valid for 30 minutes by default.
    """
    cache.set("mpesa_access_token", token, timeout=ttl_seconds)
    payment_logger.debug(f"Cached M-Pesa access token (TTL: {ttl_seconds}s)")


def get_cached_mpesa_access_token():
    """Retrieve cached M-Pesa access token if available."""
    token = cache.get("mpesa_access_token")
    if token:
        payment_logger.debug("Using cached M-Pesa access token")
    return token


def clear_mpesa_access_token():
    """Clear cached access token (e.g., on auth failure)."""
    cache.delete("mpesa_access_token")
    payment_logger.debug("Cleared cached M-Pesa access token")


# Metrics tracking (Phase 3)
class PaymentMetrics:
    """Track payment processing metrics."""
    
    @staticmethod
    def record_payment_initiated(plan, amount):
        """Record payment initiation for metrics."""
        payment_logger.info(
            "Payment initiated",
            extra={"event": "payment_initiated", "plan": plan, "amount": amount}
        )
    
    @staticmethod
    def record_payment_success(checkout_id, plan, amount, duration_seconds):
        """Record successful payment."""
        payment_logger.info(
            "Payment successful",
            extra={
                "event": "payment_success",
                "checkout_request_id": checkout_id,
                "plan": plan,
                "amount": amount,
                "duration_seconds": duration_seconds
            }
        )
    
    @staticmethod
    def record_payment_failed(checkout_id, plan, result_code, reason):
        """Record failed payment."""
        payment_logger.error(
            "Payment failed",
            extra={
                "event": "payment_failed",
                "checkout_request_id": checkout_id,
                "plan": plan,
                "result_code": result_code,
                "reason": reason
            }
        )
    
    @staticmethod
    def record_reconciliation_success(checkout_id, plan):
        """Record successful reconciliation."""
        reconciliation_logger.info(
            "Payment reconciled",
            extra={
                "event": "reconciliation_success",
                "checkout_request_id": checkout_id,
                "plan": plan
            }
        )
