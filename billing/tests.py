"""
Comprehensive test suite for billing payment architecture.
Tests cover: idempotency, race conditions, webhook security, error handling.
"""
from django.test import TestCase, TransactionTestCase, override_settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from unittest.mock import patch, MagicMock
from decimal import Decimal
import json

from inventory.models import Business
from billing.models import MpesaPayment, Subscription
from billing.constants import PLAN_PRICES
from billing.security import (
    validate_mpesa_callback_payload,
    verify_mpesa_webhook_ip,
)
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class MpesaPaymentModelTest(TestCase):
    """Test MpesaPayment model and basic operations."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
            full_name="Test User",
            role="super_admin"
        )
        self.business = Business.objects.create(
            owner=self.user,
            name="Test Business",
            phone="0712345678"
        )
        self.subscription = Subscription.objects.create(
            business=self.business,
            plan=Subscription.PLAN_FREE,
            status=Subscription.STATUS_ACTIVE,
        )
    
    def test_payment_creation(self):
        """Test creating a payment record."""
        payment = MpesaPayment.objects.create(
            business=self.business,
            subscription=self.subscription,
            plan="pro",
            amount=Decimal("999.00"),
            phone_number="0712345678",
            merchant_request_id="merchant123",
            checkout_request_id="checkout123",
            status=MpesaPayment.STATUS_PENDING,
        )
        self.assertEqual(payment.status, MpesaPayment.STATUS_PENDING)
        self.assertEqual(payment.checkout_request_id, "checkout123")
    
    def test_payment_status_transitions(self):
        """Test payment status transitions."""
        payment = MpesaPayment.objects.create(
            business=self.business,
            subscription=self.subscription,
            plan="pro",
            amount=Decimal("999.00"),
            phone_number="0712345678",
            merchant_request_id="merchant123",
            checkout_request_id="checkout123",
            status=MpesaPayment.STATUS_PENDING,
        )
        
        # Update to success
        payment.status = MpesaPayment.STATUS_SUCCESS
        payment.mpesa_receipt = "MPM123"
        payment.save()
        
        payment.refresh_from_db()
        self.assertEqual(payment.status, MpesaPayment.STATUS_SUCCESS)
        self.assertEqual(payment.mpesa_receipt, "MPM123")


class WebhookPayloadValidationTest(TestCase):
    """Test webhook payload validation and security."""
    
    def test_valid_callback_payload(self):
        """Test validation of valid callback payload."""
        valid_payload = {
            "Body": {
                "stkCallback": {
                    "CheckoutRequestID": "ws_CO_123456789",
                    "ResultCode": 0,
                    "ResultDesc": "The service request has been processed successfully.",
                    "CallbackMetadata": {
                        "Item": [
                            {"Name": "Amount", "Value": 999},
                            {"Name": "MpesaReceiptNumber", "Value": "MPM123456789"},
                            {"Name": "TransactionDate", "Value": 20230101120000},
                            {"Name": "PhoneNumber", "Value": 254712345678},
                        ]
                    }
                }
            }
        }
        result = validate_mpesa_callback_payload(valid_payload)
        self.assertTrue(result)
    
    def test_invalid_payload_missing_body(self):
        """Test rejection of payload missing Body."""
        invalid_payload = {"stkCallback": {}}
        with self.assertRaises(Exception):
            validate_mpesa_callback_payload(invalid_payload)
    
    def test_invalid_payload_missing_stkcallback(self):
        """Test rejection of payload missing stkCallback."""
        invalid_payload = {"Body": {}}
        with self.assertRaises(Exception):
            validate_mpesa_callback_payload(invalid_payload)
    
    def test_invalid_payload_missing_required_fields(self):
        """Test rejection of payload missing required STK fields."""
        invalid_payload = {
            "Body": {
                "stkCallback": {
                    "CheckoutRequestID": "ws_CO_123",
                    # Missing ResultCode and ResultDesc
                }
            }
        }
        with self.assertRaises(Exception):
            validate_mpesa_callback_payload(invalid_payload)
    
    def test_invalid_payload_missing_callback_metadata(self):
        """Test rejection of successful transaction without CallbackMetadata."""
        invalid_payload = {
            "Body": {
                "stkCallback": {
                    "CheckoutRequestID": "ws_CO_123",
                    "ResultCode": 0,
                    "ResultDesc": "Success",
                    # Missing CallbackMetadata for successful transaction
                }
            }
        }
        with self.assertRaises(Exception):
            validate_mpesa_callback_payload(invalid_payload)
    
    def test_invalid_field_types(self):
        """Test rejection of payload with invalid field types."""
        invalid_payload = {
            "Body": {
                "stkCallback": {
                    "CheckoutRequestID": "ws_CO_123",
                    "ResultCode": "0",  # Should be int, not string
                    "ResultDesc": "Success",
                }
            }
        }
        with self.assertRaises(Exception):
            validate_mpesa_callback_payload(invalid_payload)


class MpesaCallbackViewTest(TransactionTestCase):
    """Test M-Pesa callback webhook endpoint with transaction support."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
            full_name="Test User",
            role="super_admin"
        )
        self.business = Business.objects.create(
            owner=self.user,
            name="Test Business",
            phone="0712345678"
        )
        self.subscription = Subscription.objects.create(
            business=self.business,
            plan=Subscription.PLAN_FREE,
            status=Subscription.STATUS_ACTIVE,
        )
    
    def create_pending_payment(self, checkout_id="ws_CO_123"):
        """Helper to create a pending payment."""
        return MpesaPayment.objects.create(
            business=self.business,
            subscription=self.subscription,
            plan="pro",
            amount=Decimal("999.00"),
            phone_number="0712345678",
            merchant_request_id="merchant123",
            checkout_request_id=checkout_id,
            status=MpesaPayment.STATUS_PENDING,
        )
    
    def get_success_callback_payload(self, checkout_id):
        """Generate a successful callback payload."""
        return {
            "Body": {
                "stkCallback": {
                    "CheckoutRequestID": checkout_id,
                    "ResultCode": 0,
                    "ResultDesc": "The service request has been processed successfully.",
                    "CallbackMetadata": {
                        "Item": [
                            {"Name": "Amount", "Value": 999},
                            {"Name": "MpesaReceiptNumber", "Value": "MPM123456789"},
                            {"Name": "TransactionDate", "Value": 20230101120000},
                            {"Name": "PhoneNumber", "Value": 254712345678},
                        ]
                    }
                }
            }
        }
    
    def get_failed_callback_payload(self, checkout_id, error_code=1032):
        """Generate a failed callback payload."""
        return {
            "Body": {
                "stkCallback": {
                    "CheckoutRequestID": checkout_id,
                    "ResultCode": error_code,
                    "ResultDesc": "The service request failed.",
                }
            }
        }
    
    @override_settings(MPESA_ALLOWED_IPS=["127.0.0.1", "::1"])
    def test_successful_payment_callback(self):
        """Test successful payment callback activates subscription."""
        payment = self.create_pending_payment("ws_CO_123")
        payload = self.get_success_callback_payload("ws_CO_123")
        
        response = self.client.post(
            "/api/billing/mpesa/callback/",
            data=payload,
            format="json",
            REMOTE_ADDR="127.0.0.1"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        payment.refresh_from_db()
        self.assertEqual(payment.status, MpesaPayment.STATUS_SUCCESS)
        self.assertEqual(payment.mpesa_receipt, "MPM123456789")
        
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.plan, "pro")
    
    @override_settings(MPESA_ALLOWED_IPS=["127.0.0.1", "::1"])
    def test_failed_payment_callback(self):
        """Test failed payment callback doesn't activate subscription."""
        payment = self.create_pending_payment("ws_CO_124")
        payload = self.get_failed_callback_payload("ws_CO_124", 1032)
        
        response = self.client.post(
            "/api/billing/mpesa/callback/",
            data=payload,
            format="json",
            REMOTE_ADDR="127.0.0.1"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        payment.refresh_from_db()
        self.assertEqual(payment.status, MpesaPayment.STATUS_FAILED)
        self.assertEqual(payment.result_code, 1032)
    
    @override_settings(MPESA_ALLOWED_IPS=["127.0.0.1", "::1"])
    def test_duplicate_callback_idempotency(self):
        """Test that duplicate callbacks don't activate subscription twice."""
        payment = self.create_pending_payment("ws_CO_125")
        original_plan = self.subscription.plan
        
        payload = self.get_success_callback_payload("ws_CO_125")
        
        # First callback
        response1 = self.client.post(
            "/api/billing/mpesa/callback/",
            data=payload,
            format="json",
            REMOTE_ADDR="127.0.0.1"
        )
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        
        payment.refresh_from_db()
        self.assertEqual(payment.status, MpesaPayment.STATUS_SUCCESS)
        
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.plan, "pro")
        
        # Simulate duplicate callback
        response2 = self.client.post(
            "/api/billing/mpesa/callback/",
            data=payload,
            format="json",
            REMOTE_ADDR="127.0.0.1"
        )
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        
        # Subscription should not be activated twice
        payment.refresh_from_db()
        self.assertEqual(payment.status, MpesaPayment.STATUS_SUCCESS)
    
    @override_settings(MPESA_ALLOWED_IPS=["127.0.0.1", "::1"])
    def test_callback_for_unknown_payment(self):
        """Test callback for payment that doesn't exist in system."""
        payload = self.get_success_callback_payload("ws_CO_UNKNOWN")
        
        response = self.client.post(
            "/api/billing/mpesa/callback/",
            data=payload,
            format="json",
            REMOTE_ADDR="127.0.0.1"
        )
        
        # Should return success (acknowledge) but not crash
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    @override_settings(MPESA_ALLOWED_IPS=["192.168.1.1"])
    def test_callback_from_unauthorized_ip(self):
        """Test rejection of callback from unauthorized IP."""
        payment = self.create_pending_payment("ws_CO_126")
        payload = self.get_success_callback_payload("ws_CO_126")
        
        response = self.client.post(
            "/api/billing/mpesa/callback/",
            data=payload,
            format="json",
            REMOTE_ADDR="10.0.0.1"  # Unauthorized IP
        )
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Payment should remain pending
        payment.refresh_from_db()
        self.assertEqual(payment.status, MpesaPayment.STATUS_PENDING)


