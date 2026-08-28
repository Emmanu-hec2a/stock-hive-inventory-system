"""
Advanced Analytics Views for Inventory Tracking System
Provides comprehensive metrics for sales, inventory, and business performance
"""

from datetime import timedelta, datetime
from decimal import Decimal
from django.db.models import Sum, Count, Avg, Q, F
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from inventory.models import Sale, SaleItem, Product, Shop, StockEntry, StockAdjustment
from inventory.utils import get_current_stock
from billing.models import Subscription


class AnalyticsService:
    """Service class for analytics calculations"""

    @staticmethod
    def get_date_range(days=30):
        """Get date range for analytics"""
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        return start_date, end_date

    @staticmethod
    def get_sales_summary(shop, days=30):
        """Get sales summary metrics"""
        start_date, end_date = AnalyticsService.get_date_range(days)
        
        sales = Sale.objects.filter(
            shop=shop,
            created_at__range=[start_date, end_date]
        )
        
        total_revenue = sales.aggregate(
            total=Sum('total_amount')
        )['total'] or Decimal('0')
        
        total_transactions = sales.count()
        avg_transaction = total_revenue / total_transactions if total_transactions > 0 else Decimal('0')
        
        # Payment method breakdown
        payment_breakdown = sales.values('payment_method').annotate(
            count=Count('id'),
            total=Sum('total_amount')
        ).order_by('-total')
        
        return {
            'total_revenue': float(total_revenue),
            'transaction_count': total_transactions,
            'average_transaction': float(avg_transaction),
            'payment_methods': list(payment_breakdown),
            'period_days': days
        }

    @staticmethod
    def get_daily_sales_trend(shop, days=30):
        """Get daily sales trend for charting"""
        start_date, end_date = AnalyticsService.get_date_range(days)
        
        sales_by_day = Sale.objects.filter(
            shop=shop,
            created_at__range=[start_date, end_date]
        ).extra(
            select={'date': 'DATE(created_at)'}
        ).values('date').annotate(
            revenue=Sum('total_amount'),
            transactions=Count('id')
        ).order_by('date')
        
        return [{
            'date': str(item['date']),
            'revenue': float(item['revenue'] or 0),
            'transactions': item['transactions']
        } for item in sales_by_day]

    @staticmethod
    def get_top_products(shop, limit=10, days=30):
        """Get top performing products"""
        start_date, end_date = AnalyticsService.get_date_range(days)
        
        top_products = SaleItem.objects.filter(
            sale__shop=shop,
            sale__created_at__range=[start_date, end_date]
        ).values(
            'product__id',
            'product__name',
            'product__sku'
        ).annotate(
            total_sold=Sum('quantity'),
            revenue=Sum('subtotal'),
            avg_price=Avg('unit_price')
        ).order_by('-revenue')[:limit]
        
        return [{
            'product_id': str(item['product__id']),
            'name': item['product__name'],
            'sku': item['product__sku'],
            'quantity_sold': int(item['total_sold']),
            'revenue': float(item['revenue']),
            'average_price': float(item['avg_price'])
        } for item in top_products]

    @staticmethod
    def get_inventory_health(shop):
        """Get inventory health metrics"""
        products = Product.objects.filter(shop=shop, is_active=True)
        
        total_products = products.count()
        low_stock_items = []
        out_of_stock_items = []
        inventory_value = Decimal('0')
        
        for product in products:
            current_stock = get_current_stock(product)
            stock_value = current_stock * product.buying_price
            inventory_value += stock_value
            
            if current_stock == 0:
                out_of_stock_items.append({
                    'product_id': str(product.id),
                    'name': product.name,
                    'sku': product.sku
                })
            elif current_stock <= product.low_stock_threshold:
                low_stock_items.append({
                    'product_id': str(product.id),
                    'name': product.name,
                    'sku': product.sku,
                    'current_stock': current_stock,
                    'threshold': product.low_stock_threshold
                })
        
        return {
            'total_products': total_products,
            'low_stock_count': len(low_stock_items),
            'out_of_stock_count': len(out_of_stock_items),
            'inventory_value': float(inventory_value),
            'low_stock_items': low_stock_items,
            'out_of_stock_items': out_of_stock_items
        }

    @staticmethod
    def get_profit_analysis(shop, days=30):
        """Calculate profit margins and analysis"""
        start_date, end_date = AnalyticsService.get_date_range(days)
        
        sale_items = SaleItem.objects.filter(
            sale__shop=shop,
            sale__created_at__range=[start_date, end_date]
        )
        
        total_revenue = sale_items.aggregate(
            total=Sum('subtotal')
        )['total'] or Decimal('0')
        
        # Calculate cost of goods sold
        total_cogs = Decimal('0')
        for item in sale_items:
            total_cogs += item.quantity * item.product.buying_price
        
        total_profit = total_revenue - total_cogs
        profit_margin = (total_profit / total_revenue * 100) if total_revenue > 0 else Decimal('0')
        
        return {
            'total_revenue': float(total_revenue),
            'total_cogs': float(total_cogs),
            'total_profit': float(total_profit),
            'profit_margin_percent': float(profit_margin),
            'period_days': days
        }

    @staticmethod
    def get_category_performance(shop, days=30):
        """Analyze performance by product category"""
        start_date, end_date = AnalyticsService.get_date_range(days)
        
        categories = SaleItem.objects.filter(
            sale__shop=shop,
            sale__created_at__range=[start_date, end_date]
        ).values(
            'product__category__name'
        ).annotate(
            revenue=Sum('subtotal'),
            quantity_sold=Sum('quantity'),
            transaction_count=Count('sale_id', distinct=True)
        ).order_by('-revenue')
        
        return [{
            'category': item['product__category__name'] or 'Uncategorized',
            'revenue': float(item['revenue']),
            'quantity_sold': int(item['quantity_sold']),
            'transactions': item['transaction_count']
        } for item in categories]

    @staticmethod
    def get_staff_performance(shop, days=30):
        """Analyze staff sales performance"""
        start_date, end_date = AnalyticsService.get_date_range(days)
        
        staff_stats = Sale.objects.filter(
            shop=shop,
            created_at__range=[start_date, end_date]
        ).values(
            'served_by__id',
            'served_by__full_name'
        ).annotate(
            total_sales=Sum('total_amount'),
            transaction_count=Count('id'),
            avg_transaction=Avg('total_amount')
        ).order_by('-total_sales')
        
        return [{
            'staff_id': str(item['served_by__id']),
            'name': item['served_by__full_name'],
            'total_sales': float(item['total_sales']),
            'transaction_count': int(item['transaction_count']),
            'average_transaction': float(item['avg_transaction'])
        } for item in staff_stats if item['served_by__full_name']]

    @staticmethod
    def get_payment_method_analysis(shop, days=30):
        """Analyze sales by payment method"""
        start_date, end_date = AnalyticsService.get_date_range(days)
        
        payment_stats = Sale.objects.filter(
            shop=shop,
            created_at__range=[start_date, end_date]
        ).values('payment_method').annotate(
            total_amount=Sum('total_amount'),
            count=Count('id'),
            average=Avg('total_amount')
        ).order_by('-total_amount')
        
        return [{
            'method': item['payment_method'],
            'total_amount': float(item['total_amount']),
            'count': item['count'],
            'average': float(item['average'])
        } for item in payment_stats]

    @staticmethod
    def get_business_overview(business, days=30):
        """Get high-level business overview across all shops"""
        shops = Shop.objects.filter(business=business, is_active=True)
        
        start_date, end_date = AnalyticsService.get_date_range(days)
        
        # Aggregate sales data
        all_sales = Sale.objects.filter(
            shop__in=shops,
            created_at__range=[start_date, end_date]
        )
        
        total_revenue = all_sales.aggregate(
            total=Sum('total_amount')
        )['total'] or Decimal('0')
        
        total_transactions = all_sales.count()
        
        # Revenue by shop
        shop_revenue = all_sales.values(
            'shop__id',
            'shop__name'
        ).annotate(
            revenue=Sum('total_amount'),
            transactions=Count('id')
        ).order_by('-revenue')
        
        # Product statistics
        all_products = Product.objects.filter(shop__in=shops, is_active=True)
        total_products = all_products.count()
        
        # Inventory value
        inventory_value = Decimal('0')
        for product in all_products:
            current_stock = get_current_stock(product)
            inventory_value += current_stock * product.buying_price
        
        return {
            'total_revenue': float(total_revenue),
            'transaction_count': total_transactions,
            'shop_count': shops.count(),
            'product_count': total_products,
            'inventory_value': float(inventory_value),
            'shops': [{
                'shop_id': str(item['shop__id']),
                'name': item['shop__name'],
                'revenue': float(item['revenue']),
                'transactions': item['transactions']
            } for item in shop_revenue],
            'period_days': days
        }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sales_analytics(request):
    """
    GET: Sales analytics for a shop (or business overview if super_admin)
    Query params:
    - days: number of days to analyze (default: 30)
    - shop_id: shop ID (required for non-super_admin, ignored for super_admin)
    """
    user = request.user
    days = int(request.query_params.get('days', 30))
    
    if user.role == 'super_admin':
        # Business overview
        overview = AnalyticsService.get_business_overview(user.business, days)
        daily_trend = AnalyticsService.get_daily_sales_trend(Shop.objects.filter(
            business=user.business, is_active=True
        ).first(), days) if Shop.objects.filter(business=user.business, is_active=True).exists() else []
        return Response({
            'overview': overview,
            'daily_trend': daily_trend
        })
    else:
        shop = user.shop
        if not shop:
            return Response({'error': 'Shop not found'}, status=status.HTTP_400_BAD_REQUEST)
        
        sales_summary = AnalyticsService.get_sales_summary(shop, days)
        daily_trend = AnalyticsService.get_daily_sales_trend(shop, days)
        payment_analysis = AnalyticsService.get_payment_method_analysis(shop, days)
        
        return Response({
            'summary': sales_summary,
            'daily_trend': daily_trend,
            'payment_analysis': payment_analysis
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def inventory_analytics(request):
    """
    GET: Inventory analytics for a shop
    Query params:
    - shop_id: shop ID (required for non-super_admin)
    """
    user = request.user
    
    if user.role == 'super_admin':
        shop_id = request.query_params.get('shop_id')
        if not shop_id:
            return Response({'error': 'shop_id required for super_admin'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            shop = Shop.objects.get(id=shop_id, business=user.business)
        except Shop.DoesNotExist:
            return Response({'error': 'Shop not found'}, status=status.HTTP_404_NOT_FOUND)
    else:
        shop = user.shop
        if not shop:
            return Response({'error': 'Shop not found'}, status=status.HTTP_400_BAD_REQUEST)
    
    inventory_health = AnalyticsService.get_inventory_health(shop)
    
    return Response(inventory_health)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def products_analytics(request):
    """
    GET: Product performance analytics
    Query params:
    - days: number of days (default: 30)
    - limit: number of top products (default: 10)
    - shop_id: shop ID (required for non-super_admin)
    """
    user = request.user
    days = int(request.query_params.get('days', 30))
    limit = int(request.query_params.get('limit', 10))
    
    if user.role == 'super_admin':
        shop_id = request.query_params.get('shop_id')
        if not shop_id:
            return Response({'error': 'shop_id required for super_admin'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            shop = Shop.objects.get(id=shop_id, business=user.business)
        except Shop.DoesNotExist:
            return Response({'error': 'Shop not found'}, status=status.HTTP_404_NOT_FOUND)
    else:
        shop = user.shop
        if not shop:
            return Response({'error': 'Shop not found'}, status=status.HTTP_400_BAD_REQUEST)
    
    top_products = AnalyticsService.get_top_products(shop, limit, days)
    category_performance = AnalyticsService.get_category_performance(shop, days)
    
    return Response({
        'top_products': top_products,
        'category_performance': category_performance
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profit_analytics(request):
    """
    GET: Profit and margin analysis
    Query params:
    - days: number of days (default: 30)
    - shop_id: shop ID (required for non-super_admin)
    """
    user = request.user
    days = int(request.query_params.get('days', 30))
    
    if user.role == 'super_admin':
        shop_id = request.query_params.get('shop_id')
        if not shop_id:
            return Response({'error': 'shop_id required for super_admin'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            shop = Shop.objects.get(id=shop_id, business=user.business)
        except Shop.DoesNotExist:
            return Response({'error': 'Shop not found'}, status=status.HTTP_404_NOT_FOUND)
    else:
        shop = user.shop
        if not shop:
            return Response({'error': 'Shop not found'}, status=status.HTTP_400_BAD_REQUEST)
    
    profit_analysis = AnalyticsService.get_profit_analysis(shop, days)
    
    return Response(profit_analysis)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def staff_analytics(request):
    """
    GET: Staff performance analytics
    Query params:
    - days: number of days (default: 30)
    - shop_id: shop ID (required for non-super_admin)
    """
    user = request.user
    days = int(request.query_params.get('days', 30))
    
    if user.role == 'super_admin':
        shop_id = request.query_params.get('shop_id')
        if not shop_id:
            return Response({'error': 'shop_id required for super_admin'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            shop = Shop.objects.get(id=shop_id, business=user.business)
        except Shop.DoesNotExist:
            return Response({'error': 'Shop not found'}, status=status.HTTP_404_NOT_FOUND)
    else:
        shop = user.shop
        if not shop:
            return Response({'error': 'Shop not found'}, status=status.HTTP_400_BAD_REQUEST)
    
    staff_performance = AnalyticsService.get_staff_performance(shop, days)
    
    return Response({
        'staff_performance': staff_performance
    })
