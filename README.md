# Multi-Tenant Inventory System (MVP)

MVP built with Django + DRF + JWT backend and React frontend for a multi-shop inventory SaaS model.

## Features Implemented

- Custom `User` model with roles: `super_admin`, `shop_admin`, `cashier`
- Multi-tenant models: `Business`, `Shop`, `Category`, `Product`, `StockEntry`, `StockAdjustment`, `Sale`, `SaleItem`
- Shop data isolation using `ShopScopedMixin` and `ShopIsolationMiddleware`
- JWT auth endpoints (`login`, `refresh`, `logout`)
- CRUD APIs for shops, staff, products, categories, stock entries/adjustments, sales
- Stock-on-the-fly calculation (`entries + adjustments - sold`)
- Reports endpoints (`dashboard`, `sales`, `products`, `stock-value`, `overview`)
- Soft-delete behavior for shops/products/staff
- Shop deactivation blocks non-super-admin login
- React frontend with:
  - login
  - protected routes
  - dashboard
  - products CRUD form/list
  - stock entry form/list
  - sales recording/list

## Environment Variables

Set these for PostgreSQL:

- `DB_ENGINE` (default: `django.db.backends.postgresql`)
- `DB_NAME` (default: `inventory_db`)
- `DB_USER` (default: `postgres`)
- `DB_PASSWORD` (default: `postgres`)
- `DB_HOST` (default: `localhost`)
- `DB_PORT` (default: `5432`)

## Quick Start

1. Install dependencies:
   - `pip install django djangorestframework djangorestframework-simplejwt django-cors-headers psycopg2-binary Pillow`
2. Run migrations:
   - `python manage.py makemigrations`
   - `python manage.py migrate`
3. Create super admin user:
   - `python manage.py createsuperuser`
4. Run server:
   - `python manage.py runserver`

## Frontend Setup

1. Open frontend folder:
   - `cd frontend`
2. Install deps:
   - `npm install`
3. Set API URL:
   - create `.env` with `VITE_API_BASE_URL=http://127.0.0.1:8000/api`
4. Start app:
   - `npm run dev`

## API Base

- Auth: `/api/auth/`
- Domain APIs: `/api/`
