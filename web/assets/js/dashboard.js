const MAX_EVENT_HISTORY = 120;
const MAX_SERIES_POINTS = 0;
const MAX_COMMAND_LOG = 10;
const HISTORY_API_LIMIT = 0;
const HISTORY_TIMELINE_SEED = 40;

const state = {
  socket: null,
  reconnectTimer: null,
  devices: new Map(),
  multicastHistory: [],
  activeTab: "general",
};

const dom = {
  tabsNav: document.getElementById("tabsNav"),
  deviceTabsContainer: document.getElementById("deviceTabsContainer"),
  multicastHistory: document.getElementById("multicastHistory"),
  devicesSummary: document.getElementById("devicesSummary"),
  connectionStatus: document.getElementById("connectionStatus"),
  tabTemplate: document.getElementById("deviceTabTemplate"),
  contentTemplate: document.getElementById("deviceContentTemplate"),
};

function formatTs(value) {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function safeValue(value, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return `${Number(value).toFixed(1)}${suffix}`;
}

function contentIdFromKey(deviceKey) {
  const base64 = safeBase64(deviceKey)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `device-${base64}`;
}

function safeBase64(text) {
  try {
    return btoa(text);
  } catch {
    return btoa(unescape(encodeURIComponent(text)));
  }
}

function buildDeviceKey(payload) {
  if (payload.device_key) {
    return payload.device_key;
  }
  const id = payload.device_id || payload.target || "UNKNOWN";
  const ip = payload.ip || "unknown";
  return `${id}@${ip}`;
}

function setConnectionStatus(text, connected) {
  dom.connectionStatus.textContent = text;
  dom.connectionStatus.className = connected
    ? "mt-4 inline-flex rounded-full border border-emerald-300/70 bg-emerald-600/30 px-3 py-1.5 text-xs font-semibold text-emerald-50 shadow-sm backdrop-blur sm:text-sm"
    : "mt-4 inline-flex rounded-full border border-emerald-200/60 bg-slate-900/25 px-3 py-1.5 text-xs font-semibold text-emerald-50 backdrop-blur sm:text-sm";
}

function connectWebSocket() {
  if (state.socket) {
    state.socket.close();
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const wsUrl = `${protocol}://${window.location.host}/ws`;

  setConnectionStatus("Conectando...", false);
  const socket = new WebSocket(wsUrl);
  state.socket = socket;

  socket.onopen = () => {
    setConnectionStatus("Conectado", true);
  };

  socket.onmessage = (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      addMulticastEvent({
        timestamp: new Date().toISOString(),
        text: `Mensaje no JSON recibido: ${String(event.data)}`,
      });
      return;
    }
    processMessage(payload);
  };

  socket.onerror = () => {
    setConnectionStatus("Error de conexion", false);
  };

  socket.onclose = () => {
    setConnectionStatus("Desconectado - reintentando", false);
    if (state.reconnectTimer) {
      window.clearTimeout(state.reconnectTimer);
    }
    state.reconnectTimer = window.setTimeout(connectWebSocket, 2000);
  };
}

function ensureDevice(initialData) {
  const deviceKey = initialData.deviceKey;
  let device = state.devices.get(deviceKey);
  let created = false;

  if (!device) {
    const contentId = contentIdFromKey(deviceKey);

    const tabButton = dom.tabTemplate.content.firstElementChild.cloneNode(true);
    tabButton.dataset.tab = contentId;

    const content = dom.contentTemplate.content.firstElementChild.cloneNode(true);
    content.dataset.content = contentId;
    content.dataset.deviceKey = deviceKey;

    const titleNode = content.querySelector(".device-title");
    const metaNode = content.querySelector(".device-meta");
    const tempNode = content.querySelector(".temp-value");
    const humNode = content.querySelector(".hum-value");
    const commandLog = content.querySelector(".command-log");
    const tempCanvas = content.querySelector(".chart-temp");
    const humCanvas = content.querySelector(".chart-hum");

    dom.tabsNav.appendChild(tabButton);
    dom.deviceTabsContainer.appendChild(content);

    device = {
      deviceKey,
      deviceId: initialData.deviceId || "UNKNOWN",
      ip: initialData.ip || "unknown",
      lastSeen: initialData.lastSeen || null,
      lastTemp: initialData.lastTemp ?? null,
      lastHum: initialData.lastHum ?? null,
      tempSeries: [],
      humSeries: [],
      commandLogEntries: [],
      historyLoading: false,
      historyLoaded: false,
      ui: {
        contentId,
        tabButton,
        content,
        titleNode,
        metaNode,
        tempNode,
        humNode,
        commandLog,
        tempCanvas,
        humCanvas,
      },
    };

    state.devices.set(deviceKey, device);
    created = true;
  }

  if (initialData.deviceId) {
    device.deviceId = initialData.deviceId;
  }
  if (initialData.ip) {
    device.ip = initialData.ip;
  }
  if (initialData.lastSeen) {
    device.lastSeen = initialData.lastSeen;
  }

  if (initialData.lastTemp !== undefined && initialData.lastTemp !== null) {
    const temp = Number(initialData.lastTemp);
    if (!Number.isNaN(temp)) {
      device.lastTemp = temp;
      appendSeriesPoint(device.tempSeries, initialData.lastSeen, temp);
    }
  }

  if (initialData.lastHum !== undefined && initialData.lastHum !== null) {
    const hum = Number(initialData.lastHum);
    if (!Number.isNaN(hum)) {
      device.lastHum = hum;
      appendSeriesPoint(device.humSeries, initialData.lastSeen, hum);
    }
  }

  renderDevice(device);
  renderDevicesSummary();

  if ((created || !device.historyLoaded) && device.deviceId && device.deviceId !== "UNKNOWN") {
    void hydrateDeviceFromHistory(device);
  }

  return device;
}

function appendSeriesPoint(series, timestamp, value) {
  const pointTimestamp = timestamp || new Date().toISOString();
  const exists = series.some((item) => item.timestamp === pointTimestamp);
  if (exists) {
    return;
  }

  series.push({
    timestamp: pointTimestamp,
    value,
  });

  series.sort((a, b) => {
    const aDate = new Date(a.timestamp).getTime();
    const bDate = new Date(b.timestamp).getTime();
    return aDate - bDate;
  });

  if (MAX_SERIES_POINTS > 0 && series.length > MAX_SERIES_POINTS) {
    series.splice(0, series.length - MAX_SERIES_POINTS);
  }
}

function normalizeHistoryRecord(record) {
  const tempRaw = record.temp ?? record.temperature;
  const humRaw = record.hum ?? record.humidity;

  const temp = tempRaw === null || tempRaw === undefined ? null : Number(tempRaw);
  const hum = humRaw === null || humRaw === undefined ? null : Number(humRaw);

  return {
    timestamp: record.timestamp || null,
    temp: Number.isNaN(temp) ? null : temp,
    hum: Number.isNaN(hum) ? null : hum,
  };
}

function shouldReplaceByTimestamp(currentTs, incomingTs) {
  if (!incomingTs) {
    return false;
  }
  if (!currentTs) {
    return true;
  }

  const current = new Date(currentTs).getTime();
  const incoming = new Date(incomingTs).getTime();

  if (Number.isNaN(current)) {
    return true;
  }
  if (Number.isNaN(incoming)) {
    return false;
  }
  return incoming > current;
}

async function hydrateDeviceFromHistory(device) {
  if (!device || device.historyLoading || device.historyLoaded || !device.deviceId || device.deviceId === "UNKNOWN") {
    return;
  }

  device.historyLoading = true;

  try {
    const response = await fetch(`/history/${encodeURIComponent(device.deviceId)}?limit=${HISTORY_API_LIMIT}`);
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const records = Array.isArray(payload?.records) ? payload.records : [];

    if (records.length === 0) {
      device.historyLoaded = true;
      return;
    }

    const ordered = records
      .map(normalizeHistoryRecord)
      .filter((item) => item.timestamp)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const item of ordered) {
      if (item.temp !== null) {
        appendSeriesPoint(device.tempSeries, item.timestamp, item.temp);
      }
      if (item.hum !== null) {
        appendSeriesPoint(device.humSeries, item.timestamp, item.hum);
      }
    }

    const latest = ordered[ordered.length - 1];
    if (latest) {
      if (latest.temp !== null) {
        device.lastTemp = latest.temp;
      }
      if (latest.hum !== null) {
        device.lastHum = latest.hum;
      }
      if (shouldReplaceByTimestamp(device.lastSeen, latest.timestamp)) {
        device.lastSeen = latest.timestamp;
      }
    }

    const sampleSize = Math.min(HISTORY_TIMELINE_SEED, records.length);
    for (let i = 0; i < sampleSize; i += 1) {
      const item = normalizeHistoryRecord(records[i]);
      const text = `Historico DB ${device.deviceId}: TEMP=${safeValue(item.temp, " C")}; HUM=${safeValue(item.hum, " %")}`;
      addMulticastEvent({
        timestamp: item.timestamp || new Date().toISOString(),
        text,
      });
    }

    device.historyLoaded = true;
    renderDevice(device);
    renderDevicesSummary();
  } catch {
    // Ignore transient fetch errors and allow retry on next device update.
  } finally {
    device.historyLoading = false;
  }
}

