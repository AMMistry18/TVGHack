#!/usr/bin/env python3
"""
C2G Pre-Stop Hook — runs inside AI training containers before pod termination.
K8s calls this via the lifecycle.preStop hook, giving us ~10–30 seconds to save state.

Mount this script into the container at /hooks/c2g_checkpoint.py
"""
import json
import os
import signal
import sys
from datetime import datetime, timezone

CHECKPOINT_DIR = "/checkpoints"
LOG_PREFIX = "[C2G preStop]"


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"{ts} {LOG_PREFIX} {msg}", flush=True)


def handle_sigterm(signum, frame):
    log("SIGTERM received; completing checkpoint and exiting.")
    sys.exit(0)


def main() -> int:
    signal.signal(signal.SIGTERM, handle_sigterm)
    log("Pre-Stop hook started.")

    framework = (os.environ.get("C2G_FRAMEWORK") or "generic").strip().lower()
    pod_name = os.environ.get("POD_NAME", "unknown")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    os.makedirs(CHECKPOINT_DIR, exist_ok=True)

    if framework == "pytorch":
        log("Framework: pytorch")
        try:
            import torch
            # Stub: in real use, 'model' is the training model from your app
            model = getattr(sys.modules.get("__main__"), "model", None)
            if model is not None and hasattr(model, "state_dict"):
                path = f"{CHECKPOINT_DIR}/model_{timestamp}.pt"
                torch.save(model.state_dict(), path)
                log(f"Saved PyTorch state_dict to {path}")
            else:
                path = f"{CHECKPOINT_DIR}/model_{timestamp}.pt"
                torch.save({}, path)
                log(f"Wrote placeholder checkpoint {path}")
        except ImportError:
            log("torch not available; writing generic state only.")
            path = f"{CHECKPOINT_DIR}/state_{timestamp}.json"
            with open(path, "w") as f:
                json.dump({
                    "timestamp": timestamp,
                    "status": "checkpointed",
                    "pod_name": pod_name,
                    "framework": "pytorch_unavailable",
                }, f, indent=2)
            log(f"Wrote {path}")

    elif framework == "tensorflow":
        log("Framework: tensorflow")
        try:
            import tensorflow as tf
            model = getattr(sys.modules.get("__main__"), "model", None)
            if model is not None:
                path = f"{CHECKPOINT_DIR}/model_{timestamp}"
                model.save(path)
                log(f"Saved TensorFlow model to {path}")
            else:
                path = f"{CHECKPOINT_DIR}/model_{timestamp}"
                os.makedirs(path, exist_ok=True)
                with open(os.path.join(path, "checkpoint_done"), "w") as f:
                    f.write(timestamp)
                log(f"Wrote placeholder checkpoint dir {path}")
        except ImportError:
            log("tensorflow not available; writing generic state only.")
            path = f"{CHECKPOINT_DIR}/state_{timestamp}.json"
            with open(path, "w") as f:
                json.dump({
                    "timestamp": timestamp,
                    "status": "checkpointed",
                    "pod_name": pod_name,
                    "framework": "tensorflow_unavailable",
                }, f, indent=2)
            log(f"Wrote {path}")

    else:
        log("Framework: generic")
        path = f"{CHECKPOINT_DIR}/state_{timestamp}.json"
        with open(path, "w") as f:
            json.dump({
                "timestamp": timestamp,
                "status": "checkpointed",
                "pod_name": pod_name,
            }, f, indent=2)
        log(f"Wrote {path}")

    marker = f"{CHECKPOINT_DIR}/COMPLETE_{timestamp}"
    with open(marker, "w") as f:
        f.write(timestamp)
    log(f"Checkpoint complete marker: {marker}")
    log("Pre-Stop hook finished successfully.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        log(f"Error: {e}")
        sys.exit(1)
