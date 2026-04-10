class AdminIPRestrictionMiddleware:
    """Allow all IPs to access /system-admin/ while maintaining the middleware structure."""
    
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Simply return the response without checking the IP
        return self.get_response(request)
