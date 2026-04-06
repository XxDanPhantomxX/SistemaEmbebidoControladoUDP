# Sistema Embebido Controlado

Gateway IoT para controlar multiples ESP32 por UDP unicast y visualizar eventos multicast en tiempo real mediante un dashboard web.

## Objetivo

Este proyecto conecta tres capas:

- ESP32 (MicroPython): recibe comandos UDP (`LED_ON`, `LED_OFF`, `STATUS`) y envia telemetria por multicast con identificador unico (`ID=ESP32_xxxx`).
- Gateway (FastAPI): puente entre WebSocket del navegador y UDP de multiples ESP32 registrados dinamicamente.
- Frontend web: panel de control en tiempo real con estado de conexion, respuestas y metricas por dispositivo o globales.

## Arquitectura

```text
Navegador (WebSocket /ws)
				|
				v
Gateway FastAPI
	- /ws (comandos y difusion)
	- listener multicast (239.1.1.1:5006)
				|
				v
ESP32 (UDP unicast puerto 5005)
	- recibe comandos
	- responde ACK/STATUS
	- emite EVENT:ID=...;TEMP=...;HUM=... por multicast
```

## Estructura principal

```text
SistemaEmbebidoControlado/
	app/
		api/ws.py                    # Endpoint WebSocket
		services/udp_service.py      # Cliente UDP hacia ESP32
		services/multicast_service.py# Listener multicast
		services/connection_manager.py
		models/messages.py           # Esquemas de mensajes
		core/config.py               # Variables de entorno
		main.py                      # App FastAPI y lifecycle
	web/
		index.html                   # Dashboard
		assets/css/dashboard.css
		assets/js/dashboard.js
	servidor_embebido/
		server_esp32.py              # Firmware MicroPython de referencia
	requirements.txt
	gateway.py                     # Punto de entrada alterno (importa app)
```

## Requisitos

- Python 3.10+
- ESP32 con MicroPython
- Sensor DHT22 (segun firmware de referencia)
- Pantalla OLED SSD1306 I2C (opcional para visualizacion local en ESP32)
- Red local donde PC y ESP32 puedan comunicarse

## Instalacion

1. Crear y activar entorno virtual:

```bash
python -m venv .venv
source .venv/bin/activate
```

2. Instalar dependencias backend:

```bash
pip install -r requirements.txt
pip install "uvicorn[standard]"
```

## Configuracion

Variables de entorno disponibles (con sus valores por defecto):

- `ESP32_PORT=5005`
- `MULTICAST_GROUP=239.1.1.1`
- `MULTICAST_PORT=5006`
- `UNICAST_TIMEOUT_SECONDS=3`
- `IOT_DB_PATH=iot_data.db`

Ejemplo:

```bash
export ESP32_PORT=5005
export MULTICAST_GROUP=239.1.1.1
export MULTICAST_PORT=5006
export UNICAST_TIMEOUT_SECONDS=3
export IOT_DB_PATH=iot_data.db
```

## Ejecucion

Desde la carpeta del proyecto:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Abrir en navegador:

- http://localhost:8000

Health check:

- `GET /health` -> `{"status":"ok"}`

Historial por dispositivo:

- `GET /history/{device_id}` -> ultimos 50 registros por defecto
- `GET /history/{device_id}?limit=0` -> historial completo del dispositivo

Nota:

- Si hay mas de un dispositivo con el mismo `device_id`, el dashboard usa `target_key` (`device_id@ip`) para evitar ambiguedades.
- Si un cliente envia solo `target` y hay colision por `device_id`, el backend responde con `target ambiguo, seleccione por IP`.

## Contrato de mensajes

### Comando desde frontend al gateway (WebSocket)

```json
{ "target": "ESP32_ABCD", "command": "LED_ON" }
```

Cuando el dashboard conoce la IP del dispositivo, tambien puede enviar:

```json
{ "target": "ESP32_ABCD", "target_key": "ESP32_ABCD@192.168.1.77", "command": "STATUS" }
```

Comandos esperados por el firmware de referencia:

- `LED_ON`
- `LED_OFF`
- `STATUS`

### Respuesta difundida por gateway (tipo `response`)

```json
{
	"type": "response",
	"timestamp": "2026-03-26T12:34:56.000000+00:00",
	"target": "ESP32_ABCD",
	"ip": "192.168.1.77",
	"command": "STATUS",
	"resp": "STATUS:LED=ON"
}
```

### Evento multicast difundido por gateway (tipo `event`)

