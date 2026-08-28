"""
CSV Bulk Product Import
Handles parsing and validation of CSV files for bulk product creation
"""
import csv
import io
from decimal import Decimal
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from inventory.models import Product, Category, Shop
from billing.permissions import SubscriptionPermission, require_feature
from inventory.mixins import ShopScopedMixin


def parse_csv_file(file_content, encoding='utf-8'):
    """Parse CSV file and return rows with headers"""
    try:
        # Try UTF-8 first, fall back to latin-1
        try:
            text = file_content.decode(encoding)
        except UnicodeDecodeError:
            text = file_content.decode('latin-1')
        
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
        
        if not rows:
            return None, "CSV file is empty"
        
        return rows, None
    except Exception as err:
        return None, f"Failed to parse CSV: {str(err)}"


def validate_product_row(row, shop, row_num, existing_skus):
    """Validate a single product row"""
    errors = []
    
    # Required fields
    name = row.get('name', '').strip()
    if not name:
        errors.append(f"Row {row_num}: 'name' is required")
    
    sku = row.get('sku', '').strip()
    if not sku:
        errors.append(f"Row {row_num}: 'sku' is required")
    elif sku in existing_skus:
        errors.append(f"Row {row_num}: SKU '{sku}' already exists in this shop")
    
    # Price validation
    try:
        selling_price = Decimal(row.get('selling_price', '0'))
        if selling_price < 0:
            errors.append(f"Row {row_num}: 'selling_price' cannot be negative")
    except:
        errors.append(f"Row {row_num}: 'selling_price' must be a valid number")
    
    try:
        buying_price = Decimal(row.get('buying_price', '0'))
        if buying_price < 0:
            errors.append(f"Row {row_num}: 'buying_price' cannot be negative")
    except:
        errors.append(f"Row {row_num}: 'buying_price' must be a valid number")
    
    # Stock validation
    try:
        initial_stock = int(row.get('initial_stock', '0'))
        if initial_stock < 0:
            errors.append(f"Row {row_num}: 'initial_stock' cannot be negative")
    except:
        errors.append(f"Row {row_num}: 'initial_stock' must be a valid integer")
    
    return errors


@api_view(['POST'])
@permission_classes([IsAuthenticated, SubscriptionPermission])
def bulk_import_products(request):
    """
    Bulk import products from CSV file (Pro/Enterprise feature)
    Expected fields: name, sku, category, selling_price, buying_price, initial_stock, unit (optional)
    Returns preview with validation results
    """
    # Check feature permission
    perm = require_feature('bulk_import')()
    if not perm.has_permission(request, None):
        return Response(
            {"error": "Bulk import is not available on your current plan. Upgrade to Pro or Enterprise."},
            status=status.HTTP_403_FORBIDDEN
        )
    
    if 'file' not in request.FILES:
        return Response(
            {"error": "No file provided"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    file = request.FILES['file']
    
    # Validate file type
    if not file.name.endswith(('.csv', '.xlsx')):
        return Response(
            {"error": "Only CSV and XLSX files are supported"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get shop
    from inventory.mixins import ShopScopedMixin
    
    class TempViewSet(ShopScopedMixin):
        def __init__(self):
            self.request = request
    
    try:
        view = TempViewSet()
        shop = view.get_shop()
    except Exception as err:
        return Response(
            {"error": str(err)},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Parse CSV
    rows, parse_error = parse_csv_file(file.read())
    if parse_error:
        return Response(
            {"error": parse_error},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get existing SKUs in shop
    existing_skus = set(
        Product.objects.filter(shop=shop).values_list('sku', flat=True)
    )
    
    # Validate rows
    validated_rows = []
    errors = []
    
    for i, row in enumerate(rows, start=2):  # Start at 2 (row 1 is header)
        row_errors = validate_product_row(row, shop, i, existing_skus)
        
        if row_errors:
            errors.extend(row_errors)
        else:
            validated_rows.append({
                'row_num': i,
                'data': row
            })
            # Add to existing SKUs to prevent duplicates within import
            existing_skus.add(row.get('sku', '').strip())
    
    return Response({
        'total_rows': len(rows),
        'valid_rows': len(validated_rows),
        'error_rows': len(rows) - len(validated_rows),
        'errors': errors,
        'preview': validated_rows[:10],  # First 10 rows for preview
        'can_proceed': len(errors) == 0
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, SubscriptionPermission])
def confirm_bulk_import(request):
    """
    Confirm and save bulk imported products
    Expects: rows (array of product data from preview)
    """
    rows = request.data.get('rows', [])
    
    if not rows:
        return Response(
            {"error": "No rows provided"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get shop
    class TempViewSet(ShopScopedMixin):
        def __init__(self):
            self.request = request
    
    try:
        view = TempViewSet()
        shop = view.get_shop()
    except Exception as err:
        return Response(
            {"error": str(err)},
            status=status.HTTP_403_FORBIDDEN
        )
    
    created_count = 0
    failed_count = 0
    errors = []
    
    try:
        with transaction.atomic():
            for item in rows:
                try:
                    row = item.get('data', {})
                    
                    # Get or create category
                    category_name = row.get('category', 'Uncategorized').strip()
                    category, _ = Category.objects.get_or_create(
                        name=category_name,
                        defaults={'description': f'Auto-imported category'}
                    )
                    
                    # Create product
                    Product.objects.create(
                        shop=shop,
                        name=row.get('name', '').strip(),
                        sku=row.get('sku', '').strip(),
                        category=category,
                        selling_price=Decimal(row.get('selling_price', '0')),
                        buying_price=Decimal(row.get('buying_price', '0')),
                        unit=row.get('unit', 'piece').strip(),
                        description=row.get('description', '').strip(),
                        low_stock_threshold=int(row.get('low_stock_threshold', '5')),
                    )
                    created_count += 1
                    
                except Exception as row_err:
                    failed_count += 1
                    errors.append({
                        'row': item.get('row_num'),
                        'error': str(row_err)
                    })
    
    except Exception as err:
        return Response(
            {"error": f"Transaction failed: {str(err)}"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Invalidate cache
    from django.core.cache import cache
    cache.delete(f"products_list_{shop.id}")
    cache.delete(f"dashboard_data_{shop.id}")
    
    return Response({
        'created': created_count,
        'failed': failed_count,
        'errors': errors,
        'message': f"Successfully imported {created_count} products"
    })
