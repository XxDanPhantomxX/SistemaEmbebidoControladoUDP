import json

from fastapi import WebSocket

from app.models.messages import DeviceState, DevicesUpdateMessage, utc_iso_timestamp


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: list[WebSocket] = []
        self.devices: dict[str, DeviceState] = {}

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.connections:
            self.connections.remove(websocket)

    async def broadcast(self, msg: dict) -> None:
        payload = json.dumps(msg)
        dead_connections: list[WebSocket] = []

        for connection in self.connections:
            try:
                await connection.send_text(payload)
            except Exception:
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)

    def register_device(
        self,
        device_id: str,
        ip: str,
        temp: float | None,
        hum: float | None,
    ) -> tuple[DeviceState, bool]:
        previous = self.devices.get(device_id)
        device = DeviceState(
            device_id=device_id,
            ip=ip,
            last_seen=utc_iso_timestamp(),
            last_temp=temp,
            last_hum=hum,
        )
        self.devices[device_id] = device

        if previous is None:
            return device, True

        changed = previous.ip != ip
        return device, changed

    def get_device_ip(self, device_id: str) -> str | None:
        device = self.devices.get(device_id)
        if not device:
            return None
        return device.ip

    def get_devices_update(self) -> DevicesUpdateMessage:
        devices = sorted(self.devices.values(), key=lambda item: item.device_id)
        return DevicesUpdateMessage(timestamp=utc_iso_timestamp(), devices=devices)
