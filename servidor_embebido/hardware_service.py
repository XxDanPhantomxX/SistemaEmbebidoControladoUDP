"""Servicios de hardware para ESP32."""

import dht
import machine

import ssd1306
from config import DHT_PIN, DISPLAY_HEIGHT, DISPLAY_WIDTH, I2C_SCL_PIN, I2C_SDA_PIN, LED_PIN, OLED_ADDR, OLED_I2C_BUS


def init_led():
    led = machine.Pin(LED_PIN, machine.Pin.OUT)
    led.value(0)
    return led


def init_sensor():
    return dht.DHT22(machine.Pin(DHT_PIN))


def init_oled():
    i2c = machine.I2C(OLED_I2C_BUS, scl=machine.Pin(I2C_SCL_PIN), sda=machine.Pin(I2C_SDA_PIN))
    devices = i2c.scan()
    if OLED_ADDR not in devices:
        print("Error: Pantalla OLED no detectada en el bus I2C")
    else:
        print("Pantalla OLED detectada correctamente.")
    return ssd1306.SSD1306_I2C(DISPLAY_WIDTH, DISPLAY_HEIGHT, i2c)


def read_temperature_humidity(sensor):
    sensor.measure()
    return sensor.temperature(), sensor.humidity()
