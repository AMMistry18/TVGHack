"""
Supabase client singleton and DB utilities for C2G Orchestrator.
All writes go to https://gkyhvikuizoceekuduwe.supabase.co
"""
import asyncio
import sys
from typing import Any

from supabase import create_client, Client

from config import settings
from models.schemas import ActionLog, GridEvent

_client: Client | None = None


def _get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return _client


def get_db() -> Client:
    return _get_client()


async def insert_grid_event(event: GridEvent) -> dict[str, Any]:
    try:
        payload = {"timestamp": event.timestamp.isoformat(), "price_mwh": event.price_mwh, "status": event.status}
        result = await asyncio.to_thread(lambda: _get_client().table("grid_events").insert(payload).execute())
        if result.data and len(result.data) > 0:
            return dict(result.data[0])
        return {}
    except Exception as e:
        print(f"insert_grid_event error: {e}", file=sys.stderr)
        return {}


async def insert_action_log(log: ActionLog) -> dict[str, Any]:
    try:
        payload = {
            "timestamp": log.timestamp.isoformat(),
            "action_taken": log.action_taken,
            "pods_scaled": log.pods_scaled,
            "estimated_savings": log.estimated_savings,
            "duration_seconds": log.duration_seconds,
        }
        result = await asyncio.to_thread(lambda: _get_client().table("action_logs").insert(payload).execute())
        if result.data and len(result.data) > 0:
            return dict(result.data[0])
        return {}
    except Exception as e:
        print(f"insert_action_log error: {e}", file=sys.stderr)
        return {}


async def insert_power_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Insert a power_snapshots row. Fire-and-forget on error."""
    try:
        result = await asyncio.to_thread(
            lambda: _get_client().table("power_snapshots").insert(snapshot).execute()
        )
        if result.data and len(result.data) > 0:
            return dict(result.data[0])
        return {}
    except Exception as e:
        print(f"insert_power_snapshot error: {e}", file=sys.stderr)
        return {}


async def get_power_snapshots(limit: int = 200) -> list[dict[str, Any]]:
    """Query power_snapshots DESC, then reverse to ASC for timeline charts."""
    try:
        limit = min(max(1, limit), 500)
        result = await asyncio.to_thread(
            lambda: _get_client().table("power_snapshots").select("*").order("timestamp", desc=True).limit(limit).execute()
        )
        if result.data:
            rows = [dict(row) for row in result.data]
            rows.reverse()
            return rows
        return []
    except Exception as e:
        print(f"get_power_snapshots error: {e}", file=sys.stderr)
        return []


async def get_grid_events(limit: int = 100) -> list[dict[str, Any]]:
    try:
        limit = min(max(1, limit), 500)
        result = await asyncio.to_thread(
            lambda: _get_client().table("grid_events").select("*").order("timestamp", desc=True).limit(limit).execute()
        )
        if result.data:
            return [dict(row) for row in result.data]
        return []
    except Exception as e:
        print(f"get_grid_events error: {e}", file=sys.stderr)
        return []


async def get_grid_events_asc(limit: int = 500) -> list[dict[str, Any]]:
    try:
        limit = min(max(1, limit), 500)
        result = await asyncio.to_thread(
            lambda: _get_client().table("grid_events").select("*").order("timestamp", desc=True).limit(limit).execute()
        )
        if result.data:
            rows = [dict(row) for row in result.data]
            rows.reverse()
            return rows
        return []
    except Exception as e:
        print(f"get_grid_events_asc error: {e}", file=sys.stderr)
        return []


async def insert_grid_events_bulk(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    try:
        payloads = [
            {
                "timestamp": e.get("timestamp") if isinstance(e.get("timestamp"), str) else e["timestamp"].isoformat(),
                "price_mwh": float(e["price_mwh"]),
                "status": str(e["status"]),
            }
            for e in events
        ]
        result = await asyncio.to_thread(lambda: _get_client().table("grid_events").insert(payloads).execute())
        if result.data:
            return [dict(row) for row in result.data]
        return []
    except Exception as e:
        print(f"insert_grid_events_bulk error: {e}", file=sys.stderr)
        return []


async def get_action_logs_asc(limit: int = 2000) -> list[dict[str, Any]]:
    try:
        result = await asyncio.to_thread(
            lambda: _get_client().table("action_logs").select("*").order("timestamp", desc=False).limit(limit).execute()
        )
        if result.data:
            return [dict(row) for row in result.data]
        return []
    except Exception as e:
        print(f"get_action_logs_asc error: {e}", file=sys.stderr)
        return []
