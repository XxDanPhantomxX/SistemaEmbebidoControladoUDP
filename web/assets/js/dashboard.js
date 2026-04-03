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
    deviceSelect: document.getElementById("deviceSelect"),
    deviceTargetMeta: document.getElementById("deviceTargetMeta"),
    temperatureChart: document.getElementById("temperatureChart"),
    humidityChart: document.getElementById("humidityChart"),
    btnStatus: document.getElementById("btnStatus"),
};

const state = {
    totalResponses: 0,
    totalEvents: 0,
    lastCommand: "-",
    maxRows: 50,
    selectedTarget: "",
    devicesById: {},
    maxChartPoints: 30,
    temperatureSeries: [],
    humiditySeries: [],
    seriesByDevice: {},
    lastGlobalSensorRow: null,
};

let temperatureChartInstance = null;
let humidityChartInstance = null;

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

function createLineChart(canvas, label, color) {
    if (typeof Chart === "undefined" || !canvas) {
        return null;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        return null;
    }

    return new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [
                {
                    label,
                    data: [],
                    borderColor: color,
                    backgroundColor: color,
                    tension: 0.25,
                    fill: false,
                    pointRadius: 2,
                },
            ],
        },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    ticks: {
                        color: "#697386",
                        maxTicksLimit: 8,
                    },
                    grid: {
                        color: "rgba(100, 116, 139, 0.15)",
                    },
                },
                y: {
                    ticks: {
                        color: "#697386",
                    },
                    grid: {
                        color: "rgba(100, 116, 139, 0.12)",
                    },
                },
            },
            plugins: {
                legend: {
                    labels: {
                        color: "#334155",
                    },
                },
            },
        },
    });
}

function pushChartPoint(series, point) {
    series.push(point);
    while (series.length > state.maxChartPoints) {
        series.shift();
    }
}

function applySeriesToChart(chartInstance, series) {
    if (!chartInstance) {
        return;
    }

    chartInstance.data.labels = series.map((item) => item.label);
    chartInstance.data.datasets[0].data = series.map((item) => item.value);
    chartInstance.update();
}

function getOrCreateDeviceSeries(deviceId) {
    if (!state.seriesByDevice[deviceId]) {
        state.seriesByDevice[deviceId] = {
            temperature: [],
            humidity: [],
        };
    }
    return state.seriesByDevice[deviceId];
}

function renderChartsForCurrentSelection() {
    if (!state.selectedTarget) {
        applySeriesToChart(temperatureChartInstance, state.temperatureSeries);
        applySeriesToChart(humidityChartInstance, state.humiditySeries);
        return;
    }

    const selectedSeries = state.seriesByDevice[state.selectedTarget] || {
        temperature: [],
        humidity: [],
    };
    applySeriesToChart(temperatureChartInstance, selectedSeries.temperature);
    applySeriesToChart(humidityChartInstance, selectedSeries.humidity);
}

function updateCharts(row) {
    const pointLabel = nowLabel(row.timestamp);
    const deviceId = row.device_id && row.device_id !== "-" ? row.device_id : null;

    if (row.temp !== null && row.temp !== undefined) {
        pushChartPoint(state.temperatureSeries, {
            label: pointLabel,
            value: row.temp,
        });
        if (deviceId) {
            const deviceSeries = getOrCreateDeviceSeries(deviceId);
            pushChartPoint(deviceSeries.temperature, {
                label: pointLabel,
                value: row.temp,
            });
        }
    }

    if (row.hum !== null && row.hum !== undefined) {
        pushChartPoint(state.humiditySeries, {
            label: pointLabel,
            value: row.hum,
        });
        if (deviceId) {
            const deviceSeries = getOrCreateDeviceSeries(deviceId);
            pushChartPoint(deviceSeries.humidity, {
                label: pointLabel,
                value: row.hum,
            });
        }
    }

    renderChartsForCurrentSelection();
}

function normalizeDeviceEntries(devices) {
    const normalized = {};
    (devices || []).forEach((device) => {
        const deviceId = device.device_id || device.deviceId || device.id;
        if (!deviceId) {
            return;
        }
        normalized[deviceId] = {
            deviceId,
            ip: device.ip || "-",
            lastSeen: device.last_seen || device.lastSeen || null,
            lastTemp: device.last_temp ?? null,
            lastHum: device.last_hum ?? null,
        };

        if (normalized[deviceId].lastTemp === null && device.lastTemp !== undefined) {
            normalized[deviceId].lastTemp = device.lastTemp;
        }
        if (normalized[deviceId].lastHum === null && device.lastHum !== undefined) {
            normalized[deviceId].lastHum = device.lastHum;
        }
    });
    return normalized;
}