function addMulticastEvent(message) {
  state.multicastHistory.push(message);
  if (state.multicastHistory.length > MAX_EVENT_HISTORY) {
    state.multicastHistory.splice(0, state.multicastHistory.length - MAX_EVENT_HISTORY);
  }
  renderMulticastHistory();
}

function processMessage(payload) {
  const msgType = inferMessageType(payload);

  if (msgType === "devices_update") {
    for (const dev of payload.devices || []) {
      ensureDevice({
        deviceKey: dev.device_key || `${dev.device_id}@${dev.ip}`,
        deviceId: dev.device_id,
        ip: dev.ip,
        lastSeen: dev.last_seen,
        lastTemp: dev.last_temp,
        lastHum: dev.last_hum,
      });
    }
    return;
  }

  if (msgType === "event") {
    const hasOrigin = payload.ip && payload.message;
    if (hasOrigin) {
      addMulticastEvent({
        timestamp: payload.timestamp,
        text: `Multicast recibido de ${payload.ip}: ${payload.message}`,
      });
    }

    const eventDeviceId = payload.device_id || payload.device || payload.id;
    if (eventDeviceId && payload.ip) {
      const device = ensureDevice({
        deviceKey: buildDeviceKey(payload),
        deviceId: eventDeviceId,
        ip: payload.ip,
        lastSeen: payload.timestamp,
      });

      if (payload.temp !== null && payload.temp !== undefined) {
        const temp = Number(payload.temp);
        if (!Number.isNaN(temp)) {
          device.lastTemp = temp;
          appendSeriesPoint(device.tempSeries, payload.timestamp, temp);
        }
      }

      if (payload.hum !== null && payload.hum !== undefined) {
        const hum = Number(payload.hum);
        if (!Number.isNaN(hum)) {
          device.lastHum = hum;
          appendSeriesPoint(device.humSeries, payload.timestamp, hum);
        }
      }

      device.lastSeen = payload.timestamp || device.lastSeen;
      renderDevice(device);
      renderDevicesSummary();
    }
    return;
  }

  if (msgType === "response") {
    const targetKey = payload.target_key || `${payload.target || "UNKNOWN"}@${payload.ip || "unknown"}`;
    const device = state.devices.get(targetKey);

    if (!device) {
      return;
    }

    const line = `${formatTs(payload.timestamp)} - ${payload.command}: ${payload.resp}`;
    device.commandLogEntries.push(line);
    if (device.commandLogEntries.length > MAX_COMMAND_LOG) {
      device.commandLogEntries.splice(0, device.commandLogEntries.length - MAX_COMMAND_LOG);
    }
    renderDevice(device);
    return;
  }

  addMulticastEvent({
    timestamp: payload.timestamp || new Date().toISOString(),
    text: `Mensaje desconocido: ${JSON.stringify(payload)}`,
  });
}

