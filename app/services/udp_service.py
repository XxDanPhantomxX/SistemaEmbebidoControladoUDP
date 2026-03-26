import socket


class UdpService:
    def __init__(self, esp32_ip: str, esp32_port: int, timeout_seconds: float = 3) -> None:
        self.esp32_ip = esp32_ip
        self.esp32_port = esp32_port
        self.timeout_seconds = timeout_seconds

    def send_command(self, cmd: str) -> str:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(self.timeout_seconds)
        sock.sendto(cmd.encode("utf-8"), (self.esp32_ip, self.esp32_port))

        try:
            data, _ = sock.recvfrom(1024)
            response = data.decode("utf-8")
            print("Respuesta:", response)
            return response
        except socket.timeout:
            print("No hubo respuesta del ESP32")
            return "ERROR: Timeout"
        finally:
            sock.close()
