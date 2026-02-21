"""
C2G Orchestrator configuration loaded from environment.
.env lives at the repo root (TVGHack/.env), one level above c2g-orchestrator/.
"""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import dotenv_values

_repo_root = Path(__file__).resolve().parent.parent
_env_file = _repo_root / ".env"

if _env_file.is_file():
    for key, value in dotenv_values(_env_file).items():
        if value is not None:
            os.environ[key] = value


@dataclass(frozen=True)
class Settings:
    SUPABASE_URL: str
    SUPABASE_KEY: str
    BASE_CONTRACT_PRICE: float
    FACILITY_MW: float
    CHECKPOINT_GRACE_SECONDS: float

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            SUPABASE_URL=os.getenv("SUPABASE_URL", ""),
            SUPABASE_KEY=os.getenv("SUPABASE_KEY", ""),
            BASE_CONTRACT_PRICE=float(os.getenv("BASE_CONTRACT_PRICE", "40")),
            FACILITY_MW=float(os.getenv("FACILITY_MW", "100")),
            CHECKPOINT_GRACE_SECONDS=float(os.getenv("CHECKPOINT_GRACE_SECONDS", "10")),
        )


settings = Settings.from_env()
