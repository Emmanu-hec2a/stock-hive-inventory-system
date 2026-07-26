PLAN_LIMITS = {
    "free": {"products": 30, "staff": 2, "shops": 1},
    "basic": {"products": 200, "staff": 5, "shops": 2},
    "pro": {"products": None, "staff": 15, "shops": 3},
    "enterprise": {"products": None, "staff": None, "shops": None},
}

PLAN_FEATURES = {
    "free": ["sales", "stock_management", "basic_reports"],
    "basic": [
        "sales",
        "stock_management",
        "basic_reports",
        "advanced_reports",
        "low_stock_alerts",
        "export_csv",
        "barcodes",
    ],
    "pro": [
        "sales",
        "stock_management",
        "basic_reports",
        "advanced_reports",
        "low_stock_alerts",
        "export_csv",
        "barcodes",
        "multi_branch",
        "stock_transfers",
        "suppliers",
        "audit_logs",
        "priority_support",
    ],
    "enterprise": ["*"],
}

PLAN_PRICES = {
    "basic": 1999,
    "pro": 2499,
    "enterprise": 3499,
}
