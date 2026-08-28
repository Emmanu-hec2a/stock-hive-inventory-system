"""
Test for repeated sales of the same product.
Verifies that creating multiple sales with the same product succeeds.
"""
from decimal import Decimal
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from inventory.models import Business, Shop, Product, StockEntry, Category

User = get_user_model()


class RepeatedSalesTestCase(APITestCase):
    """Test creating multiple sales of the same product."""

    def setUp(self):
        """Set up test data: business, shop, user, product, stock."""
        # Create business
        self.business = Business.objects.create(name="Test Business")

        # Create user (cashier)
        self.user = User.objects.create_user(
            email="cashier@test.com",
            full_name="Test Cashier",
            password="testpass123",
            role="cashier",
            business=self.business,
        )

        # Create shop
        self.shop = Shop.objects.create(
            business=self.business,
            name="Test Shop",
            location="Nairobi",
        )
        self.user.shop = self.shop
        self.user.save()

        # Create category
        self.category = Category.objects.create(shop=self.shop, name="Test Category")

        # Create product
        self.product = Product.objects.create(
            shop=self.shop,
            category=self.category,
            name="Test Product",
            sku="TEST-SKU-001",
            buying_price=Decimal("100.00"),
            selling_price=Decimal("150.00"),
            unit="units",
            low_stock_threshold=5,
            is_active=True,
        )

        # Add stock: 100 units
        StockEntry.objects.create(
            product=self.product,
            shop=self.shop,
            quantity=100,
            buying_price_at_entry=Decimal("100.00"),
        )

        # Authenticate user
        self.client.force_authenticate(user=self.user)

    def test_repeated_sales_of_same_product_succeeds(self):
        """
        Test that creating multiple sales with the same product succeeds.
        This verifies the fix for the "Sales cannot be modified" error.
        """
        sale_url = f"/api/sales/?shop_id={self.shop.id}"

        # Create first sale with the product
        payload_1 = {
            "payment_method": "cash",
            "items": [
                {
                    "product_id": str(self.product.id),
                    "quantity": 5,
                }
            ],
        }
        response_1 = self.client.post(sale_url, payload_1, format="json")
        
        # First sale should succeed
        self.assertEqual(
            response_1.status_code,
            status.HTTP_201_CREATED,
            f"First sale creation failed: {response_1.data}",
        )
        sale_1_id = response_1.data["id"]
        
        # Create second sale with the SAME product
        payload_2 = {
            "payment_method": "cash",
            "items": [
                {
                    "product_id": str(self.product.id),
                    "quantity": 3,
                }
            ],
        }
        response_2 = self.client.post(sale_url, payload_2, format="json")
        
        # Second sale should ALSO succeed (this was failing before the fix)
        self.assertEqual(
            response_2.status_code,
            status.HTTP_201_CREATED,
            f"Second sale creation failed: {response_2.data}",
        )
        sale_2_id = response_2.data["id"]

        # Verify the sales are different
        self.assertNotEqual(sale_1_id, sale_2_id)

        # Verify both sales have the correct items
        self.assertEqual(str(response_1.data["total_amount"]), "750.00")  # 5 * 150
        self.assertEqual(str(response_2.data["total_amount"]), "450.00")  # 3 * 150

    def test_repeated_sales_with_different_quantities(self):
        """Test multiple sales of the same product with varying quantities."""
        sale_url = f"/api/sales/?shop_id={self.shop.id}"

        # Create 3 sales of the same product with different quantities
        quantities = [2, 5, 10]
        sale_ids = []

        for qty in quantities:
            payload = {
                "payment_method": "cash",
                "items": [
                    {
                        "product_id": str(self.product.id),
                        "quantity": qty,
                    }
                ],
            }
            response = self.client.post(sale_url, payload, format="json")
            self.assertEqual(
                response.status_code,
                status.HTTP_201_CREATED,
                f"Sale with quantity {qty} failed: {response.data}",
            )
            sale_ids.append(response.data["id"])

        # Verify we created 3 different sales
        self.assertEqual(len(sale_ids), 3)
        self.assertEqual(len(set(sale_ids)), 3)  # All unique

    def test_insufficient_stock_still_fails(self):
        """Test that insufficient stock validation still works."""
        sale_url = f"/api/sales/?shop_id={self.shop.id}"

        # Try to create a sale exceeding available stock (100 units)
        payload = {
            "payment_method": "cash",
            "items": [
                {
                    "product_id": str(self.product.id),
                    "quantity": 150,  # Only 100 available
                }
            ],
        }
        response = self.client.post(sale_url, payload, format="json")

        # Should fail with 400 Bad Request
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Insufficient stock", str(response.data))