function inferMessageType(payload) {
  const explicit = (payload && payload.type ? String(payload.type) : "").toLowerCase();
  if (explicit === "devices_update" || explicit === "event" || explicit === "response") {
    return explicit;
  }

  if (Array.isArray(payload?.devices)) {
    return "devices_update";
  }

  if (Object.prototype.hasOwnProperty.call(payload || {}, "command")
    && Object.prototype.hasOwnProperty.call(payload || {}, "resp")) {
    return "response";
  }

  if (Object.prototype.hasOwnProperty.call(payload || {}, "message")
    || Object.prototype.hasOwnProperty.call(payload || {}, "temp")
    || Object.prototype.hasOwnProperty.call(payload || {}, "hum")) {
    return "event";
  }

  return "unknown";
}

function renderMulticastHistory() {
  dom.multicastHistory.innerHTML = "";

  const reversed = [...state.multicastHistory].reverse();
  for (const item of reversed) {
    const li = document.createElement("li");
    li.className = "rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-3 shadow-sm";
    const time = document.createElement("span");
    time.className = "block font-mono text-xs text-slate-500";
    time.textContent = formatTs(item.timestamp);

    const text = document.createElement("span");
    text.className = "mt-1 block break-words text-sm text-slate-700";
    text.textContent = item.text;

    li.appendChild(time);
    li.appendChild(text);
    dom.multicastHistory.appendChild(li);
  }

  if (reversed.length === 0) {
    const li = document.createElement("li");
    li.className = "rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500";
    li.textContent = "Sin eventos multicast por el momento.";
    dom.multicastHistory.appendChild(li);
  }
}

