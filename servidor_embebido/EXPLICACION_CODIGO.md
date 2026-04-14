# Explicacion Completa Del Codigo

## 1) Vision general
Este proyecto corre en ESP32 con MicroPython y hace 4 cosas principales:
1. Levanta Wi-Fi y servidor UDP.
2. Recibe comandos remotos para controlar un LED.
3. Lee sensor DHT22 (temperatura y humedad).
4. Muestra estado en OLED SSD1306 y envia eventos por multicast.

Archivos:
- [main.py](main.py): orquestador principal.
- [config.py](config.py): constantes de configuracion.
- [command_service.py](command_service.py): comandos remotos.
- [hardware_service.py](hardware_service.py): inicializacion de hardware.
- [network_service.py](network_service.py): Wi-Fi, UDP y multicast.
- [display_service.py](display_service.py): render OLED.
- [display_assets.py](display_assets.py): bitmap de inicio.
- [ssd1306.py](ssd1306.py): driver OLED (I2C/SPI).

---

## 2) main.py
### Funcion principal
- `run()`: inicializa todos los servicios y mantiene el loop infinito del sistema.

### Linea por linea
- L1: docstring del archivo; indica que es punto de entrada.
- L2: linea en blanco.
- L3: importa `machine` para WDT y reset.
- L4: importa `utime` para tiempos y sleep.
- L5: linea en blanco.
- L6: importa constantes de tiempo desde configuracion.
- L7: importa parser de comandos UDP.
- L8: importa funciones de pantalla OLED.
- L9: importa funciones de hardware (LED, sensor, OLED, lectura DHT).
- L10-L15: importa funciones de red (Wi-Fi, sockets, multicast, ID).
- L16: cierre de parentesis del import multilinea.
- L17-L18: lineas en blanco.
- L19: define `run()`.
- L20: crea/enciende objeto LED (estado inicial OFF).
- L21: crea objeto sensor DHT22.
- L22: crea objeto OLED por I2C.
- L23: muestra splash inicial en pantalla.
- L24: linea en blanco.
- L25: conecta Wi-Fi y obtiene interfaz `wlan`.
- L26: crea socket UDP de escucha.
- L27: crea socket para envio multicast.
- L28: genera ID del dispositivo basado en MAC.
- L29: linea en blanco.
- L30: mensaje de log para WDT.
- L31: crea Watchdog con timeout configurado.
- L32: marca tiempo de la ultima actualizacion de pantalla.
- L33: linea en blanco.
- L34: inicia loop infinito principal.
- L35: alimenta WDT en cada ciclo para evitar reset.
- L36: linea en blanco.
- L37: bloque `try` para recibir paquete UDP sin romper loop.
- L38: lee datos y direccion remota del socket.
- L39: decodifica bytes a texto UTF-8.
- L40: log de mensaje recibido.
- L41: linea en blanco.
- L42: procesa comando (LED_ON, LED_OFF, STATUS, etc.).
- L43: envia respuesta al cliente remoto.
- L44: log de respuesta enviada.
- L45: `except OSError` por timeout/no datos.
- L46: `pass` para continuar loop sin bloquear.
- L47: linea en blanco.
- L48: evalua si ya toca actualizar sensor/pantalla.
- L49: `try` para lectura DHT y render.
- L50: obtiene temperatura/humedad.
- L51: dibuja estado en OLED.
- L52: linea en blanco.
- L53-L57: construye string de evento con ID, TEMP y HUM.
- L58: envia evento por multicast.
- L59: si falla lectura/render, entra a `except`.
- L60: muestra pantalla de error de sensor.
- L61: linea en blanco.
- L62: actualiza marca de tiempo de refresco.
- L63: linea en blanco.
- L64: verifica conexion Wi-Fi continuamente.
- L65: log de perdida de Wi-Fi.
- L66: reinicia microcontrolador para recuperacion.
- L67: linea en blanco.
- L68: pequena pausa para bajar uso de CPU.
- L69-L70: lineas en blanco.
- L71: ejecuta `run()` al cargar el archivo.

