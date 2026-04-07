class ShopIsolationMiddleware:
    """
    Attaches current_shop to request for non-DRF flows.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            request.current_shop = getattr(user, "shop", None)
        else:
            request.current_shop = None
        return self.get_response(request)
