import asyncio
import socket
import struct
import threading


class MulticastService:
    def __init__(self, group: str, port: int, interface_ip: str = "0.0.0.0") -> None:
        self.group = group
        self.port = port
        self.interface_ip = interface_ip
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._socket: socket.socket | None = None
        self._queue: asyncio.Queue[str] = asyncio.Queue()

    def start(self, loop: asyncio.AbstractEventLoop) -> None:
        if self._thread and self._thread.is_alive():
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._listen, args=(loop,), daemon=True)
        self._thread.start()

    def _listen(self, loop: asyncio.AbstractEventLoop) -> None:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("", self.port))
        sock.settimeout(1)

        group_bytes = socket.inet_aton(self.group)
        interface_bytes = socket.inet_aton(self.interface_ip)
        # Use standard-size packing to avoid native alignment issues on 64-bit Linux.
        mreq = struct.pack("=4s4s", group_bytes, interface_bytes)
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)

        self._socket = sock
        print(
            f"Escuchando multicast en {self.group}:{self.port} "
            f"(iface {self.interface_ip})"
        )

        while not self._stop_event.is_set():
            try:
                data, _ = sock.recvfrom(1024)
            except TimeoutError:
                continue
            except OSError:
                break

            msg = data.decode("utf-8")
            print("Multicast recibido:", msg)
            loop.call_soon_threadsafe(self._queue.put_nowait, msg)

    async def get_event(self) -> str:
        return await self._queue.get()

    def stop(self) -> None:
        self._stop_event.set()

        if self._socket:
            try:
                self._socket.close()
            except OSError:
                pass
            self._socket = None
