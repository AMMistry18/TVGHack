"""
Savings estimation from grid price vs contract price.
"""
from config import settings


def estimate_savings(
    price_mwh: float,
    facility_mw: float | None = None,
    base_contract_price: float | None = None,
    duration_hours: float = 1.0,
) -> float:
    """
    Estimate savings (or cost) vs base contract.
    Positive = savings (grid cheaper), negative = extra cost.
    """
    mw = facility_mw or settings.FACILITY_MW
    base = base_contract_price or settings.BASE_CONTRACT_PRICE
    return (base - price_mwh) * mw * duration_hours
