# StockHive Inventory System 🐝

[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Django](https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white)](https://djangoproject.com)
[![Django REST Framework](https://img.shields.io/badge/DRF-A30000?style=for-the-badge&logo=django&logoColor=white)](https://www.django-rest-framework.org)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)

A multi-tenant SaaS inventory management platform built with Django REST Framework, JWT Authentication, and a React frontend. Designed for multi-branch shop management with strict data isolation, role-based permissions, automated billing, and real-time stock alerts.

---

## 🛠️ Key Features & Architecture

* **🔐 Multi-Tenancy & Data Isolation:** Built with custom `ShopScopedMixin` and `ShopIsolationMiddleware` to enforce strict data privacy across isolated business branches.
* **👥 Role-Based Access Control (RBAC):** Hierarchical permissions system supporting `super_admin`, `shop_admin`, and `cashier` user roles.
* **📦 Smart Inventory Engine:** Real-time stock calculation, multi-branch stock catalog copying, and dynamic adjustment logs.
* **⚠️ Automated Stock Alerts:** Real-time monitoring and threshold alerts for low inventory levels.
* **💳 Billing & Subscriptions:** Modular billing system to handle subscription plans and shop license management.
* **📊 Business Reports & Analytics:** Endpoints providing detailed insights into sales performance, product turn rates, and total stock valuations.

---

## 📂 Project Structure

```text
stock-hive-inventory-system/
├── accounts/          # User authentication, RBAC, and shop isolation logic
├── alerts/            # Low-stock notification workflows and logic
├── billing/           # SaaS billing and subscription management
├── config/            # Django root settings and WSGI/ASGI configs
├── frontend/          # React SPA interface (Vite / React Router)
├── inventory/         # Product catalog, stock adjustments, & sales engine
└── landing/           # Landing page assets and marketing layout

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