---

## 3) config.py
### Funcion del archivo
- Define parametros centralizados para no hardcodear en logica.

### Linea por linea
- L1: docstring de configuracion.
- L2: linea en blanco.
- L3: comentario bloque Wi-Fi.
- L4: SSID.
- L5: password Wi-Fi.
- L6: linea en blanco.
- L7: comentario bloque UDP.
- L8: puerto de escucha UDP.
- L9: linea en blanco.
- L10: comentario bloque multicast.
- L11: direccion de grupo multicast.
- L12: puerto multicast.
- L13: linea en blanco.
- L14: comentario bloque pines.
- L15: GPIO LED.
- L16: GPIO del DHT22.
- L17: GPIO SCL I2C.
- L18: GPIO SDA I2C.
- L19: linea en blanco.
- L20: comentario bloque display.
- L21: ancho OLED.
- L22: alto OLED.
- L23: bus I2C usado por OLED.
- L24: direccion I2C OLED.
- L25: segundos de splash al arranque.
- L26: linea en blanco.
- L27: comentario bloque tiempos de runtime.
- L28: timeout del watchdog en milisegundos.
- L29: periodo de refresco de pantalla/sensor.
- L30: sleep del loop principal.

---

## 4) command_service.py
### Funciones
- `process_message(message, led)`: interpreta comando recibido y devuelve respuesta de protocolo.

### Linea por linea
- L1: docstring del servicio de comandos.
- L2-L3: lineas en blanco.
- L4: define funcion principal de comando.
- L5: normaliza comando (quita espacios y pasa a mayusculas).
- L6: linea en blanco.
- L7: evalua comando `LED_ON`.
- L8: enciende LED.
- L9: responde ACK.
- L10: linea en blanco.
- L11: evalua comando `LED_OFF`.
- L12: apaga LED.
- L13: responde ACK.
- L14: linea en blanco.
- L15: evalua comando `STATUS`.
- L16: calcula estado actual ON/OFF.
- L17: responde estado.
- L18: linea en blanco.
- L19: respuesta por defecto para comando desconocido.

---

## 5) hardware_service.py
### Funciones
- `init_led()`: configura pin LED como salida en OFF.
- `init_sensor()`: crea instancia de DHT22.
- `init_oled()`: prepara I2C, detecta OLED y crea driver SSD1306.
- `read_temperature_humidity(sensor)`: hace `measure()` y retorna `(temp, hum)`.

### Linea por linea
- L1: docstring del servicio de hardware.
- L2: linea en blanco.
- L3: importa modulo DHT.
- L4: importa API de `machine`.
- L5: linea en blanco.
- L6: importa driver local `ssd1306`.
- L7: importa constantes de pines y display.
- L8-L9: continuation/cierre del import largo.
- L10: define `init_led()`.
- L11: crea pin como salida.
- L12: estado inicial apagado.
- L13: retorna objeto LED.
- L14-L15: lineas en blanco.
- L16: define `init_sensor()`.
- L17: retorna sensor DHT22 sobre pin configurado.
- L18-L19: lineas en blanco.
- L20: define `init_oled()`.
- L21: crea bus I2C con bus y pines de config.
- L22: escanea dispositivos I2C.
- L23: si no esta la direccion OLED configurada...
- L24: imprime error de no deteccion.
- L25: caso contrario...
- L26: imprime deteccion correcta.
- L27: crea y retorna objeto `SSD1306_I2C`.
- L28-L29: lineas en blanco.
- L30: define lectura DHT.
- L31: ordena medicion al sensor.
- L32: retorna temperatura y humedad.

---

## 6) network_service.py
### Funciones
- `connect_wifi()`: conecta ESP32 a red Wi-Fi.
- `create_udp_server()`: abre socket UDP y bind local.
- `create_multicast_socket()`: crea socket para envio multicast.
- `send_multicast(sock, message)`: envia string a grupo multicast.
- `get_device_id(wlan)`: genera ID corto desde MAC.

