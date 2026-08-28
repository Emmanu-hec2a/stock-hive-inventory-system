"""
Product Lookup and Smart Suggestions
Barcode auto-fill and category suggestions for product entry
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from inventory.models import Product, Category
from billing.permissions import SubscriptionPermission, require_feature
from inventory.serializers import ProductSerializer
from inventory.mixins import ShopScopedMixin


class TempMixin(ShopScopedMixin):
    def __init__(self, request):
        self.request = request


@api_view(['GET'])
@permission_classes([IsAuthenticated, SubscriptionPermission])
def lookup_barcode(request):
    """
    Lookup product by barcode and return its data
    Query params: barcode=<barcode>
    Pro/Enterprise feature
    """
    # Check feature permission
    perm = require_feature('barcode_autofill')()
    if not perm.has_permission(request, None):
        return Response(
            {"error": "Barcode lookup is not available on your current plan."},
            status=status.HTTP_403_FORBIDDEN
        )

    barcode = request.query_params.get('barcode', '').strip()
    if not barcode:
        return Response(
            {"error": "barcode parameter is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Get shop
        mixin = TempMixin(request)
        shop = mixin.get_shop()

        # Look up product in this shop
        product = Product.objects.filter(
            shop=shop,
            barcode=barcode,
            is_active=True
        ).first()

        if not product:
            return Response(
                {"found": False, "message": "Product not found for this barcode"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Return product data
        serializer = ProductSerializer(product)
        return Response({
            "found": True,
            "product": serializer.data
        })

    except Exception as err:
        return Response(
            {"error": str(err)},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, SubscriptionPermission])
def suggest_categories(request):
    """
    Suggest product categories based on name pattern
    Query params: query=<product_name>
    Pro/Enterprise feature
    """
    # Check feature permission
    perm = require_feature('smart_suggestions')()
    if not perm.has_permission(request, None):
        return Response(
            {"error": "Smart suggestions are not available on your current plan."},
            status=status.HTTP_403_FORBIDDEN
        )

    query = request.query_params.get('query', '').strip().lower()
    if not query or len(query) < 2:
        return Response([])

    try:
        # Get shop
        mixin = TempMixin(request)
        shop = mixin.get_shop()

        # Find products in this shop with similar names
        similar_products = Product.objects.filter(
            shop=shop,
            name__icontains=query,
            is_active=True
        ).values('category_id', 'category__name').distinct()[:5]

        # Get categories used in shop
        categories = Category.objects.filter(
            id__in=[p['category_id'] for p in similar_products if p['category_id']]
        ).values('id', 'name')

        # If no similar products, get all categories in shop
        if not categories:
            categories = Category.objects.filter(
                product__shop=shop
            ).distinct().values('id', 'name')[:10]

        return Response(list(categories))

    except Exception as err:
        return Response(
            {"error": str(err)},
            status=status.HTTP_400_BAD_REQUEST
        )
