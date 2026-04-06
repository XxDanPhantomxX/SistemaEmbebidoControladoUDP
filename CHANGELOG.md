# Changelog

Todos los cambios importantes de este proyecto se documentan en este archivo.

El formato esta basado en Keep a Changelog y versionado semantico.

## [1.1.0] - 2026-04-03

### Added
- Soporte de escalabilidad para granja de sensores ESP32 con identificador unico por dispositivo.
- Registro dinamico de dispositivos en gateway con relacion `ID -> IP` sin uso de IP fija.
- Soporte en parser para mensajes multicast con `ID=` y compatibilidad con `DEVICE=`.
- Actualizacion de firmware de referencia para emitir `EVENT:ID=...;TEMP=...;HUM=...`.
- Vista de telemetria y graficas filtrada por dispositivo seleccionado, con fallback global si no hay seleccion.

### Changed
- El gateway publica `devices_update` en cada evento multicast parseado para mantener sincronia del dashboard.
- El selector de dispositivos del dashboard se sincroniza de forma incremental (sin reconstruccion completa del `select`).
- El dashboard ignora snapshots de catalogo sin cambios (mismo conjunto de IDs/IPs) para evitar actualizaciones innecesarias.

### Fixed
- Correccion de reseteo intermitente del selector a "Seleccione dispositivo" durante rafagas de eventos.
- Correccion de parpadeo visual por recreacion del selector en cada `devices_update`.
- Correccion en extraccion de identificador desde mensajes `EVENT:...` en frontend.

## [1.0.0] - 2026-03-26

### Added
- Gateway IoT con FastAPI y ciclo de vida de servicios en `app/main.py`.
- Endpoint WebSocket en `/ws` para recepcion de comandos y difusion de mensajes.
- Servicio UDP unicast para comunicacion con ESP32.
- Servicio listener multicast para recepcion de eventos de sensores.
- Gestor de conexiones WebSocket para broadcast a clientes activos.
- Modelos de mensajes (`CommandMessage`, `ResponseMessage`, `EventMessage`) con timestamp UTC.
- Dashboard web en tiempo real con:
	- Estado de conexion WebSocket.
	- Control de LED (`LED_ON`/`LED_OFF`).
	- Consulta de estado (`STATUS`).
	- Visualizacion de temperatura y humedad desde mensajes multicast.
	- Historial de respuestas y eventos.
- Firmware de referencia para ESP32 en MicroPython con:
	- Servidor UDP puerto 5005.
	- Control de LED integrado.
	- Lectura DHT22.
	- Envio de telemetria multicast a `239.1.1.1:5006`.
	- Visualizacion en OLED SSD1306.

### Changed
- Se estandariza la pagina principal del gateway para servir el dashboard desde `/`.
- Se centraliza la configuracion del entorno en `app/core/config.py`.

### Fixed
- Manejo de conexiones WebSocket caidas durante el broadcast para evitar errores en cadena.
- Aislamiento de I/O UDP bloqueante en hilo para no bloquear el event loop de FastAPI.

### Notes
- Dependencias base actuales: `fastapi` y `pydantic`.
- Se recomienda ejecutar con `uvicorn app.main:app --reload` en desarrollo.

## [Unreleased]

### Added
- Persistencia de telemetria en SQLite con tabla `telemetry` y archivo local `iot_data.db`.
- Endpoint `GET /history/{device_id}` para consultar historico por dispositivo.
- Carga inicial del dashboard desde el historial persistido para reconstruir series y estado.

### Changed
- El gateway ahora registra en base de datos cada evento multicast valido al mismo tiempo que lo difunde por WebSocket.
- El dashboard envia `target_key` (`device_id@ip`) cuando esta disponible para evitar ambiguedad entre dispositivos con el mismo `device_id`.

### Fixed
- Manejo explicito de `target ambiguo, seleccione por IP` cuando un comando llega solo con `target` y existe mas de un dispositivo con ese identificador.

### Planned
- Pruebas unitarias para servicios UDP/multicast.
- Seguridad en el canal de comandos (autenticacion/autorizacion).
- Contenerizacion con Docker para despliegue reproducible.
