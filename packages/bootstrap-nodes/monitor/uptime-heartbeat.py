#!/usr/bin/env python3
"""Uptime heartbeat side-car.

Runs alongside the Wattz node-runtime and posts a small JSON heartbeat
to a caller-supplied status URL every 30 seconds. Used by the Wattz
status page (https://wattz.fi/status) to plot per-node uptime independent
of the routing engine.

Environment:
  WATTZ_STATUS_URL          POST target, e.g. https://wattz.fi/status/hb
  WATTZ_STATUS_TOKEN        Bearer token for the status API.
  WATTZ_NODE_ID             Node identifier (matches heartbeat).
  WATTZ_NODE_METRICS_URL    Node runtime metrics URL
                            (default http://localhost:8081/metrics).
  UPTIME_HB_INTERVAL        Seconds between beats (default 30).
"""

from __future__ import annotations

import json
import os
import platform
import signal
import socket
import sys
import time
from typing import Any
from urllib import error, request

DEFAULT_INTERVAL = 30
DEFAULT_METRICS_URL = "http://localhost:8081/metrics"


def _fetch_metrics(url: str, timeout: float = 5.0) -> dict[str, float]:
    """Best-effort scrape of the runtime's /metrics endpoint."""
    try:
        with request.urlopen(url, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
    except (error.URLError, TimeoutError, OSError):
        return {}
    out: dict[str, float] = {}
    for line in body.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        key = parts[0].split("{", 1)[0]
        try:
            out[key] = float(parts[-1])
        except ValueError:
            continue
    return out


def _post(url: str, token: str | None, payload: dict[str, Any]) -> bool:
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "content-type": "application/json",
            "user-agent": "wattz-uptime-heartbeat/0.1",
        },
    )
    if token:
        req.add_header("authorization", f"Bearer {token}")
    try:
        with request.urlopen(req, timeout=10.0) as resp:
            return 200 <= resp.status < 300
    except (error.URLError, TimeoutError, OSError):
        return False


def _running() -> bool:
    return not _stop


_stop = False


def _handle_signal(_signum: int, _frame: object) -> None:
    global _stop
    _stop = True


def main() -> int:
    status_url = os.environ.get("WATTZ_STATUS_URL")
    if not status_url:
        print("WATTZ_STATUS_URL is required", file=sys.stderr)
        return 2
    metrics_url = os.environ.get("WATTZ_NODE_METRICS_URL", DEFAULT_METRICS_URL)
    node_id = os.environ.get("WATTZ_NODE_ID", socket.gethostname())
    token = os.environ.get("WATTZ_STATUS_TOKEN")
    interval = int(os.environ.get("UPTIME_HB_INTERVAL", str(DEFAULT_INTERVAL)))

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    started_at = time.time()
    while _running():
        metrics = _fetch_metrics(metrics_url)
        payload = {
            "node_id": node_id,
            "hostname": socket.gethostname(),
            "platform": platform.platform(),
            "uptime_seconds": int(time.time() - started_at),
            "metrics": metrics,
            "timestamp": int(time.time()),
        }
        ok = _post(status_url, token, payload)
        if not ok:
            print(f"[uptime-heartbeat] status POST failed to {status_url}", file=sys.stderr)
        time.sleep(interval)
    return 0


if __name__ == "__main__":
    sys.exit(main())
