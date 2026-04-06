import asyncio                                                                   # Run background tasks
from collections.abc import AsyncIterator                                        # For async context manager
from contextlib import asynccontextmanager                                       # For managing app lifespan
from pathlib import Path
from typing import Any, cast                                                     # For type hinting
from fastapi import FastAPI, Query                                               # Web framework
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.api.ws import router as ws_router                                       # WebSocket API routes
from app.core.config import settings                                             # Configuration settings
from app.models.messages import EventMessage, utc_iso_timestamp                  # Message models and timestamp function
from app.services.connection_manager import ConnectionManager                    # Manages WebSocket connections
from app.services.database_service import DatabaseService
from app.services.multicast_service import MulticastService                      # Listens for multicast events
from app.services.udp_service import UdpService                                  # Handles UDP communication with ESP32


def parse_multicast_event(message: str) -> tuple[str, float | None, float | None] | None:
    raw = message.strip()
    if not raw:
        return None

    content = raw.split(":", 1)[1] if ":" in raw else raw
    fields: dict[str, str] = {}
    for item in content.replace(",", ";").split(";"):
        if "=" not in item:
            continue
        key, value = item.split("=", 1)
        fields[key.strip().upper()] = value.strip()

    device_id = fields.get("ID") or fields.get("DEVICE")
    temp_text = fields.get("TEMP")
    hum_text = fields.get("HUM")
    if not device_id:
        return None

    temp: float | None = None
    hum: float | None = None

    if temp_text:
        try:
            temp = float(temp_text.replace(",", "."))
        except ValueError:
            temp = None

    if hum_text:
        try:
            hum = float(hum_text.replace(",", "."))
        except ValueError:
            hum = None

    return device_id, temp, hum


async def multicast_dispatcher(app: FastAPI) -> None:
    service = app.state.multicast_service
    manager = app.state.connection_manager
    db_service = app.state.db_service

    while True:
        payload = await service.get_event()
        raw_message = payload.get("message", "")
        source_ip = payload.get("source_ip")

        parsed = parse_multicast_event(raw_message)
        if parsed and source_ip:
            device_id, temp, hum = parsed
            device_state, _ = manager.register_device(
                device_id=device_id,
                ip=source_ip,
                temp=temp,
                hum=hum,
            )

            event = EventMessage(
                timestamp=utc_iso_timestamp(),
                device_key=device_state.device_key,
                device_id=device_state.device_id,
                ip=device_state.ip,
                temp=temp,
                hum=hum,
                message=raw_message,
            )
            await asyncio.to_thread(
                db_service.insert_telemetry,
                timestamp=event.timestamp,
                device_id=device_state.device_id,
                temperature=temp,
                humidity=hum,
            )
            await manager.broadcast(event.model_dump())
            await manager.broadcast(manager.get_devices_update().model_dump())
            continue

        if source_ip:
            print(f"Evento multicast descartado de {source_ip}: {raw_message}")

        event = EventMessage(timestamp=utc_iso_timestamp(), message=raw_message)
        fallback_device_id = parsed[0] if parsed else "UNKNOWN"
        fallback_temp = parsed[1] if parsed else None
        fallback_hum = parsed[2] if parsed else None
        await asyncio.to_thread(
            db_service.insert_telemetry,
            timestamp=event.timestamp,
            device_id=fallback_device_id,
            temperature=fallback_temp,
            humidity=fallback_hum,
        )
        await manager.broadcast(event.model_dump())


@asynccontextmanager                                                             # Decorator to manage startup and shutdown
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.connection_manager = ConnectionManager()
    app.state.db_service = DatabaseService(settings.db_path)
    app.state.udp_service = UdpService(
        esp32_port=settings.esp32_port,
        timeout_seconds=settings.unicast_timeout_seconds,
    )
    app.state.multicast_service = MulticastService(
        group=settings.multicast_group,
        port=settings.multicast_port
    )

    loop = asyncio.get_running_loop()
    app.state.multicast_service.start(loop)
    app.state.multicast_task = asyncio.create_task(multicast_dispatcher(app))
    print("Servicios de gateway iniciados")

    yield

    app.state.multicast_service.stop()
    app.state.multicast_task.cancel()

    try:
        await app.state.multicast_task
    except asyncio.CancelledError:
        pass

    app.state.db_service.close()

    print("Servicios de gateway detenidos")


BASE_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = BASE_DIR / "web"

app = FastAPI(title="IoT Gateway", lifespan=cast(Any, lifespan))
app.include_router(ws_router)
app.mount("/assets", StaticFiles(directory=WEB_DIR / "assets"), name="assets")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/history/{device_id}")
async def history(
    device_id: str,
    limit: int = Query(default=50, ge=0, le=10000),
) -> dict:
    records = await asyncio.to_thread(app.state.db_service.get_history, device_id, limit)
    return {
        "device_id": device_id,
        "count": len(records),
        "records": records,
    }

# uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
