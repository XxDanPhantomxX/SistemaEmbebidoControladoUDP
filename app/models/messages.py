from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel


class CommandMessage(BaseModel):
    target: Optional[str] = None
    command: str


class ResponseMessage(BaseModel):
    type: str = "response"
    timestamp: str
    target: Optional[str] = None
    ip: Optional[str] = None
    command: str
    resp: str


class EventMessage(BaseModel):
    type: str = "event"
    timestamp: str
    device_id: Optional[str] = None
    ip: Optional[str] = None
    temp: Optional[float] = None
    hum: Optional[float] = None
    message: Optional[str] = None


class DeviceState(BaseModel):
    device_id: str
    ip: str
    last_seen: str
    last_temp: Optional[float] = None
    last_hum: Optional[float] = None


class DevicesUpdateMessage(BaseModel):
    type: str = "devices_update"
    timestamp: str
    devices: list[DeviceState]


def utc_iso_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()