### Linea por linea
- L1: docstring del servicio de red.
- L2: linea en blanco.
- L3: importa stack Wi-Fi de MicroPython.
- L4: importa sockets.
- L5: importa utilidades binarias/hex.
- L6: importa tiempo para espera en reconexion.
- L7: linea en blanco.
- L8: importa parametros de red desde config.
- L9: linea en blanco.
- L10: linea en blanco (separador).
- L11: define `connect_wifi()`.
- L12: crea interfaz STA (cliente).
- L13: activa interfaz.
- L14: inicia conexion con SSID/password.
- L15: linea en blanco.
- L16: log inicial en la misma linea (`end=""`).
- L17: bucle hasta estar conectado.
- L18: imprime punto de progreso.
- L19: duerme 0.3 s para no saturar CPU.
- L20: linea en blanco.
- L21: imprime confirmacion de conexion.
- L22: imprime IP adquirida.
- L23: retorna objeto WLAN.
- L24: linea en blanco.
- L25: linea en blanco.
- L26: define `create_udp_server()`.
- L27: resuelve direccion local + puerto UDP.
- L28: crea socket UDP.
- L29: hace bind al puerto local.
- L30: fija timeout corto de recepcion.
- L31: log de escucha.
- L32: retorna socket.
- L33: linea en blanco.
- L34: linea en blanco.
- L35: define `create_multicast_socket()`.
- L36: retorna socket UDP simple.
- L37: linea en blanco.
- L38: linea en blanco.
- L39: define `send_multicast()`.
- L40: abre `try` de envio.
- L41: codifica UTF-8 y envia a grupo/puerto multicast.
- L42: log de envio.
- L43: captura error de socket.
- L44: log de error.
- L45: linea en blanco.
- L46: linea en blanco.
- L47: define `get_device_id()`.
- L48: toma MAC, la pasa a hexadecimal y usa ultimos 4 chars.
- L49: retorna formato `ESP32_XXXX`.

---

## 7) display_service.py
### Funciones
- `_build_boot_framebuffer()`: adapta bitmap al tamano esperado de la OLED.
- `show_boot_splash(oled)`: dibuja splash al arranque.
- `render_status(oled, temp, hum, led)`: pinta valores y estado LED.
- `render_sensor_error(oled, led)`: pinta pantalla de error.

### Linea por linea
- L1: docstring del servicio de render.
- L2: linea en blanco.
- L3: importa `framebuf` para manejar buffer de imagen.
- L4: importa `utime` para delay del splash.
- L5: linea en blanco.
- L6: importa constantes de tiempo y resolucion.
- L7: importa bitmap desde assets.
- L8: linea en blanco.
- L9: linea en blanco.
- L10: define helper privado para framebuffer de splash.
- L11: copia bitmap para evitar mutar el original.
- L12: calcula bytes esperados: `(ancho * alto) / 8`.
- L13: si faltan bytes...
- L14: rellena con ceros hasta tamano correcto.
- L15: si sobran bytes...
- L16: recorta al tamano exacto.
- L17: crea y retorna `FrameBuffer` monocromo HLSB.
- L18: linea en blanco.
- L19: linea en blanco.
- L20: define `show_boot_splash()`.
- L21: construye framebuffer del splash.
- L22: limpia pantalla.
- L23: blit del framebuffer en posicion (0,0).
- L24: envia buffer a pantalla.
- L25: espera `BOOT_SPLASH_SECONDS`.
- L26: linea en blanco.
- L27: linea en blanco.
- L28: define `render_status()`.
- L29: limpia OLED.
- L30: escribe temperatura en linea superior.
- L31: escribe humedad.
- L32: linea en blanco.
- L33: regla de clasificacion: frio.
- L34: texto de frio.
- L35: regla de rango normal.
- L36: texto normal.
- L37: caso contrario (calor).
- L38: texto calor.
- L39: linea en blanco.
- L40: obtiene estado LED.
- L41: dibuja estado LED.
- L42: refresca pantalla.
- L43: linea en blanco.
- L44: linea en blanco.
- L45: define render de error.
- L46: limpia pantalla.
- L47: texto de error.
- L48: mantiene visible estado LED aun en error.
- L49: refresca OLED.

