const ui = {
    connectionBadge: document.getElementById("connectionBadge"),
    connectionText: document.getElementById("connectionText"),
    totalResponses: document.getElementById("totalResponses"),
    totalEvents: document.getElementById("totalEvents"),
    lastCommand: document.getElementById("lastCommand"),
    unicastCommand: document.getElementById("unicastCommand"),
    unicastResponse: document.getElementById("unicastResponse"),
    unicastStatus: document.getElementById("unicastStatus"),
    unicastLastUpdate: document.getElementById("unicastLastUpdate"),
    tempValue: document.getElementById("tempValue"),
    humidityValue: document.getElementById("humidityValue"),
    deviceValue: document.getElementById("deviceValue"),
    multicastStatus: document.getElementById("multicastStatus"),
    multicastLastUpdate: document.getElementById("multicastLastUpdate"),
    responsesTableBody: document.getElementById("responsesTableBody"),
    eventsTableBody: document.getElementById("eventsTableBody"),
    ledSwitch: document.getElementById("ledSwitch"),
    ledStateText: document.getElementById("ledStateText"),
    ledIndicator: document.getElementById("ledIndicator"),
    ledIndicatorIcon: document.getElementById("ledIndicatorIcon"),
    ledIndicatorText: document.getElementById("ledIndicatorText"),
    btnStatus: document.getElementById("btnStatus"),
};

const state = {
    totalResponses: 0,
    totalEvents: 0,
    lastCommand: "-",
    maxRows: 50,
};

const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
const wsUrl = `${wsProtocol}://${window.location.host}/ws`;
const ws = new WebSocket(wsUrl);

function setConnection(variant, text) {
    ui.connectionBadge.className = "badge rounded-pill px-3 py-2 " + variant;
    ui.connectionText.textContent = text;
}

function nowLabel(isoTimestamp) {
    if (!isoTimestamp) {
        return new Date().toLocaleTimeString();
    }

    const date = new Date(isoTimestamp);
    if (Number.isNaN(date.getTime())) {
        return new Date().toLocaleTimeString();
    }

    return date.toLocaleTimeString();
}

function prependRow(tableBody, cells) {
    const tr = document.createElement("tr");
    cells.forEach((content) => {
        const td = document.createElement("td");
        td.textContent = String(content ?? "-");
        tr.appendChild(td);
    });

    tableBody.prepend(tr);
    while (tableBody.rows.length > state.maxRows) {
        tableBody.deleteRow(tableBody.rows.length - 1);
    }
}

function updateCounters() {
    ui.totalResponses.textContent = String(state.totalResponses);
    ui.totalEvents.textContent = String(state.totalEvents);
    ui.lastCommand.textContent = state.lastCommand;
}