function renderDevicesSummary() {
  dom.devicesSummary.innerHTML = "";

  const devices = [...state.devices.values()].sort((a, b) => {
    if (a.deviceId === b.deviceId) {
      return a.ip.localeCompare(b.ip);
    }
    return a.deviceId.localeCompare(b.deviceId);
  });

  if (devices.length === 0) {
    dom.devicesSummary.textContent = "Todavia no hay dispositivos detectados.";
    dom.devicesSummary.className = "mt-3 text-sm text-slate-500";
    return;
  }

  dom.devicesSummary.className = "mt-3 grid gap-3";

  for (const device of devices) {
    const box = document.createElement("article");
    box.className = "rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-3 shadow-sm";

    const title = document.createElement("h3");
    title.className = "text-sm font-semibold text-slate-900";
    title.textContent = device.deviceId;

    const ip = document.createElement("p");
    ip.className = "mt-1 text-sm text-slate-600";
    ip.textContent = device.ip;

    const temp = document.createElement("p");
    temp.className = "mt-1 text-sm text-slate-700";
    const tempStrong = document.createElement("strong");
    tempStrong.textContent = safeValue(device.lastTemp, " C");
    temp.appendChild(document.createTextNode("T: "));
    temp.appendChild(tempStrong);

    const hum = document.createElement("p");
    hum.className = "mt-1 text-sm text-slate-700";
    const humStrong = document.createElement("strong");
    humStrong.textContent = safeValue(device.lastHum, " %");
    hum.appendChild(document.createTextNode("H: "));
    hum.appendChild(humStrong);

    const last = document.createElement("p");
    last.className = "mt-1 text-xs text-slate-500";
    last.textContent = `Ultimo: ${formatTs(device.lastSeen)}`;

    box.appendChild(title);
    box.appendChild(ip);
    box.appendChild(temp);
    box.appendChild(hum);
    box.appendChild(last);
    dom.devicesSummary.appendChild(box);
  }
}

function renderCommandLog(device) {
  const lines = [...device.commandLogEntries].reverse();

  if (lines.length === 0) {
    device.ui.commandLog.textContent = "Sin respuestas de comandos todavia.";
    device.ui.commandLog.className = "command-log mt-3 max-h-36 overflow-auto rounded-xl border border-slate-200 bg-white p-2 font-mono text-xs text-slate-500";
    return;
  }

  device.ui.commandLog.className = "command-log mt-3 max-h-36 overflow-auto rounded-xl border border-slate-200 bg-white p-2 font-mono text-xs text-slate-700";
  device.ui.commandLog.innerHTML = "";
  for (const line of lines) {
    const entry = document.createElement("div");
    entry.textContent = line;
    device.ui.commandLog.appendChild(entry);
  }
}

function renderDevice(device) {
  device.ui.tabButton.textContent = `${device.deviceId} (${device.ip})`;
  device.ui.titleNode.textContent = `Dispositivo ${device.deviceId}`;
  device.ui.metaNode.textContent = `IP ${device.ip} | Key ${device.deviceKey} | Ultimo visto ${formatTs(device.lastSeen)}`;
  device.ui.tempNode.textContent = safeValue(device.lastTemp, " C");
  device.ui.humNode.textContent = safeValue(device.lastHum, " %");

  renderCommandLog(device);
  drawSeriesChart(device.ui.tempCanvas, device.tempSeries, "#e8781f", "Temp (C)");
  drawSeriesChart(device.ui.humCanvas, device.humSeries, "#178f8f", "Hum (%)");
}

function prepareCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = Math.max(280, Math.floor(canvas.clientWidth || 640));
  const cssHeight = Math.max(200, Math.floor(canvas.clientHeight || 260));

  const requiredWidth = Math.floor(cssWidth * dpr);
  const requiredHeight = Math.floor(cssHeight * dpr);

  if (canvas.width !== requiredWidth || canvas.height !== requiredHeight) {
    canvas.width = requiredWidth;
    canvas.height = requiredHeight;
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: cssWidth, height: cssHeight };
}

