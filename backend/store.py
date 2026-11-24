"""Local persistence for explicitly synthetic Phase 01 fixtures."""

import hashlib
import json
import math
import os
import re
import sqlite3
import stat
import tempfile
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path


_DB = "store.sqlite3"
_SOURCE = "synthetic_fixture"
_VERSION = 1
_APP_ID = 0x54574132
_MAX_PAYLOAD = 8 * 1024 * 1024
_TIMESTAMP = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}"
    r"(?:\.[0-9]{1,6})?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])"
)
_MANIFEST = "id, source, sha256, imported_at, row_count"


def _utc(value):
    return value.astimezone(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def _unique_object(pairs):
    result = dict(pairs)
    if len(result) != len(pairs):
        raise ValueError("duplicate fixture object key")
    return result


def _parse(payload):
    if not isinstance(payload, bytes) or len(payload) > _MAX_PAYLOAD:
        raise ValueError("fixture must be bytes (at most 8 MiB)")
    try:
        data = json.loads(payload.decode("utf-8"), object_pairs_hook=_unique_object)
    except (ValueError, RecursionError) as exc:
        raise ValueError("invalid UTF-8 fixture JSON") from exc
    if not isinstance(data, list):
        raise ValueError("fixture must be a JSON array")
    rows = []
    for index, row in enumerate(data):
        if not isinstance(row, dict) or row.keys() != {"metric", "value", "unit", "observed_at"}:
            raise ValueError(f"invalid fields at fixture index {index}")
        metric, value, unit, original = (row[k] for k in ("metric", "value", "unit", "observed_at"))
        try:
            if not all(isinstance(s, str) and s.strip() and s.isprintable() for s in (metric, unit)):
                raise ValueError
            metric.encode("utf-8")
            unit.encode("utf-8")
            if value is not None and (type(value) not in (int, float) or not math.isfinite(value)):
                raise ValueError
            if type(value) is int and not -(2**63) <= value < 2**63:
                raise ValueError
            if not isinstance(original, str) or not _TIMESTAMP.fullmatch(original):
                raise ValueError
            utc = _utc(datetime.fromisoformat(original.replace("Z", "+00:00")))
        except (ValueError, OverflowError) as exc:
            raise ValueError(f"invalid measurement at fixture index {index}") from exc
        rows.append((index, metric, value, unit, utc, original, "missing" if value is None else "synthetic"))
    return rows


def _private(path, *, directory=False):
    info = path.lstat()
    kind = stat.S_ISDIR if directory else stat.S_ISREG
    required = 0o700 if directory else 0o600
    if (not kind(info.st_mode) or info.st_uid != os.getuid()
            or stat.S_IMODE(info.st_mode) != required
            or (not directory and info.st_nlink != 1)):
        raise ValueError(f"expected a private {'directory' if directory else 'file'}")


def _connect(path, mode):
    conn = sqlite3.connect(f"{path.absolute().as_uri()}?mode={mode}", uri=True)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA trusted_schema = OFF")
    return conn


def _identity(conn):
    return tuple(conn.execute(f"PRAGMA {key}").fetchone()[0] for key in ("application_id", "user_version"))


def _verify(conn):
    if _identity(conn) != (_APP_ID, _VERSION):
        raise ValueError("unsupported snapshot schema")
    if [tuple(row) for row in conn.execute("PRAGMA integrity_check")] != [("ok",)]:
        raise ValueError("snapshot failed SQLite integrity check")
    if conn.execute("PRAGMA foreign_key_check").fetchone() is not None:
        raise ValueError("snapshot failed foreign key check")
    for digest, payload, expected, actual in conn.execute("""
        SELECT sha256, payload, row_count,
               (SELECT count(*) FROM measurements WHERE import_id = imports.id)
        FROM imports
    """):
        if hashlib.sha256(payload).hexdigest() != digest or expected != actual:
            raise ValueError("snapshot failed fixture provenance check")


def _snapshot(source, destination):
    # Publish only a complete verified file, without replacing an existing path.
    fd, name = tempfile.mkstemp(prefix=".store-", dir=destination.parent)
    os.close(fd)
    temporary = Path(name)
    try:
        with closing(_connect(temporary, "rw")) as target:
            source.backup(target)
            _verify(target)
        with temporary.open("rb") as handle:
            os.fsync(handle.fileno())
        os.link(temporary, destination)
    finally:
        temporary.unlink()


class Store:
    """SQLite store rooted in a caller-selected private data directory."""

    def __init__(self, root: Path):
        self.root = Path(root).absolute()
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        _private(self.root, directory=True)
        self.path = self.root / _DB
        try:
            os.close(os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600))
        except FileExistsError:
            pass
        with closing(self._connection()) as conn, conn:
            conn.execute("BEGIN IMMEDIATE")
            identity = _identity(conn)
            if identity == (_APP_ID, _VERSION):
                return
            if identity != (0, 0) or conn.execute("SELECT 1 FROM sqlite_schema LIMIT 1").fetchone():
                raise ValueError("unsupported store schema")
            # Initial migration only applies to an empty database.
            conn.execute("""CREATE TABLE imports (
                id INTEGER PRIMARY KEY, source TEXT NOT NULL,
                sha256 TEXT NOT NULL UNIQUE, payload BLOB NOT NULL,
                imported_at TEXT NOT NULL, row_count INTEGER NOT NULL CHECK (row_count >= 0)
            )""")
            conn.execute("""CREATE TABLE measurements (
                id INTEGER PRIMARY KEY, import_id INTEGER NOT NULL REFERENCES imports(id),
                raw_index INTEGER NOT NULL CHECK (raw_index >= 0), metric TEXT NOT NULL,
                value CHECK (typeof(value) IN ('null', 'integer', 'real')),
                unit TEXT NOT NULL, observed_at TEXT NOT NULL,
                original_observed_at TEXT NOT NULL, quality TEXT NOT NULL,
                UNIQUE (import_id, raw_index)
            )""")
            conn.execute("CREATE INDEX measurements_time ON measurements(observed_at, id)")
            conn.execute(f"PRAGMA application_id = {_APP_ID}")
            conn.execute(f"PRAGMA user_version = {_VERSION}")

    def _connection(self):
        _private(self.root, directory=True)
        _private(self.path)
        for suffix in ("-journal", "-wal", "-shm"):
            try:
                _private(self.path.with_name(self.path.name + suffix))
            except FileNotFoundError:
                pass
        return _connect(self.path, "rw")

    def import_fixture(self, payload: bytes) -> dict:
        """Import caller-designated synthetic JSON; exact retries return the same manifest."""
        rows = _parse(payload)
        digest = hashlib.sha256(payload).hexdigest()
        with closing(self._connection()) as conn, conn:
            conn.execute("BEGIN IMMEDIATE")
            existing = conn.execute(f"SELECT {_MANIFEST} FROM imports WHERE sha256 = ?", (digest,)).fetchone()
            if existing is not None:
                return {**dict(existing), "duplicate": True}
            imported_at = _utc(datetime.now(timezone.utc))
            import_id = conn.execute("""
                INSERT INTO imports (source, sha256, payload, imported_at, row_count)
                VALUES (?, ?, ?, ?, ?)
            """, (_SOURCE, digest, payload, imported_at, len(rows))).lastrowid
            conn.executemany("""
                INSERT INTO measurements (import_id, raw_index, metric, value, unit,
                                          observed_at, original_observed_at, quality)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, ((import_id, *row) for row in rows))
            return dict(id=import_id, source=_SOURCE, sha256=digest, imported_at=imported_at,
                        row_count=len(rows), duplicate=False)

    def imports(self) -> list[dict]:
        with closing(self._connection()) as conn:
            return [dict(row) for row in conn.execute(f"SELECT {_MANIFEST} FROM imports ORDER BY id")]

    def series(self) -> list[dict]:
        with closing(self._connection()) as conn:
            return [dict(row) for row in conn.execute("""
                SELECT measurements.*, imports.source, imports.imported_at, imports.sha256
                FROM measurements JOIN imports ON imports.id = measurements.import_id
                ORDER BY observed_at, measurements.id
            """)]

    def backup(self, destination: Path) -> Path:
        """Write a verified snapshot to a new file in an existing directory."""
        destination = Path(destination).absolute()
        with closing(self._connection()) as source:
            _snapshot(source, destination)
        return destination

    @classmethod
    def restore(cls, backup: Path, destination: Path) -> "Store":
        """Restore a private snapshot into a new directory; never replace a live store."""
        backup, destination = Path(backup).absolute(), Path(destination).absolute()
        _private(backup)
        destination.mkdir(mode=0o700)
        try:
            # Our backups are standalone files, so ignore any adjacent sidecars.
            with closing(_connect(backup, "ro&immutable=1")) as source:
                _snapshot(source, destination / _DB)
        except BaseException:
            destination.rmdir()
            raise
        return cls(destination)
