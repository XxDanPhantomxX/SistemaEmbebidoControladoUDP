import asyncio                                                                   # Run background tasks
from collections.abc import AsyncIterator                                        # For async context manager
from contextlib import asynccontextmanager                                       # For managing app lifespan
from pathlib import Path
from typing import Any, cast                                                     # For type hinting
from fastapi import FastAPI                                                      # Web framework
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.api.ws import router as ws_router                                       # WebSocket API routes
from app.core.config import settings                                             # Configuration settings
from app.models.messages import EventMessage, utc_iso_timestamp                  # Message models and timestamp function
from app.services.connection_manager import ConnectionManager                    # Manages WebSocket connections
from app.services.multicast_service import MulticastService                      # Listens for multicast events
from app.services.udp_service import UdpService                                  # Handles UDP communication with ESP32


async def multicast_dispatcher(app: FastAPI) -> None:
    service = app.state.multicast_service
    manager = app.state.connection_manager

    while True:
        message = await service.get_event()
        event = EventMessage(timestamp=utc_iso_timestamp(), message=message)
        await manager.broadcast(event.model_dump())


@asynccontextmanager                                                             # Decorator to manage startup and shutdown
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.connection_manager = ConnectionManager()
    app.state.udp_service = UdpService(
        esp32_ip=settings.esp32_ip,
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