function drawSeriesChart(canvas, series, lineColor, title) {
  const { ctx, width, height } = prepareCanvas(canvas);
  ctx.clearRect(0, 0, width, height);

  const margin = { top: 24, right: 14, bottom: 28, left: 44 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  ctx.fillStyle = "#0c1f31";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = margin.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + chartWidth, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(232, 243, 253, 0.8)";
  ctx.font = "12px monospace";
  ctx.fillText(title, margin.left, 16);

  if (series.length === 0) {
    ctx.fillStyle = "rgba(232, 243, 253, 0.6)";
    ctx.fillText("Sin datos", width / 2 - 28, height / 2);
    return;
  }

  const values = series.map((point) => point.value);
  let min = Math.min(...values);
  let max = Math.max(...values);

  if (Math.abs(max - min) < 0.001) {
    max += 1;
    min -= 1;
  }

  const pad = (max - min) * 0.15;
  max += pad;
  min -= pad;

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.beginPath();

  series.forEach((point, index) => {
    const x = margin.left + (chartWidth * index) / Math.max(1, series.length - 1);
    const ratio = (point.value - min) / (max - min);
    const y = margin.top + chartHeight - ratio * chartHeight;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  const last = series[series.length - 1];
  const lastX = margin.left + chartWidth;
  const lastRatio = (last.value - min) / (max - min);
  const lastY = margin.top + chartHeight - lastRatio * chartHeight;

  ctx.fillStyle = lineColor;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(232, 243, 253, 0.85)";
  ctx.font = "11px monospace";
  ctx.fillText(max.toFixed(1), 6, margin.top + 4);
  ctx.fillText(min.toFixed(1), 6, margin.top + chartHeight);
  ctx.fillText(`Ultimo: ${last.value.toFixed(1)}`, width - 130, 16);
}

function switchTab(tabId) {
  state.activeTab = tabId;

  const activeClasses = ["bg-slate-900", "text-white", "border-slate-900", "shadow"];
  const inactiveClasses = ["bg-white", "text-slate-700", "border-slate-300", "hover:bg-slate-50"];

  const tabButtons = dom.tabsNav.querySelectorAll(".tab-btn");
  for (const button of tabButtons) {
    const isActive = button.dataset.tab === tabId;
    button.classList.remove(...activeClasses, ...inactiveClasses);
    button.classList.add(...(isActive ? activeClasses : inactiveClasses));
  }

  const contentNodes = document.querySelectorAll(".tab-content");
  for (const node of contentNodes) {
    const isActive = node.dataset.content === tabId;
    node.classList.toggle("hidden", !isActive);
  }
}

function sendCommand(deviceKey, command) {
  const device = state.devices.get(deviceKey);
  if (!device || !state.socket || state.socket.readyState !== WebSocket.OPEN) {
    return;
  }

  const payload = {
    target: device.deviceId,
    target_key: device.deviceKey,
    command,
  };

  state.socket.send(JSON.stringify(payload));
  const line = `${new Date().toLocaleString()} - Enviado: ${command}`;
  device.commandLogEntries.push(line);
  if (device.commandLogEntries.length > MAX_COMMAND_LOG) {
    device.commandLogEntries.splice(0, device.commandLogEntries.length - MAX_COMMAND_LOG);
  }
  renderDevice(device);
}

function bindUiEvents() {
  dom.tabsNav.addEventListener("click", (event) => {
    const button = event.target.closest(".tab-btn");
    if (!button) {
      return;
    }
    switchTab(button.dataset.tab);
  });

  dom.deviceTabsContainer.addEventListener("click", (event) => {
    const commandButton = event.target.closest(".cmd-btn");
    if (!commandButton) {
      return;
    }
    const content = event.target.closest(".device-content");
    if (!content) {
      return;
    }
    const deviceKey = content.dataset.deviceKey;
    const command = commandButton.dataset.cmd;
    sendCommand(deviceKey, command);
  });

  window.addEventListener("resize", () => {
    for (const device of state.devices.values()) {
      drawSeriesChart(device.ui.tempCanvas, device.tempSeries, "#e8781f", "Temp (C)");
      drawSeriesChart(device.ui.humCanvas, device.humSeries, "#178f8f", "Hum (%)");
    }
  });
}

function init() {
  if (!dom.tabsNav || !dom.deviceTabsContainer || !dom.multicastHistory || !dom.devicesSummary || !dom.connectionStatus || !dom.tabTemplate || !dom.contentTemplate) {
    return;
  }
  bindUiEvents();
  switchTab("general");
  renderMulticastHistory();
  renderDevicesSummary();
  connectWebSocket();
}

init();
