// Configuration
const CONFIG = {
  dataEndpoint: '/data',
  faultAcknowledgeEndpoint: '/faults/ack',
  updateInterval: 2000,   // was 1000 — halved to reduce ESP32 load
  maxLogEntries: 10
};
const MAINTENANCE_CONFIG_KEY = 'maintenanceConfig';
const AMBIENT_AUTO_LOCATION_KEY = 'ambientAutoLocationLabel';
const AMBIENT_LOCATION_UPDATED_AT_KEY = 'ambientLocationUpdatedAt';
const AMBIENT_CACHE_KEY = 'ambientTempCache';
const RAILWAY_RELAY_CONFIG_KEY = 'railwayRelayConfig';
const THEME_KEY = 'appTheme';

// ── Theme ────────────────────────────────────────────────────────────────────
function initializeTheme() {
  setTheme(localStorage.getItem(THEME_KEY) || 'dark');
}

function setTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  localStorage.setItem(THEME_KEY, theme);
  updateThemeButtonIcon();
}

function toggleTheme() {
  setTheme(document.body.classList.contains('light-theme') ? 'dark' : 'light');
}

function updateThemeButtonIcon() {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = document.body.classList.contains('light-theme') ? '\u2600\uFE0F' : '\u{1F319}';
}

// ── State ────────────────────────────────────────────────────────────────────
let dataLog = [];
let isConnected = false;
let isFaultActionInProgress = false;
let isMotorRunning = false;
let isFaultResolvePending = false;
let faultResolveRequestedAtMs = 0;
let sensorFetchInFlight = false;
let ambientFetchInFlight = false;
let ambientTempFromAPI = null;
let locationName = '';
let hasShownLocalhostHint = false;
let lastDataSignature = '';   // dirty-check — skip redraw if nothing changed

const railwayRelayState = { inFlight: false, lastSentAtMs: 0, lastErrorAtMs: 0 };

// ── Ambient cache ─────────────────────────────────────────────────────────────
function loadAmbientCache() {
  try {
    const raw = localStorage.getItem(AMBIENT_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return null;
    const temperature = Number(p.temperature);
    const location = String(p.location || '').trim();
    if (!Number.isFinite(temperature)) return null;
    return { temperature, location };
  } catch (_) { return null; }
}

function saveAmbientCache(temperature, location) {
  if (!Number.isFinite(temperature)) return;
  try {
    localStorage.setItem(AMBIENT_CACHE_KEY, JSON.stringify({
      temperature, location: String(location || '').trim(), savedAt: Date.now()
    }));
  } catch (_) { }
}

// ── Network helpers ──────────────────────────────────────────────────────────
function fetchJsonWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal })
    .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
    .finally(() => clearTimeout(id));
}

function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

function getAmbientFromEsp(temp) {
  const v = Number(temp?.t2 ?? temp?.sensor2 ?? temp?.ambient ?? temp?.room ?? NaN);
  return Number.isFinite(v) ? v : null;
}