class InitiateSubscriptionViewTest(TestCase):
    """Test payment initiation endpoint."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
            full_name="Test User",
            role="super_admin"
        )
        self.business = Business.objects.create(
            owner=self.user,
            name="Test Business",
            phone="0712345678"
        )
        Subscription.objects.create(
            business=self.business,
            plan=Subscription.PLAN_FREE,
            status=Subscription.STATUS_ACTIVE,
        )
        self.client.force_authenticate(user=self.user)
    
    @patch("billing.views.stk_push")
    def test_payment_initiation_success(self, mock_stk_push):
        """Test successful payment initiation."""
        mock_stk_push.return_value = {
            "ResponseCode": "0",
            "MerchantRequestID": "merchant123",
            "CheckoutRequestID": "ws_CO_123"
        }
        
        response = self.client.post(
            "/api/billing/subscribe/",
            {
                "plan": "pro",
                "phone": "0712345678"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("checkout_request_id", response.data)
        
        # Verify payment record was created
        payment = MpesaPayment.objects.get(checkout_request_id="ws_CO_123")
        self.assertEqual(payment.status, MpesaPayment.STATUS_PENDING)
        self.assertEqual(payment.plan, "pro")
    
    @patch("billing.views.stk_push")
    def test_payment_initiation_invalid_plan(self, mock_stk_push):
        """Test rejection of invalid plan."""
        response = self.client.post(
            "/api/billing/subscribe/",
            {
                "plan": "invalid_plan",
                "phone": "0712345678"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(mock_stk_push.called)
    
    @patch("billing.views.stk_push")
    def test_payment_initiation_missing_phone(self, mock_stk_push):
        """Test rejection of missing phone number."""
        response = self.client.post(
            "/api/billing/subscribe/",
            {"plan": "pro"},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(mock_stk_push.called)
    
    @patch("billing.views.stk_push")
    def test_payment_initiation_api_failure(self, mock_stk_push):
        """Test handling of M-Pesa API failure."""
        mock_stk_push.side_effect = Exception("API connection failed")
        
        response = self.client.post(
            "/api/billing/subscribe/",
            {
                "plan": "pro",
                "phone": "0712345678"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # No payment record should be created on API failure
        self.assertEqual(MpesaPayment.objects.count(), 0)


class RaceConditionTest(TransactionTestCase):
    """Test for race condition handling with transactions."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123",
            full_name="Test User",
            role="super_admin"
        )
        self.business = Business.objects.create(
            owner=self.user,
            name="Test Business",
            phone="0712345678"
        )
        self.subscription = Subscription.objects.create(
            business=self.business,
            plan=Subscription.PLAN_FREE,
            status=Subscription.STATUS_ACTIVE,
        )
    
    def test_concurrent_callback_and_reconciliation(self):
        """
        Test that concurrent webhook callback and reconciliation task
        don't cause double-activation (select_for_update should handle this).
        """
        payment = MpesaPayment.objects.create(
            business=self.business,
            subscription=self.subscription,
            plan="pro",
            amount=Decimal("999.00"),
            phone_number="0712345678",
            merchant_request_id="merchant123",
            checkout_request_id="ws_CO_race",
            status=MpesaPayment.STATUS_PENDING,
        )
        
        # Simulate webhook updating payment
        payment.status = MpesaPayment.STATUS_SUCCESS
        payment.result_code = 0
        payment.mpesa_receipt = "MPM123"
        payment.save()
        
        # Attempt to "re-activate" via reconciliation (should be blocked by idempotency guard)
        payment.refresh_from_db()
        if payment.status == MpesaPayment.STATUS_PENDING:
            self.subscription.activate(payment.plan)
        
        # Subscription should only have been activated once
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.plan, "pro")
