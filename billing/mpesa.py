import base64
import logging
from datetime import datetime

import requests
from django.conf import settings
from tenacity import retry, stop_after_attempt, wait_exponential

from billing.utils import (
    log_mpesa_request,
    log_mpesa_response,
    cache_mpesa_access_token,
    get_cached_mpesa_access_token,
    clear_mpesa_access_token,
)

logger = logging.getLogger("billing.payment")


def get_base_url():
    if getattr(settings, "MPESA_ENV", "sandbox") == "production":
        return "https://api.safaricom.co.ke"
    return "https://sandbox.safaricom.co.ke"


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True
)
def get_access_token():
    """
    Get M-Pesa OAuth access token with retry logic.
    Checks cache first to reduce API calls (tokens valid 30 min).
    """
    # Try cache first
    cached_token = get_cached_mpesa_access_token()
    if cached_token:
        return cached_token
    
    credentials = base64.b64encode(
        f"{settings.MPESA_CONSUMER_KEY}:{settings.MPESA_CONSUMER_SECRET}".encode()
    ).decode()
    base_url = get_base_url()
    url = f"{base_url}/oauth/v1/generate?grant_type=client_credentials"
    
    log_mpesa_request("oauth/v1/generate", {}, "GET")
    
    try:
        response = requests.get(
            url,
            headers={"Authorization": f"Basic {credentials}"},
            timeout=30,
        )
        response.raise_for_status()
        token = response.json().get("access_token")
        
        log_mpesa_response("oauth/v1/generate", "0", response.status_code, {"token": "***"})
        
        # Cache token for 30 minutes (M-Pesa default validity)
        if token:
            cache_mpesa_access_token(token, ttl_seconds=1800)
        
        return token
    except requests.exceptions.RequestException as e:
        log_mpesa_response("oauth/v1/generate", "error", getattr(e.response, "status_code", 0), {"error": str(e)})
        clear_mpesa_access_token()
        raise


def generate_password(shortcode, passkey, timestamp):
    return base64.b64encode(f"{shortcode}{passkey}{timestamp}".encode()).decode()


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True
)
def stk_push(phone_number, amount, account_ref, description):
    """
    Initiate M-Pesa STK push with retry logic.
    """
    try:
        access_token = get_access_token()
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password = generate_password(settings.MPESA_SHORTCODE, settings.MPESA_PASSKEY, timestamp)
        base_url = get_base_url()
        
        payload = {
            "BusinessShortCode": settings.MPESA_SHORTCODE,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerBuyGoodsOnline",
            "Amount": int(amount),
            "PartyA": phone_number,
            "PartyB": "1615931",
            "PhoneNumber": phone_number,
            "CallBackURL": settings.MPESA_CALLBACK_URL,
            "AccountReference": account_ref,
            "TransactionDesc": description,
        }
        
        log_mpesa_request("mpesa/stkpush/v1/processrequest", payload)
        
        response = requests.post(
            f"{base_url}/mpesa/stkpush/v1/processrequest",
            json=payload,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30,
        )
        response.raise_for_status()
        
        response_data = response.json()
        log_mpesa_response(
            "mpesa/stkpush/v1/processrequest",
            response_data.get("ResponseCode"),
            response.status_code,
            response_data
        )
        
        return response_data
    except requests.exceptions.RequestException as e:
        log_mpesa_response(
            "mpesa/stkpush/v1/processrequest",
            "error",
            getattr(e.response, "status_code", 0),
            {"error": str(e)}
        )
        raise



@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True
)
def query_stk_status(checkout_request_id):
    """
    Query the status of an STK push transaction via Safaricom Daraja.
    Includes retry logic for transient failures.
    """
    try:
        access_token = get_access_token()
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password = generate_password(settings.MPESA_SHORTCODE, settings.MPESA_PASSKEY, timestamp)
        base_url = get_base_url()
        
        payload = {
            "BusinessShortCode": settings.MPESA_SHORTCODE,
            "Password": password,
            "Timestamp": timestamp,
            "CheckoutRequestID": checkout_request_id,
        }
        
        log_mpesa_request("mpesa/stkpushquery/v1/query", payload)
        
        response = requests.post(
            f"{base_url}/mpesa/stkpushquery/v1/query",
            json=payload,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30,
        )
        
        # Safaricom returns 404 or 500 for some valid "not found" scenarios, 
        # so we handle status codes carefully
        if response.status_code >= 500:
            response.raise_for_status()
        
        response_data = response.json()
        log_mpesa_response(
            "mpesa/stkpushquery/v1/query",
            response_data.get("ResultCode"),
            response.status_code,
            response_data
        )
        
        return response_data
    except requests.exceptions.RequestException as e:
        log_mpesa_response(
            "mpesa/stkpushquery/v1/query",
            "error",
            getattr(e.response, "status_code", 0),
            {"error": str(e)}
        )
        raise

