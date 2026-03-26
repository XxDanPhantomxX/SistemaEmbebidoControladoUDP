import asyncio
import json

from fastapi import APIRouter, WebSocket

from app.models.messages import CommandMessage, ResponseMessage, utc_iso_timestamp

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    manager = websocket.app.state.connection_manager
    udp_service = websocket.app.state.udp_service

    await manager.connect(websocket)

    try:
        while True:
            raw_data = await websocket.receive_text()
            payload = json.loads(raw_data)
            cmd = CommandMessage(**payload)

            # UDP I/O is blocking, so it runs in a thread to keep the event loop responsive.
            response_text = await asyncio.to_thread(udp_service.send_command, cmd.command)

            response = ResponseMessage(
                timestamp=utc_iso_timestamp(),
                command=cmd.command,
                resp=response_text,
            )
            await manager.broadcast(response.model_dump())
    except Exception as exc:
        print("WebSocket error:", exc)
    finally:
        manager.disconnect(websocket)
