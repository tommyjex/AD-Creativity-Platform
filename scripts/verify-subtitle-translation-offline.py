"""Run pytest with paid smoke disabled and process-level TCP isolation."""

from __future__ import annotations

import json
import os
import socket
import sys


def main() -> int:
    os.environ["RUN_PAID_MODELARK_SMOKE"] = "false"
    os.environ["TLS_ENABLED"] = "false"
    blocked: list[str] = []
    original_connect = socket.socket.connect
    original_connect_ex = socket.socket.connect_ex

    def deny_tcp(sock, address):
        if sock.family in (socket.AF_INET, socket.AF_INET6):
            blocked.append("tcp")
            raise RuntimeError("Offline acceptance forbids TCP connections")
        return original_connect(sock, address)

    def deny_tcp_ex(sock, address):
        if sock.family in (socket.AF_INET, socket.AF_INET6):
            blocked.append("tcp")
            raise RuntimeError("Offline acceptance forbids TCP connections")
        return original_connect_ex(sock, address)

    socket.socket.connect = deny_tcp
    socket.socket.connect_ex = deny_tcp_ex
    try:
        import pytest

        result = pytest.main(sys.argv[1:])
    finally:
        socket.socket.connect = original_connect
        socket.socket.connect_ex = original_connect_ex
        print(json.dumps({
            "paid_smoke_enabled": False,
            "tcp_connections_allowed": 0,
            "blocked_tcp_attempts": len(blocked),
        }))
    return int(result)


if __name__ == "__main__":
    raise SystemExit(main())