// ── DOM elements ─────────────────────────────────────────────────────────────
const elements = {
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  timestamp: document.getElementById('timestamp'),
  date: document.getElementById('date'),

  motorIndicator: document.getElementById('motorIndicator'),
  motorDot: document.getElementById('motorDot'),
  motorLabel: document.getElementById('motorLabel'),
  rpm: document.getElementById('rpm'),
  pulse: document.getElementById('pulse'),
  uptimeValue: document.getElementById('uptimeValue'),
  nextMaintenanceValue: document.getElementById('nextMaintenanceValue'),
  dueByHoursValue: document.getElementById('dueByHoursValue'),
  dueByDateValue: document.getElementById('dueByDateValue'),
  maintenanceStatusValue: document.getElementById('maintenanceStatusValue'),
  remainingLifeCycleValue: document.getElementById('remainingLifeCycleValue'),

  // value-only spans (no innerHTML needed)
  voltageVal: document.getElementById('voltageVal'),
  currentVal: document.getElementById('currentVal'),
  powerVal: document.getElementById('powerVal'),
  freqVal: document.getElementById('freqVal'),
  energyVal: document.getElementById('energyVal'),

  voltageBar: document.getElementById('voltageBar'),
  currentBar: document.getElementById('currentBar'),
  powerBar: document.getElementById('powerBar'),
  powerFactorBar: document.getElementById('powerFactorBar'),
  powerFactor: document.getElementById('powerFactor'),
  protectionOvUv: document.getElementById('protectionOvUv'),
  protectionCurrentTemp: document.getElementById('protectionCurrentTemp'),

  temp1Val: document.getElementById('temp1Val'),
  temp1Bar: document.getElementById('temp1Bar'),
  temp2Val: document.getElementById('temp2Val'),
  temp2Bar: document.getElementById('temp2Bar'),
  ambientLocationLabel: document.getElementById('ambientLocationLabel'),

  accelX: document.getElementById('accelX'),
  accelY: document.getElementById('accelY'),
  accelZ: document.getElementById('accelZ'),
  vibrationMagnitude: document.getElementById('vibrationMagnitude'),
  tapValue: document.getElementById('tapValue'),

  faultAlert: document.getElementById('faultAlert'),
  faultAlertText: document.getElementById('faultAlertText'),
  resolveAllFaultsBtn: document.getElementById('resolveAllFaultsBtn'),
  faultActionStatus: document.getElementById('faultActionStatus'),
  fault_overcurrent: document.getElementById('fault_overcurrent'),
  fault_overcurrent_action: document.getElementById('fault_overcurrent_action'),
  fault_overtemp: document.getElementById('fault_overtemp'),
  fault_overtemp_action: document.getElementById('fault_overtemp_action'),
  fault_stall: document.getElementById('fault_stall'),
  fault_stall_action: document.getElementById('fault_stall_action'),
  fault_vibration: document.getElementById('fault_vibration'),
  fault_vibration_action: document.getElementById('fault_vibration_action'),
  fault_overvoltage: document.getElementById('fault_overvoltage'),
  fault_overvoltage_action: document.getElementById('fault_overvoltage_action'),
  fault_undervoltage: document.getElementById('fault_undervoltage'),
  fault_undervoltage_action: document.getElementById('fault_undervoltage_action'),

  logBody: document.getElementById('logBody')
};

// ── Dirty-check signature ─────────────────────────────────────────────────────
function getDataSignature(data) {
  const m = data.motor || {};
  const p = data.power || {};
  const f = data.faults || {};
  return `${m.rpm}|${m.running}|${p.voltage}|${p.current}|${p.power}|${p.frequency}` +
    `|${f.overcurrent}|${f.overtemp}|${f.stall}|${f.vibration}|${f.overvoltage}|${f.undervoltage}`;
}

// ── Utility ───────────────────────────────────────────────────────────────────
function getCurrentTime() {
  const n = new Date();
  return n.getHours().toString().padStart(2, '0') + ':' + n.getMinutes().toString().padStart(2, '0');
}

function getCurrentDate() {
  const n = new Date();
  return `${n.getDate().toString().padStart(2, '0')}/${(n.getMonth() + 1).toString().padStart(2, '0')}/${n.getFullYear()}`;
}

function setConnectionStatus(connected) {
  isConnected = connected;
  if (elements.statusDot) elements.statusDot.className = connected ? 'status-dot connected' : 'status-dot error';
  if (elements.statusText) elements.statusText.textContent = connected ? 'Connected' : 'Disconnected';
}

function updateProgressBar(el, value, max, color) {
  if (!el) return;
  el.style.width = Math.min(100, (value / max) * 100).toFixed(0) + '%';
  el.style.background = color;
}

