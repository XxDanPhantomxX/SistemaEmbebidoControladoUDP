"""Punto de entrada principal del servidor embebido."""

import machine
import utime

from config import DISPLAY_UPDATE_MS, LOOP_SLEEP_SECONDS, WDT_TIMEOUT_MS
from command_service import process_message
from display_service import render_sensor_error, render_status, show_boot_splash
from hardware_service import init_led, init_oled, init_sensor, read_temperature_humidity
from network_service import (
    connect_wifi,
    create_multicast_socket,
    create_udp_server,
    get_device_id,
    send_multicast,
)


def run():
    led = init_led()
    sensor = init_sensor()
    oled = init_oled()
    show_boot_splash(oled)

    wlan = connect_wifi()
    udp_sock = create_udp_server()
    multicast_sock = create_multicast_socket()
    device_id = get_device_id(wlan)

    print("Iniciando Watchdog Timer")
    wdt = machine.WDT(timeout=WDT_TIMEOUT_MS)
    last_display_update = utime.ticks_ms()

    while True:
        wdt.feed()

        try:
            data, remote_addr = udp_sock.recvfrom(1024)
            message = data.decode("utf-8")
            print("Mensaje recibido desde", remote_addr, "->", message)

            response = process_message(message, led)
            udp_sock.sendto(response.encode("utf-8"), remote_addr)
            print("Respuesta enviada:", response)
        except OSError:
            pass

        if utime.ticks_diff(utime.ticks_ms(), last_display_update) >= DISPLAY_UPDATE_MS:
            try:
                temperature, humidity = read_temperature_humidity(sensor)
                render_status(oled, temperature, humidity, led)

                event = "EVENT:ID={};TEMP={};HUM={}".format(
                    device_id,
                    temperature,
                    humidity,
                )
                send_multicast(multicast_sock, event)
            except OSError:
                render_sensor_error(oled, led)

            last_display_update = utime.ticks_ms()

        if not wlan.isconnected():
            print("Conexion Wi-Fi perdida. Reiniciando sistema...")
            machine.reset()

        utime.sleep(LOOP_SLEEP_SECONDS)


run()
