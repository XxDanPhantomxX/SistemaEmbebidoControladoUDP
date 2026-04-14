"""Servicios de red para UDP y multicast."""

import network
import socket
import ubinascii
import utime

from config import MULTICAST_GROUP, MULTICAST_PORT, PASSWORD, SSID, UDP_PORT


def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(SSID, PASSWORD)

    print("Conectando a WiFi...", end="")
    while not wlan.isconnected():
        print(".", end="")
        utime.sleep(0.3)

    print("\nWiFi conectado")
    print("IP del ESP32:", wlan.ifconfig()[0])
    return wlan


def create_udp_server():
    addr = socket.getaddrinfo("0.0.0.0", UDP_PORT)[0][-1]
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(addr)
    sock.settimeout(0.05)
    print("Servidor UDP escuchando en puerto", UDP_PORT)
    return sock


def create_multicast_socket():
    return socket.socket(socket.AF_INET, socket.SOCK_DGRAM)


def send_multicast(sock, message):
    try:
        sock.sendto(message.encode("utf-8"), (MULTICAST_GROUP, MULTICAST_PORT))
        print("Multicast enviado:", message)
    except OSError as exc:
        print("Error enviando multicast:", exc)


def get_device_id(wlan):
    mac_partial = ubinascii.hexlify(wlan.config("mac"))[-4:].decode("utf-8").upper()
    return "ESP32_{}".format(mac_partial)
