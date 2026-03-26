from datetime import datetime, timezone

from pydantic import BaseModel


class CommandMessage(BaseModel):
    command: str


class ResponseMessage(BaseModel):
    type: str = "response"
    timestamp: str
    command: str
    resp: str


class EventMessage(BaseModel):
    type: str = "event"
    timestamp: str
    message: str


def utc_iso_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()
