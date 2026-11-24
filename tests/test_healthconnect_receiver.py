from concurrent.futures import Future
from contextlib import closing, contextmanager
from http.client import HTTPConnection
import json
import socket
import sqlite3
from threading import Thread

import pytest

import healthconnect_receiver as receiver


KEY = "a" * 64  # Fixture only.
METRIC = {
    "source": "healthconnect", "sourceKey": "hc_hr_fixture", "metricType": "heart_rate",
    "unit": "bpm", "start": "2026-11-24T10:00:00Z", "end": "2026-11-24T10:01:00Z",
}
BODY = json.dumps(METRIC, separators=(",", ":")).encode()


@pytest.fixture
def database(tmp_path, monkeypatch):
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path / "xdg"))
    return receiver.archive_path()


@contextmanager
def listening(database):
    ready = Future()

    def run():
        try:
            with closing(receiver.open_archive(database)) as archive:
                with receiver.Receiver(0, KEY, archive) as server:
                    ready.set_result(server)
                    server.serve_forever(poll_interval=0.01)
        except Exception as exc:
            if ready.done():
                raise
            ready.set_exception(exc)

    thread = Thread(target=run, daemon=True)
    thread.start()
    server = ready.result(timeout=5)
    try:
        assert server.server_address[0] == "127.0.0.1"
        yield server.server_port
    finally:
        server.shutdown()
        thread.join(timeout=5)


def post(port, body=BODY, path=receiver.ROUTE, **headers):
    request_headers = {"X-API-Key": KEY, "Content-Type": "application/json; charset=utf-8"}
    request_headers.update(headers)
    with closing(HTTPConnection("127.0.0.1", port, timeout=5)) as client:
        client.request("POST", path, body, request_headers)
        with client.getresponse() as response:
            assert response.read() == b""
            return response.status


def rows(database):
    with closing(sqlite3.connect(database)) as archive:
        return archive.execute("SELECT payload FROM companion_payloads ORDER BY id").fetchall()


def test_ack_exact_bytes_restart_and_preserve_changed_payload(database):
    corrected = json.dumps(dict(METRIC, value=71.5)).encode()
    with listening(database) as port:
        assert post(port) == 200  # Nullable heart rate is omitted by ApiClient.
        assert rows(database) == [(BODY,)]  # Visible to another connection on ACK.
        assert post(port) == 200
    with listening(database) as port:
        assert post(port) == 200
        assert post(port, corrected) == 200
    assert rows(database) == [(BODY,), (corrected,)]
    assert database.parent.stat().st_mode & 0o777 == 0o700
    assert database.stat().st_mode & 0o777 == 0o600


def test_commit_failure_is_not_acknowledged_and_retry_succeeds(database):
    with listening(database) as port:
        with closing(sqlite3.connect(database)) as reader:
            reader.execute("BEGIN")
            assert reader.execute("SELECT * FROM companion_payloads").fetchall() == []
            # A reader permits a RESERVED write lock but prevents commit in DELETE mode.
            assert post(port) == 503
            reader.rollback()
        assert rows(database) == []
        assert post(port) == 200
        assert rows(database) == [(BODY,)]


def test_rejects_invalid_requests_without_logging_or_archiving(database, capsys):
    with listening(database) as port:
        assert post(port, **{"X-API-Key": "wrong"}) == 401
        assert post(port, path="/not-metrics") == 404
        assert post(port, **{"Content-Type": "text/plain"}) == 415
        assert post(port, **{"Content-Length": str(receiver.MAX_BODY + 1)}) == 413
        assert post(port, **{"Transfer-Encoding": "chunked"}) == 400
        assert post(port, b"not-json") == 400
        assert post(port, BODY[:-1] + b',"value":NaN}') == 400
        assert post(port, BODY[:-1] + b',"source":"healthconnect"}') == 400
        with socket.create_connection(("127.0.0.1", port), timeout=5) as sock:
            sock.sendall((f"POST {receiver.ROUTE} HTTP/1.1\r\nX-API-Key: {KEY}\r\n"
                          "Content-Length: 10\r\nContent-Type: application/json\r\n\r\n{").encode())
            sock.shutdown(socket.SHUT_WR)
            with sock.makefile("rb") as response:
                assert response.readline().split()[1] == b"400"
    assert rows(database) == []
    assert capsys.readouterr() == ("", "")


def test_stalled_client_releases_single_receiver(database, monkeypatch):
    monkeypatch.setattr(receiver, "REQUEST_SECONDS", 0.5)
    with listening(database) as port:
        with socket.create_connection(("127.0.0.1", port), timeout=3) as sock:
            sock.sendall(b"POST /api/v1/metrics HTTP/1.1\r\n")
            assert sock.recv(1) == b""
        for metric, unit, value in [("steps", "steps", 1234.0), ("sleep", "h", 7.5)]:
            assert post(port, json.dumps(dict(METRIC, metricType=metric, unit=unit,
                                              sourceKey=f"hc_{metric}_fixture", value=value))) == 200
    assert len(rows(database)) == 2


def test_archive_rejects_git_paths_and_symlink_database(tmp_path, monkeypatch, database):
    worktree = tmp_path / "worktree"
    worktree.mkdir()
    (worktree / ".git").touch()
    monkeypatch.setenv("XDG_DATA_HOME", str(worktree / "data"))
    with pytest.raises(ValueError, match="Git worktree"):
        receiver.archive_path()
    assert not (worktree / "data").exists()
    monkeypatch.setenv("XDG_DATA_HOME", str(database.parent.parent))
    database.unlink()
    database.symlink_to(tmp_path / "not-an-archive")
    with pytest.raises(OSError):
        receiver.archive_path()