---

## 8) display_assets.py
### Funcion del archivo
- Contiene `EMOJI_BITMAP`, una imagen monocromo usada en la pantalla de arranque.

### Linea por linea
- L1: docstring del modulo de assets.
- L2: linea en blanco.
- L3: inicio de `EMOJI_BITMAP = bytearray([...`.
- L4-L65: secuencia de bytes de imagen monocromo 1-bit (patron de pixels).
- L66: cierre del `bytearray`.

Notas:
- Esta estructura es puramente datos; no hay logica ejecutable.
- El ajuste de tamano real se hace en `_build_boot_framebuffer()` de [display_service.py](display_service.py).

---

## 9) ssd1306.py (driver)
### Clases y metodos
- `SSD1306(framebuf.FrameBuffer)`: clase base de control display.
- `SSD1306_I2C(SSD1306)`: implementacion por I2C.
- `SSD1306_SPI(SSD1306)`: implementacion por SPI.

Metodos relevantes:
- `__init__`, `init_display`, `show`, `poweron`, `poweroff`, `contrast`, `invert`, `rotate`, `write_cmd`, `write_data`.

### Linea por linea
- L1: comentario general del driver.
- L2: importa `const` para constantes de bajo nivel.
- L3: importa `framebuf`.
- L4: linea en blanco.
- L5: comentario de definicion de registros.
- L6-L24: define constantes de comandos SSD1306 (hex).
- L25: linea en blanco.
- L26-L27: comentario de herencia de `FrameBuffer`.
- L28: define clase base `SSD1306`.
- L29: constructor base.
- L30: guarda ancho.
- L31: guarda alto.
- L32: guarda si VCC es externa.
- L33: calcula numero de paginas (`height//8`).
- L34: crea buffer de video.
- L35: inicializa `FrameBuffer` base con modo `MONO_VLSB`.
- L36: inicia secuencia de inicializacion de display.
- L37: linea en blanco.
- L38: define metodo abstracto `write_cmd`.
- L39: lanza `NotImplementedError`.
- L40: linea en blanco.
- L41: define metodo abstracto `write_data`.
- L42: lanza `NotImplementedError`.
- L43: linea en blanco.
- L44: define `init_display()`.
- L45: inicia loop de comandos de arranque.
- L46-L80: lista ordenada de comandos de configuracion (memoria, layout, timings, contraste, charge pump, encendido).
- L81-L82: envia cada comando con `write_cmd`.
- L83: limpia framebuffer interno.
- L84: muestra buffer limpio en pantalla.
- L85: linea en blanco.
- L86: define `poweroff()`.
- L87: envia comando display off.
- L88: linea en blanco.
- L89: define `poweron()`.
- L90: envia comando display on.
- L91: linea en blanco.
- L92: define `contrast(contrast)`.
- L93: envia comando de contraste.
- L94: envia valor de contraste.
- L95: linea en blanco.
- L96: define `invert(invert)`.
- L97: configura inversion normal/invertida.
- L98: linea en blanco.
- L99: define `rotate(rotate)`.
- L100: cambia direccion COM.
- L101: cambia remapeo de segmentos.
- L102: linea en blanco.
- L103: define `show()`.
- L104: columna inicial logica.
- L105: columna final logica.
- L106: si ancho no es 128, corrige offset de centrado.
- L107: comentario explicativo.
- L108: calcula offset.
- L109: ajusta x0.
- L110: ajusta x1.
- L111: inicia comando de direccion de columna.
- L112: envia x0.
- L113: envia x1.
- L114: inicia comando de paginas.
- L115: pagina inicial 0.
- L116: pagina final (`pages - 1`).
- L117: envia buffer completo al controlador.
- L118: linea en blanco.
- L119: linea en blanco.
- L120: define clase `SSD1306_I2C`.
- L121: constructor I2C.
- L122: guarda objeto I2C.
- L123: guarda direccion I2C.
- L124: buffer temporal de 2 bytes para comandos.
- L125: lista para writevto con prefijo de datos.
- L126: llama constructor base.
- L127: linea en blanco.
- L128: define escritura de comando por I2C.
- L129: setea byte de control para comando.
- L130: setea byte de comando.
- L131: escribe ambos bytes por I2C.
- L132: linea en blanco.
- L133: define escritura de datos por I2C.
- L134: coloca buffer de pantalla en write list.
- L135: envia datos con `writevto`.
- L136: linea en blanco.
- L137: linea en blanco.
- L138: define clase `SSD1306_SPI`.
- L139: constructor SPI.
- L140: define baudrate SPI.
- L141: inicializa pin `dc`.
- L142: inicializa pin `res`.
- L143: inicializa pin `cs`.
- L144: guarda objeto SPI.
- L145: guarda `dc`.
- L146: guarda `res`.
- L147: guarda `cs`.
- L148: importa `time` localmente.
- L149: reset pin alto.
- L150: espera 1 ms.
- L151: reset pin bajo.
- L152: espera 10 ms.
- L153: reset pin alto para finalizar reset.
- L154: llama constructor base.
- L155: linea en blanco.
- L156: define `write_cmd` por SPI.
- L157: configura bus SPI.
- L158: desactiva CS.
- L159: modo comando (`dc=0`).
- L160: activa CS.
- L161: escribe byte de comando.
- L162: desactiva CS.
- L163: linea en blanco.
- L164: define `write_data` por SPI.
- L165: configura bus SPI.
- L166: desactiva CS.
- L167: modo datos (`dc=1`).
- L168: activa CS.
- L169: escribe buffer de datos.
- L170: desactiva CS.

