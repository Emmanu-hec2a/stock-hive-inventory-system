import base64
from datetime import datetime

import requests
from django.conf import settings


def get_base_url():
    if getattr(settings, "MPESA_ENV", "sandbox") == "production":
        return "https://api.safaricom.co.ke"
    return "https://sandbox.safaricom.co.ke"


def get_access_token():
    credentials = base64.b64encode(
        f"{settings.MPESA_CONSUMER_KEY}:{settings.MPESA_CONSUMER_SECRET}".encode()
    ).decode()
    base_url = get_base_url()
    response = requests.get(
        f"{base_url}/oauth/v1/generate?grant_type=client_credentials",
        headers={"Authorization": f"Basic {credentials}"},
        timeout=30,
    )
    response.raise_for_status()
    return response.json().get("access_token")


def generate_password(shortcode, passkey, timestamp):
    return base64.b64encode(f"{shortcode}{passkey}{timestamp}".encode()).decode()


def stk_push(phone_number, amount, account_ref, description):
    access_token = get_access_token()
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = generate_password(settings.MPESA_SHORTCODE, settings.MPESA_PASSKEY, timestamp)
    base_url = get_base_url()
    payload = {
        "BusinessShortCode": settings.MPESA_SHORTCODE,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(amount),
        "PartyA": phone_number,
        "PartyB": settings.MPESA_SHORTCODE,
        "PhoneNumber": phone_number,
        "CallBackURL": settings.MPESA_CALLBACK_URL,
        "AccountReference": account_ref,
        "TransactionDesc": description,
    }
    response = requests.post(
        f"{base_url}/mpesa/stkpush/v1/processrequest",
        json=payload,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def query_stk_status(checkout_request_id):
    """
    Query the status of an STK push transaction via Safaricom Daraja.
    """
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

    return response.json()
