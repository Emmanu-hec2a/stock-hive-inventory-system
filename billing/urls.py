from django.urls import path

from billing.views import (
    BillingHistoryView,
    CancelAutoRenewView,
    InitiateSubscriptionView,
    MpesaCallbackView,
    PaymentStatusView,
    SubscriptionDetailView,
)

urlpatterns = [
    path("subscribe/", InitiateSubscriptionView.as_view(), name="billing-subscribe"),
    path("mpesa/callback/", MpesaCallbackView.as_view(), name="billing-mpesa-callback"),
    path("status/<str:checkout_request_id>/", PaymentStatusView.as_view(), name="billing-status"),
    path("subscription/", SubscriptionDetailView.as_view(), name="billing-subscription"),
    path("history/", BillingHistoryView.as_view(), name="billing-history"),
    path("cancel/", CancelAutoRenewView.as_view(), name="billing-cancel"),
]
