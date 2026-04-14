"""Servicios de renderizado para OLED."""

import framebuf
import utime

from config import BOOT_SPLASH_SECONDS, DISPLAY_HEIGHT, DISPLAY_WIDTH
from display_assets import EMOJI_BITMAP


def _build_boot_framebuffer():
    bitmap = bytearray(EMOJI_BITMAP)
    expected_len = (DISPLAY_WIDTH * DISPLAY_HEIGHT) // 8
    if len(bitmap) < expected_len:
        bitmap += bytearray(expected_len - len(bitmap))
    elif len(bitmap) > expected_len:
        bitmap = bitmap[:expected_len]
    return framebuf.FrameBuffer(bitmap, DISPLAY_WIDTH, DISPLAY_HEIGHT, framebuf.MONO_HLSB)


def show_boot_splash(oled):
    fb = _build_boot_framebuffer()
    oled.fill(0)
    oled.blit(fb, 0, 0)
    oled.show()
    utime.sleep(BOOT_SPLASH_SECONDS)


def render_status(oled, temp, hum, led):
    oled.fill(0)
    oled.text("Temp: {:.1f}C".format(temp), 0, 0)
    oled.text("Hum: {:.1f}%".format(hum), 0, 10)

    if temp < 15:
        oled.text("FRIO [*]", 30, 30)
    elif temp <= 30:
        oled.text("NORMAL :)", 30, 30)
    else:
        oled.text("CALOR [!]", 30, 30)

    led_state = "ON" if led.value() else "OFF"
    oled.text("LED: {}".format(led_state), 0, 50)
    oled.show()


def render_sensor_error(oled, led):
    oled.fill(0)
    oled.text("Error Sensor!", 20, 20)
    oled.text("LED: {}".format("ON" if led.value() else "OFF"), 20, 40)
    oled.show()
