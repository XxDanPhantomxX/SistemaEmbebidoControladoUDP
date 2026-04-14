"""Servicios de comandos de control remoto."""


def process_message(message, led):
    command = message.strip().upper()

    if command == "LED_ON":
        led.value(1)
        return "ACK:LED_ON"

    if command == "LED_OFF":
        led.value(0)
        return "ACK:LED_OFF"

    if command == "STATUS":
        led_state = "ON" if led.value() else "OFF"
        return "STATUS:LED={}".format(led_state)

    return "ERROR:COMANDO_DESCONOCIDO"