```json
{
	"type": "event",
	"timestamp": "2026-03-26T12:34:58.000000+00:00",
	"device_id": "ESP32_ABCD",
	"ip": "192.168.1.77",
	"temp": 25.4,
	"hum": 60.1,
	"message": "EVENT:ID=ESP32_ABCD;TEMP=25.4;HUM=60.1"
}
```

### Catalogo de dispositivos difundido por gateway (tipo `devices_update`)

```json
{
	"type": "devices_update",
	"timestamp": "2026-03-26T12:34:58.000000+00:00",
	"devices": [
		{
			"device_id": "ESP32_ABCD",
			"ip": "192.168.1.77",
			"last_seen": "2026-03-26T12:34:58.000000+00:00",
			"last_temp": 25.4,
			"last_hum": 60.1
		}
	]
}
```

## Persistencia de datos (SQLite)

- El gateway crea automaticamente `iot_data.db` al iniciar.
- Cada evento multicast valido (`EVENT:ID=...;TEMP=...;HUM=...`) se inserta en la tabla `telemetry`.
- Campos almacenados por fila:
	- `timestamp`
	- `device_id`
	- `temperature`
	- `humidity`

El dashboard puede reconstruir la serie historica de cada dispositivo desde esta tabla al conectarse.

Ejemplo de consulta de historial:

```bash
curl http://localhost:8000/history/ESP32_0300
```

## Flujo de funcionamiento

1. El dashboard abre `ws://<host>/ws`.
2. El gateway registra automaticamente dispositivos cuando recibe multicast `EVENT:ID=...;TEMP=...;HUM=...` (tambien acepta `DEVICE` por compatibilidad) y mantiene un mapa `ID -> IP`.
3. Usuario selecciona un `target` y envia un comando (`LED_ON`, `LED_OFF`, `STATUS`).
4. Gateway reenvia el comando por UDP al ESP32 destino (`target_ip:ESP32_PORT`).
5. ESP32 responde por UDP; gateway retransmite a todos los clientes WebSocket.
6. En paralelo, gateway escucha multicast y publica eventos a todos los clientes.

## Escalabilidad (granja de sensores)

- Mensaje de sensor recomendado en ESP32: `EVENT:ID=ESP32_01;TEMP=25.4;HUM=60.1`.
- Gateway sin `ESP32_IP` fija: usa catalogo dinamico `ID -> IP` segun mensajes multicast recibidos.
- App web con `target` explicito en JSON:

```json
{ "target": "ESP32_01", "command": "STATUS" }
```

- Selector de dispositivos estable: no se reinicia en cada actualizacion de sensores.
- Telemetria y graficas:
	- Si hay dispositivo seleccionado, muestran solo ese `ID`.
	- Si no hay seleccion, muestran vista global.

## Firmware ESP32 (referencia)

El archivo `servidor_embebido/server_esp32.py` incluye:

- Conexion Wi-Fi
- Servidor UDP en puerto `5005`
- Procesamiento de comandos para LED
- Lectura periodica de DHT22
- Envio de telemetria multicast a `239.1.1.1:5006`

Si cambias SSID, password, pines o puertos en ESP32, actualiza tambien las variables del gateway.

## Verificacion rapida

1. Inicia uno o mas ESP32 y confirma su IP en serial.
2. Espera a que los dispositivos aparezcan en el selector del dashboard.
3. Ejecuta FastAPI con `uvicorn`.
4. Abre el dashboard y prueba:
	- Interruptor LED (ON/OFF) por `target` seleccionado.
	- Boton `STATUS` por `target` seleccionado.
	- Recepcion de temperatura/humedad por dispositivo seleccionado y en vista global.

## Problemas comunes

- No llega respuesta unicast:
	- Verifica que el dispositivo este registrado en el selector y que la IP mostrada sea correcta.
	- Verifica `ESP32_PORT` y conectividad entre equipos.
	- Revisa firewall local.
- No llegan eventos multicast:
	- Verifica que la red permita multicast.
	- Confirma que `MULTICAST_GROUP` y `MULTICAST_PORT` coincidan entre gateway y ESP32.
- WebSocket desconectado:
	- Revisa que el backend este corriendo en el puerto esperado.

## Mejoras sugeridas

- Agregar autenticacion para comandos remotos.
- Persistir historial de eventos/respuestas en base de datos.
- Añadir pruebas automatizadas para servicios UDP/multicast.
- Dockerizar backend y dashboard para despliegue reproducible.