function buildDeviceCatalogSignature(devicesById) {
    return Object.keys(devicesById)
        .sort()
        .map((deviceId) => `${deviceId}|${devicesById[deviceId].ip || "-"}`)
        .join(";");
}

function updateSelectedTargetMeta() {
    if (!state.selectedTarget) {
        ui.deviceTargetMeta.textContent = "Sin dispositivo seleccionado.";
        return;
    }

    const selected = state.devicesById[state.selectedTarget];
    if (!selected) {
        ui.deviceTargetMeta.textContent = "Dispositivo no disponible.";
        return;
    }

    ui.deviceTargetMeta.textContent = `IP ${selected.ip} | Ultima lectura ${nowLabel(selected.lastSeen)}`;
}

function syncDeviceSelector(devices) {
    const normalizedDevices = normalizeDeviceEntries(devices);
    const hasIncomingDevices = Object.keys(normalizedDevices).length > 0;
    const hasCurrentDevices = Object.keys(state.devicesById).length > 0;
    const incomingCatalogSignature = buildDeviceCatalogSignature(normalizedDevices);
    const currentCatalogSignature = buildDeviceCatalogSignature(state.devicesById);

    // Ignore catalog snapshots that do not change device ids or IPs.
    if (hasCurrentDevices && incomingCatalogSignature === currentCatalogSignature) {
        return;
    }

    // Keep current catalog when a transient empty update arrives.
    if (!hasIncomingDevices && hasCurrentDevices) {
        updateSelectedTargetMeta();
        return;
    }

    const previous = state.selectedTarget;
    state.devicesById = normalizedDevices;

    // Keep the placeholder and update only changed options to avoid visual reset.
    const existingOptions = Array.from(ui.deviceSelect.options);
    const optionById = new Map(
        existingOptions
            .filter((opt) => opt.value)
            .map((opt) => [opt.value, opt]),
    );

    const ids = Object.keys(state.devicesById).sort();
    const incomingIdSet = new Set(ids);

    optionById.forEach((option, deviceId) => {
        if (!incomingIdSet.has(deviceId)) {
            option.remove();
        }
    });

    ids.forEach((deviceId) => {
        const info = state.devicesById[deviceId];
        const label = `${deviceId} (${info.ip})`;
        const existing = optionById.get(deviceId);
        if (existing) {
            if (existing.textContent !== label) {
                existing.textContent = label;
            }
            return;
        }

        const option = document.createElement("option");
        option.value = deviceId;
        option.textContent = label;
        ui.deviceSelect.appendChild(option);
    });

    if (previous && state.devicesById[previous]) {
        state.selectedTarget = previous;
    } else if (ids.length > 0) {
        state.selectedTarget = ids[0];
    } else {
        state.selectedTarget = "";
    }

    ui.deviceSelect.value = state.selectedTarget;
    updateSelectedTargetMeta();
    renderMulticastCardForCurrentSelection();
    renderChartsForCurrentSelection();
}

function upsertDeviceFromEvent(eventRow) {
    const deviceId = eventRow.device_id;
    if (!deviceId || deviceId === "-") {
        return;
    }

    const previous = state.devicesById[deviceId] || {};
    const isNewDevice = !state.devicesById[deviceId];
    const previousIp = previous.ip || "-";
    const nextIp = eventRow.ip && eventRow.ip !== "-" ? eventRow.ip : previousIp;
    const ipChanged = !isNewDevice && previousIp !== nextIp;

    state.devicesById[deviceId] = {
        deviceId,
        ip: nextIp,
        lastSeen: eventRow.timestamp || previous.lastSeen || null,
        lastTemp: eventRow.temp ?? previous.lastTemp ?? null,
        lastHum: eventRow.hum ?? previous.lastHum ?? null,
    };

    // Rebuild the selector only when the device catalog changes.
    if (isNewDevice || ipChanged) {
        syncDeviceSelector(Object.values(state.devicesById));
        return;
    }

    updateSelectedTargetMeta();
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
    const deviceMatch = source.match(/(?:^|[:;\s])(?:DEVICE|ID)\s*=\s*([^;\s]+)/i);

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
    ui.unicastCommand.textContent = row.target ? `${row.command} (${row.target})` : row.command;
    ui.unicastResponse.textContent = row.resp;
    ui.unicastLastUpdate.textContent = nowLabel(row.timestamp);
    if (row.resp.startsWith("ERROR:")) {
        ui.unicastStatus.className = "badge badge-warning-soft";
        ui.unicastStatus.textContent = "Error en comando unicast";
    } else {
        ui.unicastStatus.className = "badge badge-soft";
        ui.unicastStatus.textContent = "Respuesta unicast recibida";
    }

    if (row.command === "LED_ON") {
        ui.ledSwitch.checked = true;
        setLedVisualState(true);
    } else if (row.command === "LED_OFF") {
        ui.ledSwitch.checked = false;
        setLedVisualState(false);
    }
}