---

## 10) Flujo completo de ejecucion
1. [main.py](main.py) inicia `run()`.
2. Inicializa LED, DHT22 y OLED.
3. Muestra splash con bitmap.
4. Conecta Wi-Fi.
5. Abre sockets UDP y multicast.
6. Activa watchdog.
7. En loop:
   - atiende comandos UDP,
   - cada intervalo lee sensor y actualiza OLED,
   - envia evento multicast,
   - reinicia si pierde Wi-Fi.

---

## 11) Conceptos para estudiar desde 0
Busca estos temas en este orden:
1. MicroPython basico (REPL, modulos, filesystem, boot.py/main.py).
2. GPIO en ESP32 con `machine.Pin`.
3. Sensor DHT22 en MicroPython (`dht.DHT22`).
4. I2C en ESP32 (`machine.I2C`) y escaneo de dispositivos.
5. Pantallas OLED SSD1306 y uso de `framebuf`.
6. Sockets UDP en MicroPython (`socket.socket`, `bind`, `recvfrom`, `sendto`).
7. Multicast UDP (grupos 239.x.x.x, puertos, formato de mensajes).
8. Watchdog Timer (`machine.WDT`) y estrategias anti-bloqueo.
9. Arquitectura por capas/modulos en sistemas embebidos.
10. Manejo de errores en runtime (`try/except OSError`).
11. Reconexion y resiliencia de red en IoT.
12. Protocolos de comando/ACK para control remoto.
13. Optimizacion de bucles embebidos (timers, `ticks_ms`, `ticks_diff`).
14. Drivers por abstraccion (clase base + implementaciones I2C/SPI).

---

## 12) Mini guia para replicarlo desde cero
1. Crea [config.py](config.py) con pines, red y tiempos.
2. Implementa [hardware_service.py](hardware_service.py) (LED, DHT, OLED).
3. Implementa [network_service.py](network_service.py) (Wi-Fi + UDP + multicast).
4. Implementa [command_service.py](command_service.py) con protocolo simple.
5. Implementa [display_service.py](display_service.py) para splash y estado.
6. Agrega [display_assets.py](display_assets.py) con bitmap.
7. Usa [ssd1306.py](ssd1306.py) como driver.
8. Orquesta todo en [main.py](main.py) con loop, watchdog y recuperacion.
