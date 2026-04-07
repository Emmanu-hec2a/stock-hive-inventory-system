PLAN_LIMITS = {
    "free": {"products": 30, "staff": 2, "shops": 1},
    "basic": {"products": 200, "staff": 5, "shops": 1},
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
    ],
    "pro": [
        "sales",
        "stock_management",
        "basic_reports",
        "advanced_reports",
        "low_stock_alerts",
        "export_csv",
        "multi_branch",
        "stock_transfers",
        "priority_support",
    ],
    "enterprise": ["*"],
}

PLAN_PRICES = {
    "basic": 2999,
    "pro": 4999,
    "enterprise": 6999,
}
