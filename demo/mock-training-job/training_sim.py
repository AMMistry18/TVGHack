"""
C2G Mock Training Job
Simulates a long-running AI training loop with checkpoint support.
When it receives SIGTERM (from K8s pre-stop hook), it saves state and exits cleanly.
When restarted, it resumes from the last checkpoint.

This is what runs inside the demo pod to make the "training survives grid emergency" demo work.
"""
import json
import os
import signal
import sys
import time
from datetime import datetime, timezone

CHECKPOINT_DIR = os.environ.get("CHECKPOINT_DIR", "/checkpoints")
LATEST_FILE = os.path.join(CHECKPOINT_DIR, "LATEST")


def ensure_checkpoint_dir():
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)


def load_latest_checkpoint():
    """Return (epoch, loss, training_time_seconds, checkpoint_reason, timestamp) or None."""
    if not os.path.isfile(LATEST_FILE):
        return None
    try:
        with open(LATEST_FILE, "r") as f:
            filename = f.read().strip()
        path = os.path.join(CHECKPOINT_DIR, filename)
        if not os.path.isfile(path):
            return None
        with open(path, "r") as f:
            data = json.load(f)
        return (
            data.get("epoch", 0),
            data.get("loss", 10.0),
            data.get("training_time_seconds", 0),
            data.get("checkpoint_reason", "emergency"),
            data.get("timestamp", ""),
        )
    except Exception:
        return None


def save_checkpoint(epoch: int, loss: float, training_time_seconds: float, reason: str):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if reason == "emergency":
        filename = f"emergency_{epoch}_{ts.replace(':', '-').replace('.', '-')}.json"
    else:
        filename = f"auto_{epoch}.json"
    path = os.path.join(CHECKPOINT_DIR, filename)
    data = {
        "epoch": epoch,
        "loss": round(loss, 4),
        "training_time_seconds": int(training_time_seconds),
        "checkpoint_reason": reason,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model_state": {"layer1": "simulated", "layer2": "simulated"},
    }
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    with open(LATEST_FILE, "w") as f:
        f.write(filename)
    return path


def main():
    ensure_checkpoint_dir()
    start_wall = time.monotonic()

    checkpoint = load_latest_checkpoint()
    if checkpoint is not None:
        start_epoch, current_loss, elapsed_so_far, reason, ts = checkpoint
        print(f"🔄 Resuming from epoch {start_epoch} (grid emergency recovery)")
        base_time = float(elapsed_so_far)
    else:
        print("🚀 Starting fresh training run")
        start_epoch = 0
        current_epoch = 0
        current_loss = 10.0
        base_time = 0.0

    shutdown_requested = [False]  # use list so closure can mutate

    def sigterm_handler(signum, frame):
        print("⚡ C2G SIGNAL RECEIVED — Grid emergency detected. Saving checkpoint...", flush=True)
        shutdown_requested[0] = True

    signal.signal(signal.SIGTERM, sigterm_handler)

    for epoch in range(start_epoch + 1, 10001):
        if shutdown_requested[0]:
            break
        # Simulate training step: loss decreases with noise
        current_loss = current_loss - 0.001 + (os.urandom(1)[0] / 255.0 - 0.5) * 0.0004
        current_loss = max(0.01, current_loss)
        training_time_seconds = base_time + (time.monotonic() - start_wall)

        if epoch % 10 == 0:
            print(f"Epoch {epoch}/10000 | Loss: {current_loss:.4f} | Time: {int(training_time_seconds)}s", flush=True)
        if epoch % 50 == 0:
            save_checkpoint(epoch, current_loss, training_time_seconds, "auto")

    if shutdown_requested[0]:
        # Save emergency checkpoint: last completed epoch is epoch - 1
        last_epoch = epoch - 1
        save_checkpoint(last_epoch, current_loss, base_time + (time.monotonic() - start_wall), "emergency")
        print("✅ Checkpoint saved. Safe to terminate.", flush=True)
        sys.exit(0)

    print("Training complete.", flush=True)
    sys.exit(0)


if __name__ == "__main__":
    main()
