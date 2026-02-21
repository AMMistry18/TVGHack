"""
Pytest tests for savings and price classification.
"""
import pytest

from services.ercot_monitor import classify_price
from services.savings_calculator import calculate_avoided_cost


def test_calculate_avoided_cost_992000():
    assert calculate_avoided_cost(5000, 2, 100) == 992000.0


def test_calculate_avoided_cost_zero():
    assert calculate_avoided_cost(40, 1, 100) == 0.0


def test_calculate_avoided_cost_1792000():
    assert calculate_avoided_cost(9000, 2, 100) == 1792000.0


def test_classify_price_normal():
    assert classify_price(30) == "NORMAL"


def test_classify_price_warning():
    assert classify_price(150) == "WARNING"


def test_classify_price_emergency():
    assert classify_price(1500) == "EMERGENCY"


def test_classify_price_critical():
    assert classify_price(5000) == "CRITICAL"


def test_classify_price_critical_high():
    assert classify_price(9999) == "CRITICAL"