function parseMetricValue(value) {
    if (!value) {
        return null;
    }

    const parsed = Number.parseFloat(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
}

function extractSensorReadings(respText) {
    const source = String(respText || "");
    const deviceMatch = source.match(/(?:^|[;\s])DEVICE\s*=\s*([^;\s]+)/i);

    const tempMatch = source.match(/(?:temp(?:eratura)?)\D*(-?\d+(?:[.,]\d+)?)/i);
    const humidityMatch = source.match(/(?:hum(?:edad|idity)?)\D*(-?\d+(?:[.,]\d+)?)/i);

    let temperature = parseMetricValue(tempMatch ? tempMatch[1] : null);
    let humidity = parseMetricValue(humidityMatch ? humidityMatch[1] : null);

    if (temperature === null || humidity === null) {
        const numericTokens = source.match(/-?\d+(?:[.,]\d+)?/g) || [];
        if (temperature === null && numericTokens.length >= 1) {
            temperature = parseMetricValue(numericTokens[0]);
        }
        if (humidity === null && numericTokens.length >= 2) {
            humidity = parseMetricValue(numericTokens[1]);
        }
    }

    return {
        deviceId: deviceMatch ? String(deviceMatch[1]).trim() : null,
        temperature,
        humidity,
    };
}

function formatOneDecimal(value) {
    return value === null ? "--" : value.toFixed(1);
}

function setLedVisualState(isOn) {
    if (isOn) {
        ui.ledStateText.className = "badge badge-soft";
        ui.ledStateText.textContent = "LED ON";

        ui.ledIndicator.classList.remove("led-indicator-off");
        ui.ledIndicator.classList.add("led-indicator-on");
        ui.ledIndicatorIcon.className = "bi bi-lightbulb-fill";
        ui.ledIndicatorText.textContent = "Foco encendido";
        return;
    }

    ui.ledStateText.className = "badge badge-warning-soft";
    ui.ledStateText.textContent = "LED OFF";

    ui.ledIndicator.classList.remove("led-indicator-on");
    ui.ledIndicator.classList.add("led-indicator-off");
    ui.ledIndicatorIcon.className = "bi bi-lightbulb-off-fill";
    ui.ledIndicatorText.textContent = "Foco apagado";
}

function updateUnicastCard(row) {
    ui.unicastCommand.textContent = row.command;
    ui.unicastResponse.textContent = row.resp;
    ui.unicastLastUpdate.textContent = nowLabel(row.timestamp);
    ui.unicastStatus.className = "badge badge-soft";
    ui.unicastStatus.textContent = "Respuesta unicast recibida";

    if (row.command === "LED_ON") {
        ui.ledSwitch.checked = true;
        setLedVisualState(true);
    } else if (row.command === "LED_OFF") {
        ui.ledSwitch.checked = false;
        setLedVisualState(false);
    }
}

function updateMulticastCard(row) {
    const readings = extractSensorReadings(row.message);
    ui.deviceValue.textContent = readings.deviceId || "--";
    ui.tempValue.textContent = formatOneDecimal(readings.temperature);
    ui.humidityValue.textContent = formatOneDecimal(readings.humidity);
    ui.multicastLastUpdate.textContent = nowLabel(row.timestamp);

    if (readings.temperature !== null || readings.humidity !== null) {
        ui.multicastStatus.className = "badge badge-soft";
        ui.multicastStatus.textContent = "Lectura multicast actualizada";
        return;
    }

    ui.multicastStatus.className = "badge badge-warning-soft";
    ui.multicastStatus.textContent = "Multicast sin metricas parseables";
}

function appendResponseLog(payload) {
    const row = {
        timestamp: payload.timestamp || new Date().toISOString(),
        command: payload.command || "(desconocido)",
        resp: payload.resp || "Sin contenido",
    };

    updateUnicastCard(row);

    prependRow(ui.responsesTableBody, [
        nowLabel(row.timestamp),
        row.command,
        row.resp,
    ]);

    state.totalResponses += 1;
    state.lastCommand = row.command;
    updateCounters();
}

function appendEvent(payload) {
    const row = {
        timestamp: payload.timestamp || new Date().toISOString(),
        message: payload.message || "Evento sin mensaje",
    };

    updateMulticastCard(row);

    prependRow(ui.eventsTableBody, [
        nowLabel(row.timestamp),
        row.message,
    ]);

    state.totalEvents += 1;
    updateCounters();
}

function sendCommand(command) {
    if (ws.readyState !== WebSocket.OPEN) {
        appendResponseLog({
            timestamp: new Date().toISOString(),
            command,
            resp: "WebSocket no conectado",
        });
        return;
    }

    ws.send(JSON.stringify({ command }));
}

ui.ledSwitch.addEventListener("change", (event) => {
    const isOn = event.target.checked;
    setLedVisualState(isOn);
    sendCommand(isOn ? "LED_ON" : "LED_OFF");
});

ui.btnStatus.addEventListener("click", () => sendCommand("STATUS"));

ws.onopen = () => {
    setConnection("badge-soft", "Conectado al gateway");
};

ws.onclose = () => {
    setConnection("badge-warning-soft", "Desconectado");
};

ws.onerror = () => {
    setConnection("badge-danger-soft", "Error de conexion");
};

ws.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        if (data.type === "response") {
            appendResponseLog(data);
            return;
        }

        if (data.type === "event") {
            appendEvent(data);
            return;
        }

        appendResponseLog({
            timestamp: new Date().toISOString(),
            command: "UNKNOWN",
            resp: event.data,
        });
    } catch (_error) {
        appendResponseLog({
            timestamp: new Date().toISOString(),
            command: "PARSE_ERROR",
            resp: event.data,
        });
    }
};

updateCounters();
setLedVisualState(false);
setConnection("badge-warning-soft", "Conectando...");
