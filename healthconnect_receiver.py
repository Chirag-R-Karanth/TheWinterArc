"""Standalone desktop archive for the existing Winter Arc Android companion."""

import argparse
from datetime import datetime
from decimal import Decimal, InvalidOperation
import getpass
from hmac import compare_digest
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import re
import socket
import sqlite3
import stat
import sys
from threading import Timer


ROUTE = "/api/v1/metrics"
MAX_BODY = 16 * 1024
REQUEST_SECONDS = 10
KEY_PATTERN = re.compile(r"[0-9a-f]{64}")
UNITS = {"steps": "steps", "heart_rate": "bpm", "sleep": "h"}
FIELDS = {"source", "sourceKey", "metricType", "unit", "start", "end"}


def sync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def private_mkdir(path):
    if not path.exists():
        private_mkdir(path.parent)
        path.mkdir(mode=0o700, exist_ok=True)
        sync_directory(path.parent)


def archive_path():
    base = Path(os.environ.get("XDG_DATA_HOME", ""))
    if not base.is_absolute():
        base = Path.home() / ".local/share"
    directory = base.resolve() / "winterarc-healthconnect"
    # Check both the selected path and the resolved XDG base for Git worktrees.
    for path in (base / directory.name, directory):
        if any(os.path.lexists(parent / ".git") for parent in (path, *path.parents)):
            raise ValueError("archive location is in a Git worktree")
    private_mkdir(directory)
    info = directory.lstat()
    if (not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid()
            or stat.S_IMODE(info.st_mode) != 0o700):
        raise ValueError("archive directory must be owned by this user and mode 0700")
    database = directory / "companion.sqlite3"
    # Precreate the database privately, without ever following a leaf symlink.
    fd = os.open(database, os.O_CREAT | os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600)
    try:
        info = os.fstat(fd)
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid()
                or stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1):
            raise ValueError("archive database must be a private regular file")
    finally:
        os.close(fd)
    sync_directory(directory)
    return database


def open_archive(path):
    connection = sqlite3.connect(path, timeout=2)
    try:
        if connection.execute("PRAGMA journal_mode=DELETE").fetchone()[0] != "delete":
            raise sqlite3.OperationalError("rollback journal unavailable")
        connection.execute("PRAGMA synchronous=EXTRA")
        with connection:
            connection.execute("""
                CREATE TABLE IF NOT EXISTS companion_payloads (
                    id INTEGER PRIMARY KEY,
                    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    payload BLOB NOT NULL UNIQUE
                )
            """)
    except BaseException:
        connection.close()
        raise
    return connection


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON member")
        result[key] = value
    return result


def reject_constant(_value):
    raise ValueError("non-finite number")


def validate(body):
    row = json.loads(body.decode("utf-8"), object_pairs_hook=unique_object,
                     parse_int=Decimal, parse_float=Decimal, parse_constant=reject_constant)
    if not isinstance(row, dict) or not FIELDS <= row.keys() <= FIELDS | {"value"}:
        raise ValueError("invalid field set")
    if (not all(isinstance(row[key], str) for key in FIELDS)
            or row["source"] != "healthconnect" or not row["sourceKey"].strip()
            or UNITS.get(row["metricType"]) != row["unit"]):
        raise ValueError("invalid metric")
    if "value" in row and not isinstance(row["value"], Decimal):
        raise ValueError("invalid value")
    dates = []
    for key in ("start", "end"):
        if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z", row[key]):
            raise ValueError("invalid timestamp")
        dates.append(datetime.strptime(row[key], "%Y-%m-%dT%H:%M:%SZ"))
    if dates[0] > dates[1]:
        raise ValueError("reversed interval")


class Receiver(HTTPServer):
    request_queue_size = 8

    def __init__(self, port, key, connection):
        self.key = key.encode("ascii")
        self.connection = connection
        super().__init__(("127.0.0.1", port), MetricHandler)

    def finish_request(self, request, address):
        # A wall-clock deadline also bounds clients that drip-feed headers/body.
        request.settimeout(REQUEST_SECONDS)

        def expire():
            try:
                request.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

        deadline = Timer(REQUEST_SECONDS, expire)
        deadline.daemon = True
        deadline.start()
        try:
            super().finish_request(request, address)
        finally:
            deadline.cancel()

    def handle_error(self, request, client_address):
        # Never emit exception details or request data.
        pass


class MetricHandler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send_error(self, code, message=None, explain=None):
        self.reply(code)

    def reply(self, code):
        self.close_connection = True
        self.send_response(code)
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.end_headers()

    def do_POST(self):
        if self.path != ROUTE:
            return self.reply(404)
        keys = self.headers.get_all("X-API-Key", [])
        if len(keys) != 1 or not compare_digest(keys[0].encode("latin-1"), self.server.key):
            return self.reply(401)
        if "Transfer-Encoding" in self.headers or "Expect" in self.headers:
            return self.reply(400)
        lengths = self.headers.get_all("Content-Length", [])
        if not lengths:
            return self.reply(411)
        if len(lengths) != 1 or not re.fullmatch(r"[0-9]+", lengths[0]):
            return self.reply(400)
        digits = lengths[0].lstrip("0")
        if len(digits) > len(str(MAX_BODY)) or int(digits or "0") > MAX_BODY:
            return self.reply(413)
        length = int(digits or "0")
        content_types = self.headers.get_all("Content-Type", [])
        if len(content_types) != 1 or self.headers.get_content_type() != "application/json":
            return self.reply(415)
        body = self.rfile.read(length)
        if len(body) != length:
            return self.reply(400)
        try:
            validate(body)
        except (ValueError, InvalidOperation, RecursionError):
            return self.reply(400)
        try:
            with self.server.connection:
                self.server.connection.execute(
                    "INSERT INTO companion_payloads(payload) VALUES (?) "
                    "ON CONFLICT(payload) DO NOTHING", (body,),
                )
        except sqlite3.Error:
            return self.reply(503)
        self.reply(200)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("port must be in 1..65535")
    try:
        # Fail closed if getpass cannot disable echo.
        import warnings

        with warnings.catch_warnings():
            warnings.simplefilter("error", getpass.GetPassWarning)
            key = getpass.getpass("Companion API key: ")
        if not KEY_PATTERN.fullmatch(key):
            parser.error("enter a 64-character lowercase hex key")
        archive = open_archive(archive_path())
        try:
            with Receiver(args.port, key, archive) as server:
                print(f"Health Connect receiver listening on 127.0.0.1:{args.port}", flush=True)
                server.serve_forever()
        finally:
            archive.close()
    except KeyboardInterrupt:
        return 0
    except (OSError, ValueError, sqlite3.Error, EOFError, getpass.GetPassWarning):
        print("Receiver startup failed: check terminal, port and private XDG archive permissions.",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
