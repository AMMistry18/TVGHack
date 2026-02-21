"""
Pytest configuration. Run from c2g-orchestrator so imports resolve.
If supabase is not installed, a minimal mock is injected so collection and tests can run.
"""
import sys
from pathlib import Path

# Ensure app root (c2g-orchestrator) is on path when running pytest from repo root or tests/
root = Path(__file__).resolve().parent.parent
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

# Allow tests to run without supabase installed (e.g. CI or fresh clone)
try:
    import supabase  # noqa: F401
except ImportError:
    _insert_res = type("Res", (), {"data": [{}], "count": None})()
    _query_res = type("Res", (), {"data": []})()
    _limit_obj = type("Lim", (), {"execute": lambda: _query_res})()
    _order_obj = type("Ord", (), {"limit": lambda *a, **k: _limit_obj})()
    _select_obj = type("Sel", (), {"order": lambda *a, **k: _order_obj})()
    _mock_table = type(
        "Table",
        (),
        {
            "insert": lambda *a, **k: type("In", (), {"execute": lambda: _insert_res})(),
            "select": lambda *a, **k: _select_obj,
        },
    )()
    _mock_client = type("Client", (), {"table": lambda s, n: _mock_table})()
    _supabase = type(sys)("supabase")
    _supabase.create_client = lambda *a, **k: _mock_client
    _supabase.Client = type("Client", (), {})
    sys.modules["supabase"] = _supabase
