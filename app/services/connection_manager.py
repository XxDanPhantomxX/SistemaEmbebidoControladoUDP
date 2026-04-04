import json

from fastapi import WebSocket

from app.models.messages import DeviceState, DevicesUpdateMessage, utc_iso_timestamp


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: list[WebSocket] = []
        self.devices_by_key: dict[str, DeviceState] = {}

    @staticmethod
    def build_device_key(device_id: str, ip: str) -> str:
        return f"{device_id}@{ip}"

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
        device_key = self.build_device_key(device_id, ip)
        previous = self.devices_by_key.get(device_key)
        device = DeviceState(
            device_key=device_key,
            device_id=device_id,
            ip=ip,
            last_seen=utc_iso_timestamp(),
            last_temp=temp,
            last_hum=hum,
        )
        self.devices_by_key[device_key] = device

        if previous is None:
            return device, True

        changed = (
            previous.last_temp != device.last_temp
            or previous.last_hum != device.last_hum
            or previous.last_seen != device.last_seen
        )
        return device, changed

    def get_device(self, target: str) -> DeviceState | None:
        if not target:
            return None

        if target in self.devices_by_key:
            return self.devices_by_key[target]

        matches = [
            device
            for device in self.devices_by_key.values()
            if device.device_id == target
        ]
        if len(matches) == 1:
            return matches[0]

        return None

    def is_ambiguous_device_id(self, device_id: str) -> bool:
        if not device_id:
            return False

        count = 0
        for device in self.devices_by_key.values():
            if device.device_id == device_id:
                count += 1
                if count > 1:
                    return True
        return False

    def get_device_ip(self, device_id: str) -> str | None:
        device = self.get_device(device_id)
        if not device:
            return None
        return device.ip

    def get_devices_update(self) -> DevicesUpdateMessage:
        devices = sorted(
            self.devices_by_key.values(),
            key=lambda item: (item.device_id, item.ip),
        )
        return DevicesUpdateMessage(timestamp=utc_iso_timestamp(), devices=devices)
