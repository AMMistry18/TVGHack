"""
ERCOT grid price monitoring background task.
"""
import asyncio


async def run_ercot_monitor() -> None:
    """
    Background task: poll ERCOT (or simulated) grid signals and persist events.
    Runs until cancelled.
    """
    while True:
        try:
            # TODO: fetch ERCOT price, map to status, insert via insert_grid_event
            await asyncio.sleep(60)
        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(60)
