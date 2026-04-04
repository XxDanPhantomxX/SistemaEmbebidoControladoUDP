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
    await websocket.send_text(json.dumps(manager.get_devices_update().model_dump()))

    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                payload = json.loads(raw_data)
                cmd = CommandMessage(**payload)
            except Exception:
                response = ResponseMessage(
                    timestamp=utc_iso_timestamp(),
                    command="INVALID",
                    resp="ERROR: payload invalido",
                )
                await websocket.send_text(json.dumps(response.model_dump()))
                continue

            target = (cmd.target or "").strip()
            target_key = (cmd.target_key or "").strip()
            if not target and not target_key:
                response = ResponseMessage(
                    timestamp=utc_iso_timestamp(),
                    command=cmd.command,
                    resp="ERROR: target requerido",
                )
                await websocket.send_text(json.dumps(response.model_dump()))
                continue

            lookup_target = target_key or target
            device = manager.get_device(lookup_target)

            if device is None and target and manager.is_ambiguous_device_id(target):
                response = ResponseMessage(
                    timestamp=utc_iso_timestamp(),
                    target=target,
                    command=cmd.command,
                    resp="ERROR: target ambiguo, seleccione por IP",
                )
                await websocket.send_text(json.dumps(response.model_dump()))
                continue

            if device is None:
                response = ResponseMessage(
                    timestamp=utc_iso_timestamp(),
                    target=target or target_key,
                    command=cmd.command,
                    resp="ERROR: target no registrado",
                )
                await websocket.send_text(json.dumps(response.model_dump()))
                continue

            target_ip = device.ip

            # UDP I/O is blocking, so it runs in a thread to keep the event loop responsive.
            response_text = await asyncio.to_thread(udp_service.send_command, cmd.command, target_ip)

            response = ResponseMessage(
                timestamp=utc_iso_timestamp(),
                target=device.device_id,
                target_key=device.device_key,
                ip=target_ip,
                command=cmd.command,
                resp=response_text,
            )
            await manager.broadcast(response.model_dump())
    except Exception as exc:
        print("WebSocket error:", exc)
    finally:
        manager.disconnect(websocket)