function updateMulticastCard(row) {
    const readings = {
        deviceId: row.device_id || null,
        temperature: row.temp ?? null,
        humidity: row.hum ?? null,
    };

    if (readings.temperature === null || readings.humidity === null || !readings.deviceId) {
        const parsed = extractSensorReadings(row.message);
        readings.deviceId = readings.deviceId || parsed.deviceId;
        readings.temperature = readings.temperature === null ? parsed.temperature : readings.temperature;
        readings.humidity = readings.humidity === null ? parsed.humidity : readings.humidity;
    }

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

function renderMulticastCardForCurrentSelection() {
    if (!state.selectedTarget) {
        if (state.lastGlobalSensorRow) {
            updateMulticastCard(state.lastGlobalSensorRow);
        }
        return;
    }

    const selected = state.devicesById[state.selectedTarget];
    if (!selected) {
        ui.deviceValue.textContent = "--";
        ui.tempValue.textContent = "--";
        ui.humidityValue.textContent = "--";
        ui.multicastStatus.className = "badge badge-warning-soft";
        ui.multicastStatus.textContent = "Dispositivo seleccionado sin datos";
        ui.multicastLastUpdate.textContent = "--:--:--";
        return;
    }

    updateMulticastCard({
        timestamp: selected.lastSeen,
        device_id: selected.deviceId,
        temp: selected.lastTemp,
        hum: selected.lastHum,
        message: "",
    });
}

function appendResponseLog(payload) {
    const row = {
        timestamp: payload.timestamp || new Date().toISOString(),
        target: payload.target || "-",
        ip: payload.ip || "-",
        command: payload.command || "(desconocido)",
        resp: payload.resp || "Sin contenido",
    };

    updateUnicastCard(row);

    prependRow(ui.responsesTableBody, [
        nowLabel(row.timestamp),
        row.target,
        row.ip,
        row.command,
        row.resp,
    ]);

    state.totalResponses += 1;
    state.lastCommand = row.command;
    updateCounters();
}

function appendEvent(payload) {
    const fallback = extractSensorReadings(payload.message || "");
    const row = {
        timestamp: payload.timestamp || new Date().toISOString(),
        device_id: payload.device_id || fallback.deviceId || "-",
        ip: payload.ip || "-",
        temp: payload.temp ?? fallback.temperature,
        hum: payload.hum ?? fallback.humidity,
        message: payload.message || "Evento sin mensaje",
    };

    upsertDeviceFromEvent(row);
    state.lastGlobalSensorRow = row;

    if (!state.selectedTarget || state.selectedTarget === row.device_id) {
        updateMulticastCard(row);
    }
    updateCharts(row);

    const eventLabel = row.message !== "Evento sin mensaje"
        ? row.message
        : `TEMP=${formatOneDecimal(row.temp)} HUM=${formatOneDecimal(row.hum)}`;

    prependRow(ui.eventsTableBody, [
        nowLabel(row.timestamp),
        row.device_id,
        row.ip,
        eventLabel,
    ]);

    state.totalEvents += 1;
    updateCounters();
}

function sendCommand(command) {
    if (ws.readyState !== WebSocket.OPEN) {
        appendResponseLog({
            timestamp: new Date().toISOString(),
            target: state.selectedTarget || "-",
            command,
            resp: "WebSocket no conectado",
        });
        return;
    }

    if (!state.selectedTarget) {
        appendResponseLog({
            timestamp: new Date().toISOString(),
            command,
            resp: "ERROR: seleccione un dispositivo target",
        });
        return;
    }

    ws.send(JSON.stringify({ target: state.selectedTarget, command }));
}

ui.deviceSelect.addEventListener("change", (event) => {
    state.selectedTarget = String(event.target.value || "");
    updateSelectedTargetMeta();
    renderMulticastCardForCurrentSelection();
    renderChartsForCurrentSelection();
});

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

        if (data.type === "devices_update") {
            syncDeviceSelector(data.devices || []);
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

temperatureChartInstance = createLineChart(ui.temperatureChart, "Temperatura (C)", "#e11d48");
humidityChartInstance = createLineChart(ui.humidityChart, "Humedad (%)", "#0ea5e9");
