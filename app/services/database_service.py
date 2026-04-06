import sqlite3
import threading
from pathlib import Path
from typing import Any


class DatabaseService:
    def __init__(self, db_path: str) -> None:
        self.db_path = Path(db_path)
        if self.db_path.parent != Path("."):
            self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self._lock = threading.Lock()
        self._connection = sqlite3.connect(
            str(self.db_path),
            check_same_thread=False,
        )
        self._connection.row_factory = sqlite3.Row

        self._configure_connection()
        self._create_schema()

    def _configure_connection(self) -> None:
        with self._lock:
            self._connection.execute("PRAGMA journal_mode=WAL;")
            self._connection.execute("PRAGMA synchronous=NORMAL;")
            self._connection.commit()

    def _create_schema(self) -> None:
        with self._lock:
            self._connection.execute(
                """
                CREATE TABLE IF NOT EXISTS telemetry (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    device_id TEXT NOT NULL,
                    temperature REAL,
                    humidity REAL
                )
                """
            )
            self._connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_telemetry_device_timestamp
                ON telemetry(device_id, timestamp DESC)
                """
            )
            self._connection.commit()

    def insert_telemetry(
        self,
        timestamp: str,
        device_id: str,
        temperature: float | None,
        humidity: float | None,
    ) -> None:
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO telemetry (timestamp, device_id, temperature, humidity)
                VALUES (?, ?, ?, ?)
                """,
                (timestamp, device_id, temperature, humidity),
            )
            self._connection.commit()

    def get_history(self, device_id: str, limit: int = 50) -> list[dict[str, Any]]:
        # `limit=0` means full history for dashboard hydration.
        with self._lock:
            if limit <= 0:
                rows = self._connection.execute(
                    """
                    SELECT timestamp, device_id, temperature, humidity
                    FROM telemetry
                    WHERE device_id = ?
                    ORDER BY id DESC
                    """,
                    (device_id,),
                ).fetchall()
            else:
                bounded_limit = max(1, min(limit, 10000))
                rows = self._connection.execute(
                    """
                    SELECT timestamp, device_id, temperature, humidity
                    FROM telemetry
                    WHERE device_id = ?
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (device_id, bounded_limit),
                ).fetchall()

        return [
            {
                "timestamp": row["timestamp"],
                "device_id": row["device_id"],
                "temperature": row["temperature"],
                "humidity": row["humidity"],
            }
            for row in rows
        ]

    def close(self) -> None:
        with self._lock:
            self._connection.close()
