from django.conf import settings
from django.http import HttpResponseForbidden


class AdminIPRestrictionMiddleware:
    """Restrict access to /system-admin/ to allowed IPs only."""
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.allowed_ips = getattr(settings, 'ADMIN_ALLOWED_IPS', ['127.0.0.1', 'https://stockhive-backend.up.railway.app/'])

    def __call__(self, request):
        if request.path.startswith('/system-admin/'):
            # Get client IP (handles proxies with X-Forwarded-For)
            ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
            if ',' in ip:
                ip = ip.split(',')[0].strip()
            else:
                ip = ip.strip()
            
            # Allow localhost for development
            if ip not in self.allowed_ips and ip != '127.0.0.1' and ip != '::1':
                return HttpResponseForbidden('Access to admin panel is restricted. Your IP is not whitelisted.')
        
        return self.get_response(request)
