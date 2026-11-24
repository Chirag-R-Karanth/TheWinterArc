import hashlib
import json
import sqlite3
import stat
from contextlib import closing

import pytest

from backend.store import Store


ROW = dict(metric="synthetic_weight", value=0, unit="kg", observed_at="2026-01-02T01:00:00+02:00")
PAYLOAD = (json.dumps([dict(ROW, value=None, observed_at="2026-01-02T00:00:00Z"), ROW],
                      indent=2) + "\n").encode()


def test_restart_exact_archive_idempotency_and_provenance(tmp_path):
    store = Store(tmp_path / "data")
    assert store.imports() == store.series() == []
    manifest = store.import_fixture(PAYLOAD)
    assert manifest == dict(id=1, source="synthetic_fixture", sha256=hashlib.sha256(PAYLOAD).hexdigest(),
                            imported_at=manifest["imported_at"], row_count=2, duplicate=False)

    store = Store(store.root)
    assert store.import_fixture(PAYLOAD) == dict(manifest, duplicate=True)
    assert store.imports() == [{k: v for k, v in manifest.items() if k != "duplicate"}]
    zero, missing = store.series()
    assert zero == dict(id=2, import_id=1, raw_index=1, metric=ROW["metric"], value=0, unit="kg",
                        observed_at="2026-01-01T23:00:00.000000Z",
                        original_observed_at=ROW["observed_at"], quality="synthetic",
                        source=manifest["source"], sha256=manifest["sha256"], imported_at=manifest["imported_at"])
    assert missing["value"] is None and missing["quality"] == "missing"
    with closing(sqlite3.connect(store.path)) as conn:
        assert conn.execute("SELECT payload FROM imports").fetchall() == [(PAYLOAD,)]
        assert conn.execute("PRAGMA user_version").fetchone() == (1,)
        assert conn.execute("PRAGMA foreign_key_list(measurements)").fetchone()[2] == "imports"


@pytest.mark.parametrize("payload", [
    b"{}", b"[null]", b"[", b"\xff", b"[" + b" " * (8 * 1024 * 1024) + b"]",
    b'[{"metric":"a","metric":"b","unit":"x","value":1,"observed_at":"2026-01-02T00:00:00Z"}]',
    *(json.dumps([ROW, dict(ROW, **change)]).encode() for change in (
        {"observed_at": "2026-01-02T01:00:00"}, {"observed_at": "2026-02-30T00:00:00Z"},
        {"observed_at": "2026-01-02T01:00:00+02:99"}, {"value": True}, {"value": "0"},
        {"value": float("nan")}, {"value": float("inf")}, {"unit": " "}, {"metric": "\ud800"},
        {"extra": "unexpected"}, {"value": 2**63},
    )),
])
def test_invalid_fixture_leaves_no_data(tmp_path, payload):
    store = Store(tmp_path / "data")
    with pytest.raises(ValueError):
        store.import_fixture(payload)
    assert store.imports() == store.series() == []


def test_database_error_rolls_back_archive_and_partial_measurements(tmp_path):
    store = Store(tmp_path / "data")
    baseline = store.import_fixture(b"[]")
    with closing(sqlite3.connect(store.path)) as conn, conn:
        conn.execute("""CREATE TRIGGER fail_second BEFORE INSERT ON measurements
                        WHEN NEW.raw_index = 1 BEGIN SELECT RAISE(ABORT, 'injected failure'); END""")
    with pytest.raises(sqlite3.IntegrityError, match="injected failure"):
        store.import_fixture(PAYLOAD)
    assert [row["id"] for row in store.imports()] == [baseline["id"]]
    assert store.series() == []
    with closing(sqlite3.connect(store.path)) as conn, conn:
        assert conn.execute("SELECT payload FROM imports").fetchall() == [(b"[]",)]
        conn.execute("DROP TRIGGER fail_second")
    assert store.import_fixture(PAYLOAD)["duplicate"] is False


def test_backup_restore_isolated_and_private(tmp_path):
    store = Store(tmp_path / "live")
    store.import_fixture(PAYLOAD)
    manifests, series = store.imports(), store.series()
    backup = store.backup(tmp_path / "snapshot.sqlite3")
    store.import_fixture(b"[]")
    with pytest.raises(FileExistsError):
        store.backup(backup)
    with pytest.raises(FileExistsError):
        Store.restore(backup, store.root)
    restored = Store.restore(backup, tmp_path / "isolated")
    assert restored.imports() == manifests and restored.series() == series
    assert restored.import_fixture(PAYLOAD)["duplicate"] is True
    with closing(sqlite3.connect(restored.path)) as conn:
        assert conn.execute("SELECT payload FROM imports").fetchall() == [(PAYLOAD,)]
    for directory in (store.root, restored.root):
        assert stat.S_IMODE(directory.stat().st_mode) == 0o700
    for file in (store.path, restored.path, backup):
        assert stat.S_IMODE(file.stat().st_mode) == 0o600


def test_restore_rejects_changed_archive_and_cleans_up(tmp_path):
    store = Store(tmp_path / "data")
    store.import_fixture(PAYLOAD)
    backup = store.backup(tmp_path / "snapshot.sqlite3")
    with closing(sqlite3.connect(backup)) as conn, conn:
        conn.execute("UPDATE imports SET payload = ?", (b"[]",))
    destination = tmp_path / "isolated"
    with pytest.raises(ValueError, match="provenance"):
        Store.restore(backup, destination)
    assert not destination.exists()


def test_open_rejects_unknown_schema_and_symlinks(tmp_path):
    store = Store(tmp_path / "data")
    for name, target in (("linked-root", store.root), ("linked-backup", store.path)):
        (tmp_path / name).symlink_to(target)
    with pytest.raises(ValueError, match="private directory"):
        Store(tmp_path / "linked-root")
    with pytest.raises(ValueError, match="private file"):
        Store.restore(tmp_path / "linked-backup", tmp_path / "isolated")
    with closing(sqlite3.connect(store.path)) as conn, conn:
        conn.execute("PRAGMA user_version = 2")
    with pytest.raises(ValueError, match="unsupported store schema"):
        Store(store.root)
    with closing(sqlite3.connect(store.path)) as conn:
        assert conn.execute("PRAGMA user_version").fetchone() == (2,)