function formatUptime(v) {
  if (v === undefined || v === null || v === '') return '--';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  const s = Math.max(0, Math.floor(n));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m ${sec}s`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function getFirstDefined(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return null;
}

function getFirstNumber(...vals) {
  for (const v of vals) { const n = Number(v); if (Number.isFinite(n)) return n; }
  return null;
}

function formatDisplayValue(v) {
  return (v === undefined || v === null || v === '') ? '--' : String(v);
}

function parseDateValue(dv) {
  if (!dv) return null;
  const d = new Date(String(dv).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

function formatDateValue(dv) {
  const d = parseDateValue(dv);
  return d ? d.toLocaleString() : formatDisplayValue(dv);
}

function formatRemainingFromTotal(total, uptime) {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(uptime)) return '--';
  const rem = Math.max(0, total - uptime);
  return `${formatUptime(rem)} (${((rem / total) * 100).toFixed(1)}%)`;
}

function setFaultActionStatus(msg, isError) {
  if (!elements.faultActionStatus) return;
  elements.faultActionStatus.textContent = msg || '';
  elements.faultActionStatus.className = isError ? 'fault-action-status error' : 'fault-action-status';
}

function loadMaintenanceConfig() {
  try {
    const raw = localStorage.getItem(MAINTENANCE_CONFIG_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return (p && typeof p === 'object') ? p : {};
  } catch (_) { return {}; }
}

function loadRailwayRelayConfig() {
  try {
    const raw = localStorage.getItem(RAILWAY_RELAY_CONFIG_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return null;
    return {
      enabled: p.enabled === true,
      endpoint: String(p.endpoint || '').trim(),
      apiKey: String(p.apiKey || '').trim(),
      deviceId: String(p.deviceId || 'esp32-motor-01').trim() || 'esp32-motor-01',
      intervalSeconds: Math.max(2, Math.min(3600, Number(p.intervalSeconds) || 10)),
      relayMode: String(p.relayMode || 'esp32')
    };
  } catch (_) { return null; }
}

function getAmbientLocationConfig() {
  const c = loadMaintenanceConfig();
  return {
    mode: c.ambientLocationMode || 'auto',
    state: String(c.ambientState || '').trim(),
    city: String(c.ambientCity || '').trim()
  };
}

// ── Fault handling ────────────────────────────────────────────────────────────
function updateFaults(data) {
  const faults = data.faults || {};
  const faultKeys = ['overcurrent', 'overtemp', 'stall', 'vibration', 'overvoltage', 'undervoltage'];
  const faultTitles = {
    overcurrent: 'Overcurrent', overtemp: 'Overtemp', stall: 'Stall',
    vibration: 'Vibration', overvoltage: 'Overvoltage', undervoltage: 'Undervoltage'
  };

  function normalizeFaultState(raw) {
    if (typeof raw === 'boolean') return { active: raw, latched: raw, ackRequired: raw };
    if (raw && typeof raw === 'object') {
      const active = raw.active === true || raw.fault === true;
      const latched = raw.latched === true || raw.latch === true || active;
      return { active, latched, ackRequired: raw.ackRequired === true || latched };
    }
    return { active: false, latched: false, ackRequired: false };
  }

  function renderFaultBadge(key, state) {
    const badge = elements[`fault_${key}`];
    const action = elements[`fault_${key}_action`];
    if (badge) {
      const hasFault = state.active || state.latched;
      badge.className = hasFault ? 'badge badge-on' : 'badge badge-off';
      badge.textContent = state.active ? 'ACTIVE' : state.latched ? 'LATCHED' : 'OK';
    }
    if (action) {
      action.hidden = !(state.latched || state.ackRequired);
      action.disabled = isFaultActionInProgress;
      action.dataset.faultKey = key;
    }
  }

  const pendingNames = [];
  const resolvableKeys = [];

  faultKeys.forEach(key => {
    const state = normalizeFaultState(faults[key]);
    renderFaultBadge(key, state);
    if (state.active || state.latched) pendingNames.push(faultTitles[key]);
    if (state.latched || state.ackRequired) resolvableKeys.push(key);
  });

  if (elements.faultAlert) elements.faultAlert.hidden = pendingNames.length === 0;
  if (elements.faultAlertText) {
    elements.faultAlertText.textContent = pendingNames.length === 0
      ? 'No active faults.'
      : `Attention required: ${pendingNames.join(', ')}`;
  }
  if (elements.resolveAllFaultsBtn) {
    elements.resolveAllFaultsBtn.disabled = isFaultActionInProgress || resolvableKeys.length === 0;
    elements.resolveAllFaultsBtn.dataset.faultKeys = JSON.stringify(resolvableKeys);
  }

  if (isFaultResolvePending) {
    if (pendingNames.length === 0) {
      setFaultActionStatus('Faults resolved and acknowledged by ESP.', false);
      isFaultResolvePending = false;
      setTimeout(() => setFaultActionStatus('', false), 2500);
    } else if ((Date.now() - faultResolveRequestedAtMs) > 6000) {
      setFaultActionStatus('Fault still active. Remove root cause, then resolve again.', true);
      isFaultResolvePending = false;
    }
  }
}

async function acknowledgeFaults(faultKeys) {
  if (!Array.isArray(faultKeys) || faultKeys.length === 0 || isFaultActionInProgress) return;
  try {
    isFaultActionInProgress = true;
    setFaultActionStatus('Sending resolve request...', false);
    const response = await fetchWithTimeout(CONFIG.faultAcknowledgeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ faults: faultKeys })
    }, 5000);
    if (!response.ok) throw new Error(`Fault acknowledge failed (${response.status})`);
    isFaultResolvePending = true;
    faultResolveRequestedAtMs = Date.now();
    setFaultActionStatus('Resolve request sent. Waiting for ESP confirmation...', false);
    await fetchSensorData();
  } catch (err) {
    isFaultResolvePending = false;
    setFaultActionStatus('Failed to send resolve request. Check ESP endpoint /faults/ack.', true);
  } finally {
    isFaultActionInProgress = false;
  }
}

function setupFaultActionHandlers() {
  ['overcurrent', 'overtemp', 'stall', 'vibration', 'overvoltage', 'undervoltage'].forEach(key => {
    const btn = elements[`fault_${key}_action`];
    if (btn) btn.addEventListener('click', async () => {
      if (btn.dataset.faultKey) await acknowledgeFaults([btn.dataset.faultKey]);
    });
  });
  if (elements.resolveAllFaultsBtn) {
    elements.resolveAllFaultsBtn.addEventListener('click', async () => {
      try {
        const keys = JSON.parse(elements.resolveAllFaultsBtn.dataset.faultKeys || '[]');
        await acknowledgeFaults(keys);
      } catch (_) { }
    });
  }
}

// ── Motor status ──────────────────────────────────────────────────────────────
function updateMotorStatus(data) {
  const motor = data.motor || {};
  const running = motor.running === true;
  isMotorRunning = running;

  elements.motorIndicator.className = 'motor-indicator ' + (running ? 'on' : 'off');
  elements.motorDot.className = 'motor-dot ' + (running ? 'on' : 'off');
  elements.motorLabel.textContent = running ? 'Running' : 'Stopped';
  updateMotorControlButton();

  elements.rpm.textContent = motor.rpm || 0;
  elements.pulse.textContent = motor.pulse || 0;

  const savedCfg = loadMaintenanceConfig();
  const uptime = data.uptime ?? motor.uptime;
  const maint = data.maintenance || motor.maintenance || {};

  const nextMaintenance = getFirstDefined(
    data.nextMaintenanceTime, data.next_maintenance_time, data.nextMaintenance, data.next_maintenance,
    motor.nextMaintenanceTime, motor.next_maintenance_time, motor.nextMaintenance,
    maint.nextMaintenanceTime, maint.next_maintenance_time, maint.nextMaintenance,
    savedCfg.nextMaintenanceTime
  );
  let remainingLifeCycle = getFirstDefined(
    data.remainingLifeCycle, data.remaining_life_cycle, data.remainingLifecycle,
    motor.remainingLifeCycle, motor.remaining_life_cycle, motor.remainingLifecycle,
    maint.remainingLifeCycle, maint.remaining_life_cycle, maint.remainingLifecycle
  );
  const maintHoursLimit = getFirstNumber(
    data.maintenanceHoursLimit, data.maintenance_hours_limit,
    motor.maintenanceHoursLimit, motor.maintenance_hours_limit,
    maint.maintenanceHoursLimit, maint.maintenance_hours_limit,
    savedCfg.maintenanceHoursLimit
  );

  if (remainingLifeCycle === null) {
    const totalLifeHours = getFirstNumber(
      data.totalLifeCycleHours, data.total_life_cycle_hours,
      motor.totalLifeCycleHours, motor.total_life_cycle_hours,
      maint.totalLifeCycleHours, maint.total_life_cycle_hours,
      savedCfg.totalLifeCycleHours
    );
    const totalLifeSecs = getFirstNumber(
      data.totalLifeCycleSeconds, data.total_life_cycle_seconds,
      motor.totalLifeCycleSeconds, motor.total_life_cycle_seconds,
      maint.totalLifeCycleSeconds, maint.total_life_cycle_seconds,
      Number.isFinite(totalLifeHours) ? totalLifeHours * 3600 : null
    );
    remainingLifeCycle = formatRemainingFromTotal(totalLifeSecs, getFirstNumber(uptime));
  }

  const uptimeSecs = getFirstNumber(uptime);
  const limitSecs = Number.isFinite(maintHoursLimit) ? maintHoursLimit * 3600 : null;
  const remainingSecs = Number.isFinite(limitSecs) && Number.isFinite(uptimeSecs)
    ? Math.max(0, limitSecs - uptimeSecs) : null;
  const dueByHours = Number.isFinite(limitSecs) && Number.isFinite(uptimeSecs)
    ? uptimeSecs >= limitSecs : null;
  const nextMaintDate = parseDateValue(nextMaintenance);
  const dueByDate = nextMaintDate ? Date.now() >= nextMaintDate.getTime() : null;
  const maintDue = dueByHours === true || dueByDate === true;

  if (elements.uptimeValue) elements.uptimeValue.textContent = formatUptime(uptime);
  if (elements.nextMaintenanceValue) elements.nextMaintenanceValue.textContent = formatDateValue(nextMaintenance);
  if (elements.dueByHoursValue) elements.dueByHoursValue.textContent = remainingSecs === null ? '--' : formatUptime(remainingSecs);
  if (elements.dueByDateValue) elements.dueByDateValue.textContent = dueByDate === null ? '--' : dueByDate ? 'Due' : 'Not due';
  if (elements.maintenanceStatusValue) elements.maintenanceStatusValue.textContent =
    (dueByHours === null && dueByDate === null) ? '--' : maintDue ? 'Maintenance Due' : 'OK';
  if (elements.remainingLifeCycleValue) elements.remainingLifeCycleValue.textContent = formatDisplayValue(remainingLifeCycle);
}

// ── Power metrics ─────────────────────────────────────────────────────────────
function updatePowerMetrics(data) {
  const p = data.power || {};

  const voltage = parseFloat(p.voltage || 0);
  if (elements.voltageVal) elements.voltageVal.textContent = voltage.toFixed(1);
  updateProgressBar(elements.voltageBar, voltage, 250, '#378ADD');

  const current = parseFloat(p.current || 0);
  if (elements.currentVal) elements.currentVal.textContent = current.toFixed(2);
  updateProgressBar(elements.currentBar, current, 10, '#EF9F27');

  const activePower = Math.round(p.power || 0);
  if (elements.powerVal) elements.powerVal.textContent = activePower;
  updateProgressBar(elements.powerBar, activePower, 2000, '#D85A30');

  const pf = parseFloat(p.powerFactor || 0).toFixed(2);
  if (elements.powerFactor) elements.powerFactor.textContent = pf;
  updateProgressBar(elements.powerFactorBar, pf, 1, '#1D9E75');

  const energy = parseFloat(p.energy || 0).toFixed(2);
  if (elements.energyVal) elements.energyVal.textContent = energy;

  const freq = parseFloat(p.frequency || 0).toFixed(1);
  if (elements.freqVal) elements.freqVal.textContent = freq;
}

// ── Protection summary ────────────────────────────────────────────────────────
function updateProtectionSummary(data) {
  if (!elements.protectionOvUv || !elements.protectionCurrentTemp) return;
  const prot = data.protection || {};
  const ov = Number(prot.overvoltageV);
  const uv = Number(prot.undervoltageV);
  const mc = Number(prot.maxCurrentA);
  const mt = Number(prot.maxTempC);
  elements.protectionOvUv.textContent = `OV ${Number.isFinite(ov) ? ov.toFixed(1) : '--'}V / UV ${Number.isFinite(uv) ? uv.toFixed(1) : '--'}V`;
  elements.protectionCurrentTemp.textContent = `I ${Number.isFinite(mc) ? mc.toFixed(1) : '--'}A | T ${Number.isFinite(mt) ? mt.toFixed(1) : '--'}C`;
}

// ── Temperature ───────────────────────────────────────────────────────────────
function updateTemperature(data) {
  if (!elements.temp1Val || !elements.temp2Val) return;
  const temp = data.temperature || data.temp || {};
  const t1 = parseFloat(temp.t1 || temp.sensor1 || temp.motor || 0);
  elements.temp1Val.textContent = t1.toFixed(1);
  updateProgressBar(elements.temp1Bar, t1, 100, '#D85A30');

  const espAmbient = getAmbientFromEsp(temp);
  if (Number.isFinite(ambientTempFromAPI)) {
    elements.temp2Val.textContent = ambientTempFromAPI.toFixed(1);
    updateProgressBar(elements.temp2Bar, ambientTempFromAPI, 50, '#378ADD');
  } else if (Number.isFinite(espAmbient)) {
    elements.temp2Val.textContent = espAmbient.toFixed(1);
    updateProgressBar(elements.temp2Bar, espAmbient, 50, '#378ADD');
  } else {
    elements.temp2Val.textContent = '--';
    updateProgressBar(elements.temp2Bar, 0, 50, '#378ADD');
  }

  if (elements.ambientLocationLabel) {
    elements.ambientLocationLabel.textContent = locationName
      ? `Location: ${locationName}`
      : Number.isFinite(espAmbient) ? 'Location: ESP sensor fallback' : 'Location: Detecting...';
  }
}

// ── Vibration ─────────────────────────────────────────────────────────────────
function updateVibration(data) {
  const vib = data.vibration || {};
  const x = parseFloat(vib.x || 0);
  const y = parseFloat(vib.y || 0);
  const z = parseFloat(vib.z || 0);
  if (elements.accelX) elements.accelX.textContent = x.toFixed(2);
  if (elements.accelY) elements.accelY.textContent = y.toFixed(2);
  if (elements.accelZ) elements.accelZ.textContent = z.toFixed(2);
  if (elements.vibrationMagnitude) elements.vibrationMagnitude.textContent = Math.sqrt(x * x + y * y + z * z).toFixed(2);
  if (elements.tapValue) elements.tapValue.textContent = vib.tap ? 'Yes' : 'No';
}

// ── Data log ──────────────────────────────────────────────────────────────────
function updateDataLog(data) {
  if (!elements.logBody) return;
  const p = data.power || {};
  const temp = data.temperature || data.temp || {};
  const motor = data.motor || {};

  dataLog.unshift({
    time: getCurrentTime(),
    voltage: parseFloat(p.voltage || p.v || 0).toFixed(1),
    current: parseFloat(p.current || p.a || 0).toFixed(2),
    power: Math.round(p.power || p.w || 0),
    temp1: parseFloat(temp.t1 || temp.sensor1 || temp.motor || 0).toFixed(1),
    temp2: (() => {
      if (Number.isFinite(ambientTempFromAPI)) return ambientTempFromAPI.toFixed(1);
      const e = getAmbientFromEsp(temp);
      return Number.isFinite(e) ? e.toFixed(1) : '--';
    })(),
    rpm: motor.rpm || 0
  });

  if (dataLog.length > CONFIG.maxLogEntries) dataLog = dataLog.slice(0, CONFIG.maxLogEntries);

  elements.logBody.innerHTML = dataLog.map(e =>
    `<tr><td>${e.time}</td><td>${e.voltage}</td><td>${e.current}</td><td>${e.power}</td><td>${e.temp1}</td><td>${e.temp2}</td><td>${e.rpm}</td></tr>`
  ).join('');
}

// ── Motor control button ──────────────────────────────────────────────────────
function updateMotorControlButton() {
  const btn = document.getElementById('stopMotorBtn');
  if (!btn) return;
  if (isMotorRunning) {
    btn.textContent = 'STOP';
    btn.classList.remove('start-btn-ribbon');
    btn.classList.add('stop-btn-ribbon');
    btn.title = 'Stop motor';
  } else {
    btn.textContent = 'START';
    btn.classList.remove('stop-btn-ribbon');
    btn.classList.add('start-btn-ribbon');
    btn.title = 'Start motor';
  }
}

function setupMotorControlButton() {
  const btn = document.getElementById('stopMotorBtn');
  if (!btn) return;
  updateMotorControlButton();
  btn.addEventListener('click', async () => {
    const shouldStart = !isMotorRunning;
    const endpoint = shouldStart ? '/motor/start' : '/motor/stop';
    const pendingLabel = shouldStart ? 'Starting...' : 'Stopping...';
    const errorLabel = shouldStart
      ? 'Failed to start motor. Resolve active faults first.'
      : 'Failed to stop motor. Check if ESP32 is connected.';
    try {
      btn.disabled = true;
      btn.textContent = pendingLabel;
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) throw new Error(`Motor control failed (${response.status})`);
      await fetchSensorData();
    } catch (_) {
      alert(errorLabel);
    } finally {
      btn.disabled = false;
      updateMotorControlButton();
    }
  });
}

// ── Railway relay ─────────────────────────────────────────────────────────────
async function relayDataToRailway(data) {
  const cfg = loadRailwayRelayConfig();
  if (!cfg || cfg.enabled !== true || !cfg.endpoint || cfg.relayMode !== 'browser') return;
  const nowMs = Date.now();
  if (railwayRelayState.inFlight || (nowMs - railwayRelayState.lastSentAtMs) < cfg.intervalSeconds * 1000) return;

  railwayRelayState.inFlight = true;
  try {
    const power = data.power || {};
    const motor = data.motor || {};
    const temp = data.temperature || {};
    const vib = data.vibration || {};
    const faults = data.faults || {};
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) { headers['x-api-key'] = cfg.apiKey; headers.Authorization = `Bearer ${cfg.apiKey}`; }

    const response = await fetch(cfg.endpoint, {
      method: 'POST', headers,
      body: JSON.stringify({
        source: 'esp32-dashboard', deviceId: cfg.deviceId, timestamp_ms: Date.now(),
        uptime: data.uptime || 0,
        motor: { running: motor.running, rpm: motor.rpm, pulse: motor.pulse, uptime: data.uptime || 0 },
        power: {
          voltage: power.voltage, current: power.current, power: power.power,
          powerFactor: power.powerFactor, energy: power.energy, frequency: power.frequency
        },
        temperature: { t1: temp.t1, t2: temp.t2 },
        vibration: { x: vib.x, y: vib.y, z: vib.z, tap: vib.tap },
        faults: {
          overcurrent: faults.overcurrent, overtemp: faults.overtemp,
          stall: faults.stall, vibration: faults.vibration,
          overvoltage: faults.overvoltage, undervoltage: faults.undervoltage
        }
      })
    });
    if (!response.ok) throw new Error(`relay failed (${response.status})`);
    railwayRelayState.lastSentAtMs = Date.now();
  } catch (err) {
    const now = Date.now();
    if ((now - railwayRelayState.lastErrorAtMs) > 30000) {
      console.warn('Railway relay error:', err);
      railwayRelayState.lastErrorAtMs = now;
    }
  } finally {
    railwayRelayState.inFlight = false;
  }
}

// ── Main update ───────────────────────────────────────────────────────────────
function updateDashboard(data) {
  try {
    elements.timestamp.textContent = getCurrentTime();
    elements.date.textContent = getCurrentDate();
    updateMotorStatus(data);
    updatePowerMetrics(data);
    updateProtectionSummary(data);
    updateTemperature(data);
    updateVibration(data);
    updateFaults(data);
    updateDataLog(data);
    relayDataToRailway(data);
    setConnectionStatus(true);
  } catch (err) {
    console.error('Error updating dashboard:', err);
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchSensorData() {
  if (sensorFetchInFlight) return;
  sensorFetchInFlight = true;
  try {
    const response = await fetch(CONFIG.dataEndpoint);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    // Skip full redraw if nothing meaningful changed
    const sig = getDataSignature(data);
    if (sig !== lastDataSignature) {
      lastDataSignature = sig;
      updateDashboard(data);
    } else {
      // Still update clock even when data unchanged
      elements.timestamp.textContent = getCurrentTime();
      setConnectionStatus(true);
    }
  } catch (err) {
    if (!hasShownLocalhostHint &&
      (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')) {
      hasShownLocalhostHint = true;
      if (elements.statusText) elements.statusText.textContent = 'Open ESP IP, not localhost';
    }
    setConnectionStatus(false);
    updateTemperature({});
  } finally {
    sensorFetchInFlight = false;
  }
}

// ── Ambient temperature ───────────────────────────────────────────────────────
async function fetchAmbientTemperature() {
  if (ambientFetchInFlight) return;
  ambientFetchInFlight = true;
  try {
    const locationConfig = getAmbientLocationConfig();
    let lat, lon;

    if (locationConfig.mode === 'manual') {
      if (!locationConfig.city || !locationConfig.state) {
        ambientTempFromAPI = null; locationName = 'Manual location not set'; return;
      }
      const q = encodeURIComponent(`${locationConfig.city}, ${locationConfig.state}`);
      const geo = await fetchJsonWithTimeout(`https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=3&language=en&format=json`);
      const results = Array.isArray(geo?.results) ? geo.results : [];
      const wantedState = locationConfig.state.trim().toLowerCase();
      const best = results.find(r => String(r?.admin1 || '').trim().toLowerCase() === wantedState) || results[0];
      if (!best) throw new Error('No matching location found');
      lat = best.latitude; lon = best.longitude;
      locationName = `${best.name}, ${best.admin1 || locationConfig.state} (Manual)`;
    } else {
      let detected = null;
      try {
        if (!navigator.geolocation) throw new Error('no geolocation');
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false, timeout: 6000, maximumAge: 120000 })
        );
        detected = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, city: null, region: null, source: 'gps' };
      } catch (_) {
        try {
          const d = await fetchJsonWithTimeout('https://ipapi.co/json/');
          detected = { latitude: Number(d.latitude), longitude: Number(d.longitude), city: d.city, region: d.region, source: 'ipapi' };
        } catch (_) {
          const d = await fetchJsonWithTimeout('https://ipwho.is/');
          if (!d || d.success === false) throw new Error('ipwho.is failed');
          detected = { latitude: Number(d.latitude), longitude: Number(d.longitude), city: d.city, region: d.region, source: 'ipwho' };
        }
      }
      lat = detected.latitude; lon = detected.longitude;
      locationName = detected.source === 'gps'
        ? 'Device GPS (Auto)'
        : `${detected.city || 'Unknown'}, ${detected.region || 'Unknown'} (Auto)`;
      localStorage.setItem(AMBIENT_AUTO_LOCATION_KEY, locationName);
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Invalid coordinates');

    const weather = await fetchJsonWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&current_weather=true&t=${Date.now()}`
    );
    const wt = weather?.current?.temperature_2m ?? weather?.current_weather?.temperature;
    ambientTempFromAPI = Number.isFinite(Number(wt)) ? Number(wt) : null;
    if (Number.isFinite(ambientTempFromAPI)) saveAmbientCache(ambientTempFromAPI, locationName);

  } catch (err) {
    console.error('Ambient temp failed:', err);
    if (!Number.isFinite(ambientTempFromAPI)) {
      const cache = loadAmbientCache();
      if (cache) { ambientTempFromAPI = cache.temperature; if (!locationName) locationName = cache.location; }
    }
    if (!locationName) locationName = 'Location unavailable';
  } finally {
    updateTemperature({});
    ambientFetchInFlight = false;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  initializeTheme();
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  setupFaultActionHandlers();
  setupMotorControlButton();

  elements.date.textContent = getCurrentDate();
  elements.timestamp.textContent = getCurrentTime();

  // Load cached ambient so "--" never flashes on page load
  const cache = loadAmbientCache();
  if (cache) {
    ambientTempFromAPI = cache.temperature;
    if (!locationName && cache.location) locationName = cache.location;
    updateTemperature({});
  }

  // First data fetch immediately
  //fetchSensorData();
  setTimeout(fetchSensorData, 500);

  // Poll every 2s (was 1s)
  setInterval(fetchSensorData, CONFIG.updateInterval);

  // Defer ambient fetch 5s so dashboard renders first
  setTimeout(fetchAmbientTemperature, 5000);
  setInterval(fetchAmbientTemperature, 300000);

  document.addEventListener('visibilitychange', () => { if (!document.hidden) fetchAmbientTemperature(); });
  window.addEventListener('focus', fetchAmbientTemperature);
  window.addEventListener('storage', e => {
    if (e.key === MAINTENANCE_CONFIG_KEY || e.key === AMBIENT_LOCATION_UPDATED_AT_KEY) fetchAmbientTemperature();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}