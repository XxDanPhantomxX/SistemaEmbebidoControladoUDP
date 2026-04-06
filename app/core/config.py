import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    esp32_port: int = int(os.getenv("ESP32_PORT", "5005"))
    multicast_group: str = os.getenv("MULTICAST_GROUP", "239.1.1.1")
    multicast_port: int = int(os.getenv("MULTICAST_PORT", "5006"))
    unicast_timeout_seconds: float = float(os.getenv("UNICAST_TIMEOUT_SECONDS", "3"))
    db_path: str = os.getenv("IOT_DB_PATH", "iot_data.db")


settings = Settings()
