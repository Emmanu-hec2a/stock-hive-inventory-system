from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'history', views.StockAlertHistoryViewSet, basename='alert-history')
router.register(r'tickets', views.SupportTicketViewSet, basename='support-tickets')

urlpatterns = [
    path('notifications/', views.NotificationListView.as_view(), name='notification-list'),
    path('notifications/<int:pk>/', views.NotificationDetailView.as_view(), name='notification-detail'),
    path('notifications/mark-all-read/', views.MarkAllNotificationsReadView.as_view(), name='mark-all-read'),
    path('notifications/unread-count/', views.UnreadNotificationCountView.as_view(), name='unread-count'),
    path('whatsapp/', views.WhatsAppConnectionView.as_view(), name='whatsapp-connection'),
    path('', include(router.urls)),
]
