"""
Webhook security and validation utilities for M-Pesa payments.
"""
import hashlib
import logging
from django.conf import settings
from rest_framework.exceptions import ValidationError

logger = logging.getLogger("billing.security")


def verify_mpesa_webhook_ip(client_ip):
    """
    Verify incoming webhook is from Safaricom M-Pesa IP addresses.
    
    M-Pesa production IPs: 196.201.214.0/24 and 196.201.215.0/24
    M-Pesa sandbox IPs: 196.201.214.0/24
    """
    # For now, allow localhost for testing; in production, enable IP whitelist
    mpesa_ips = getattr(settings, "MPESA_ALLOWED_IPS", ["127.0.0.1", "::1"])
    
    if client_ip not in mpesa_ips:
        logger.warning(f"Webhook received from unauthorized IP: {client_ip}")
        return False
    
    return True


def verify_mpesa_signature(payload, signature):
    """
    Verify M-Pesa callback signature using MD5 hash.
    
    M-Pesa signs callbacks with: MD5(payload + secretkey)
    This is optional but recommended for production.
    """
    secret_key = getattr(settings, "MPESA_SECRET_KEY", None)
    if not secret_key:
        logger.warning("MPESA_SECRET_KEY not configured; skipping signature verification")
        return True  # Skip if not configured
    
    # Reconstruct signature
    import json
    if isinstance(payload, dict):
        payload_str = json.dumps(payload, separators=(',', ':'), sort_keys=True)
    else:
        payload_str = str(payload)
    
    expected_sig = hashlib.md5(f"{payload_str}{secret_key}".encode()).hexdigest()
    
    if expected_sig != signature:
        logger.error(f"Signature verification failed: expected {expected_sig}, got {signature}")
        return False
    
    return True


def validate_mpesa_callback_payload(data):
    """
    Validate M-Pesa STK callback payload structure.
    
    Raises ValidationError if payload is malformed.
    """
    required_keys = ["Body"]
    body_keys = ["stkCallback"]
    stk_keys = ["CheckoutRequestID", "ResultCode", "ResultDesc"]
    
    # Top-level validation
    if not isinstance(data, dict):
        raise ValidationError("Payload must be a JSON object")
    
    if "Body" not in data:
        raise ValidationError("Missing required field: Body")
    
    body = data["Body"]
    if not isinstance(body, dict):
        raise ValidationError("Body must be a JSON object")
    
    if "stkCallback" not in body:
        raise ValidationError("Missing required field: stkCallback")
    
    stk = body["stkCallback"]
    if not isinstance(stk, dict):
        raise ValidationError("stkCallback must be a JSON object")
    
    # Validate required STK callback fields
    for key in stk_keys:
        if key not in stk:
            raise ValidationError(f"Missing required field in stkCallback: {key}")
    
    # Validate field types
    if not isinstance(stk["CheckoutRequestID"], str):
        raise ValidationError("CheckoutRequestID must be a string")
    
    if not isinstance(stk["ResultCode"], int):
        raise ValidationError("ResultCode must be an integer")
    
    if not isinstance(stk["ResultDesc"], str):
        raise ValidationError("ResultDesc must be a string")
    
    # If ResultCode is 0 (success), validate CallbackMetadata
    if stk["ResultCode"] == 0:
        if "CallbackMetadata" not in stk:
            raise ValidationError("Missing CallbackMetadata for successful transaction")
        
        metadata = stk["CallbackMetadata"]
        if not isinstance(metadata, dict) or "Item" not in metadata:
            raise ValidationError("Invalid CallbackMetadata structure")
        
        items = metadata["Item"]
        if not isinstance(items, list):
            raise ValidationError("CallbackMetadata.Item must be a list")
    
    logger.info(f"Callback payload validation passed for CheckoutRequestID: {stk['CheckoutRequestID']}")
    return True


def get_client_ip(request):
    """
    Extract client IP address from request, accounting for proxies.
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip
