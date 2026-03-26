# Sistema Embebido Controlado

Gateway IoT para controlar un ESP32 por UDP unicast y visualizar eventos multicast en tiempo real mediante un dashboard web.

## Objetivo

Este proyecto conecta tres capas:

- ESP32 (MicroPython): recibe comandos UDP (`LED_ON`, `LED_OFF`, `STATUS`) y envía telemetria por multicast.
- Gateway (FastAPI): puente entre WebSocket del navegador y UDP del ESP32.
- Frontend web: panel de control en tiempo real con estado de conexion, respuestas y metricas.

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
	- emite EVENT:TEMP=...;HUM=... por multicast
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

- `ESP32_IP=172.17.161.98`
- `ESP32_PORT=5005`
- `MULTICAST_GROUP=239.1.1.1`
- `MULTICAST_PORT=5006`
- `UNICAST_TIMEOUT_SECONDS=3`

Ejemplo:

```bash
export ESP32_IP=192.168.1.50
export ESP32_PORT=5005
export MULTICAST_GROUP=239.1.1.1
export MULTICAST_PORT=5006
export UNICAST_TIMEOUT_SECONDS=3
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

## Contrato de mensajes

### Comando desde frontend al gateway (WebSocket)

```json
{ "command": "LED_ON" }
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
	"command": "STATUS",
	"resp": "STATUS:LED=ON"
}
```

### Evento multicast difundido por gateway (tipo `event`)

```json
{
	"type": "event",
	"timestamp": "2026-03-26T12:34:58.000000+00:00",
	"message": "EVENT:TEMP=25.4;HUM=60.1"
}
```

## Flujo de funcionamiento

1. El dashboard abre `ws://<host>/ws`.
2. Usuario envia un comando (`LED_ON`, `LED_OFF`, `STATUS`).
3. Gateway reenvia el comando por UDP al ESP32 (`ESP32_IP:ESP32_PORT`).
4. ESP32 responde por UDP; gateway retransmite a todos los clientes WebSocket.
5. En paralelo, gateway escucha multicast y publica eventos a todos los clientes.

## Firmware ESP32 (referencia)

El archivo `servidor_embebido/server_esp32.py` incluye:

- Conexion Wi-Fi
- Servidor UDP en puerto `5005`
- Procesamiento de comandos para LED
- Lectura periodica de DHT22
- Envio de telemetria multicast a `239.1.1.1:5006`

Si cambias SSID, password, pines o puertos en ESP32, actualiza tambien las variables del gateway.

## Verificacion rapida

1. Inicia el ESP32 y confirma su IP en serial.
2. Exporta `ESP32_IP` con la IP real del dispositivo.
3. Ejecuta FastAPI con `uvicorn`.
4. Abre el dashboard y prueba:
	 - Interruptor LED (ON/OFF)
	 - Boton `STATUS`
	 - Recepcion de temperatura/humedad en tarjeta multicast

## Problemas comunes

- No llega respuesta unicast:
	- Verifica `ESP32_IP`, `ESP32_PORT` y conectividad entre equipos.
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
