// Configuration
const CONFIG = {
  dataEndpoint: '/data',
  faultAcknowledgeEndpoint: '/faults/ack',
  updateInterval: 1000, // 1 second
  maxLogEntries: 10
};
const MAINTENANCE_CONFIG_KEY = 'maintenanceConfig';
const AMBIENT_AUTO_LOCATION_KEY = 'ambientAutoLocationLabel';
const AMBIENT_LOCATION_UPDATED_AT_KEY = 'ambientLocationUpdatedAt';
const AMBIENT_CACHE_KEY = 'ambientTempCache';
const RAILWAY_RELAY_CONFIG_KEY = 'railwayRelayConfig';
const THEME_KEY = 'appTheme';

// Theme Management
function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  setTheme(savedTheme);
}

function setTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }
  localStorage.setItem(THEME_KEY, theme);
  updateThemeButtonIcon();
}

function toggleTheme() {
  const isDarkMode = !document.body.classList.contains('light-theme');
  setTheme(isDarkMode ? 'light' : 'dark');
}

function updateThemeButtonIcon() {
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    const isDarkMode = !document.body.classList.contains('light-theme');
    themeBtn.textContent = isDarkMode ? '\u{1F319}' : '\u2600\uFE0F';
  }
}

// State
let dataLog = [];
let isConnected = false;
let isFaultActionInProgress = false;
let isMotorRunning = false;
let isFaultResolvePending = false;
let faultResolveRequestedAtMs = 0;
const railwayRelayState = {
  inFlight: false,
  lastSentAtMs: 0,
  lastErrorAtMs: 0
};
const TREND_POINTS = 48;
const trendSeries = {
  voltage: [],
  current: [],
  power: [],
  rpm: [],
  temp1: []
};

// Global variables for ambient temperature
let ambientTempFromAPI = null;
let locationName = "";
let hasShownLocalhostHint = false;
let sensorFetchInFlight = false;
let ambientFetchInFlight = false;

function loadAmbientCache() {
  try {
    const raw = localStorage.getItem(AMBIENT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const temperature = Number(parsed.temperature);
    const location = String(parsed.location || '').trim();
    if (!Number.isFinite(temperature)) return null;
    return { temperature, location };
  } catch (_) {
    return null;
  }
}

function saveAmbientCache(temperature, location) {
  if (!Number.isFinite(temperature)) return;
  try {
    localStorage.setItem(
      AMBIENT_CACHE_KEY,
      JSON.stringify({
        temperature,
        location: String(location || '').trim(),
        savedAt: Date.now()
      })
    );
  } catch (_) {}
}

function fetchJsonWithTimeout(url, timeoutMs = 8000) {
  // [INFO] Shared network helper for weather/geolocation APIs.
  // [WARN] Aborts slow requests so UI doesn't hang waiting on external services.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      return response.json();
    })
    .finally(() => clearTimeout(timeoutId));
}

function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  // [INFO] Generic timeout wrapper for local ESP endpoints.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const mergedOptions = { ...options, signal: controller.signal };
  return fetch(url, mergedOptions).finally(() => clearTimeout(timeoutId));
}

function getAmbientFromEsp(temp) {
  // [INFO] Ambient fallback from ESP payload when cloud weather is unavailable.
  const espAmbient = Number(
    temp?.t2 ?? temp?.sensor2 ?? temp?.ambient ?? temp?.room ?? Number.NaN
  );
  return Number.isFinite(espAmbient) ? espAmbient : null;
}

// DOM Elements
const elements = {
  // Status
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  timestamp: document.getElementById('timestamp'),
  date: document.getElementById('date'),   

  // Motor
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
  
  // Power
  voltage: document.getElementById('voltage'),
  voltageBar: document.getElementById('voltageBar'),
  current: document.getElementById('current'),
  currentBar: document.getElementById('currentBar'),
  power: document.getElementById('power'),
  powerBar: document.getElementById('powerBar'),
  powerFactor: document.getElementById('powerFactor'),
  powerFactorBar: document.getElementById('powerFactorBar'),
  energy: document.getElementById('energy'),
  frequency: document.getElementById('frequency'),
  protectionOvUv: document.getElementById('protectionOvUv'),
  protectionCurrentTemp: document.getElementById('protectionCurrentTemp'),
  
  // Temperature
  temp1: document.getElementById('temp1'),
  temp1Bar: document.getElementById('temp1Bar'),
  temp2: document.getElementById('temp2'),
  temp2Bar: document.getElementById('temp2Bar'),
  ambientLocationLabel: document.getElementById('ambientLocationLabel'),
  
  // Vibration
  accelX: document.getElementById('accelX'),
  accelY: document.getElementById('accelY'),
  accelZ: document.getElementById('accelZ'),
  vibrationMagnitude: document.getElementById('vibrationMagnitude'),
  tapValue: document.getElementById('tapValue'),
  
  // Faults
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

  // Log
  logBody: document.getElementById('logBody'),

  // Trends
  trendVoltage: document.getElementById('trendVoltage'),
  trendCurrent: document.getElementById('trendCurrent'),
  trendPower: document.getElementById('trendPower'),
  trendRpm: document.getElementById('trendRpm'),
  trendTemp1: document.getElementById('trendTemp1')
};

// Fault update function
function updateFaults(data) {
  const faults = data.faults || {};
  const faultKeys = ['overcurrent', 'overtemp', 'stall', 'vibration', 'overvoltage', 'undervoltage'];
  const faultTitles = {
    overcurrent: 'Overcurrent',
    overtemp: 'Overtemp',
    stall: 'Stall',
    vibration: 'Vibration',
    overvoltage: 'Overvoltage',
    undervoltage: 'Undervoltage'
  };

  function normalizeFaultState(rawFaultValue) {
    if (typeof rawFaultValue === 'boolean') {
      return {
        active: rawFaultValue,
        latched: rawFaultValue,
        ackRequired: rawFaultValue
      };
    }
    if (rawFaultValue && typeof rawFaultValue === 'object') {
      const isActive = rawFaultValue.active === true || rawFaultValue.fault === true;
      const isLatched = rawFaultValue.latched === true || rawFaultValue.latch === true || isActive;
      const requiresAck = rawFaultValue.ackRequired === true || rawFaultValue.ack_required === true || isLatched;
      return {
        active: isActive,
        latched: isLatched,
        ackRequired: requiresAck
      };
    }
    return {
      active: false,
      latched: false,
      ackRequired: false
    };
  }

  function renderFaultBadge(key, state) {
    const badgeElement = elements[`fault_${key}`];
    const actionElement = elements[`fault_${key}_action`];
    if (badgeElement) {
      const hasFault = state.active || state.latched;
      badgeElement.className = hasFault ? 'badge badge-on' : 'badge badge-off';
      if (state.active) {
        badgeElement.textContent = 'ACTIVE';
      } else if (state.latched) {
        badgeElement.textContent = 'LATCHED';
      } else {
        badgeElement.textContent = 'OK';
      }
    }
    if (actionElement) {
      const canResolve = state.latched || state.ackRequired;
      actionElement.hidden = !canResolve;
      actionElement.disabled = isFaultActionInProgress;
      actionElement.dataset.faultKey = key;
    }
  }

  const pendingFaultNames = [];
  const resolvableFaultKeys = [];

  faultKeys.forEach((key) => {
    const state = normalizeFaultState(faults[key]);
    renderFaultBadge(key, state);

    if (state.active || state.latched) {
      pendingFaultNames.push(faultTitles[key]);
    }
    if (state.latched || state.ackRequired) {
      resolvableFaultKeys.push(key);
    }
  });

  if (elements.faultAlert) {
    elements.faultAlert.hidden = pendingFaultNames.length === 0;
  }
  if (elements.faultAlertText) {
    elements.faultAlertText.textContent =
      pendingFaultNames.length === 0
        ? 'No active faults.'
        : `Attention required: ${pendingFaultNames.join(', ')}`;
  }
  if (elements.resolveAllFaultsBtn) {
    elements.resolveAllFaultsBtn.disabled = isFaultActionInProgress || resolvableFaultKeys.length === 0;
    elements.resolveAllFaultsBtn.dataset.faultKeys = JSON.stringify(resolvableFaultKeys);
  }

  // Resolve flow feedback:
  // - clear waiting text when ESP reports no remaining faults
  // - if still faulted after timeout, show guidance instead of waiting forever
  if (isFaultResolvePending) {
    if (pendingFaultNames.length === 0) {
      setFaultActionStatus('Faults resolved and acknowledged by ESP.', false);
      isFaultResolvePending = false;
      setTimeout(() => setFaultActionStatus('', false), 2500);
    } else if ((Date.now() - faultResolveRequestedAtMs) > 6000) {
      setFaultActionStatus('Fault still active. Remove root cause, then resolve again.', true);
      isFaultResolvePending = false;
    }
  } else if (pendingFaultNames.length === 0 && elements.faultActionStatus?.textContent) {
    const statusText = elements.faultActionStatus.textContent.toLowerCase();
    if (statusText.includes('waiting for esp confirmation')) {
      setFaultActionStatus('', false);
    }
  }
}

// Utility Functions
function getCurrentTime() {
  const now = new Date();
  return now.getHours().toString().padStart(2, '0') + ':' +
         now.getMinutes().toString().padStart(2, '0');
}

function getCurrentDate() {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

function setConnectionStatus(connected) {
  isConnected = connected;
  elements.statusDot.className = connected ? 'status-dot connected' : 'status-dot error';
  elements.statusText.textContent = connected ? 'Connected' : 'Disconnected';
}

function updateProgressBar(element, value, max, color) {
  if (!element) return;  // ADD THIS
  const percentage = Math.min(100, (value / max) * 100);
  element.style.width = percentage.toFixed(0) + '%';
  element.style.background = color;
}

function formatUptime(uptimeValue) {
  if (uptimeValue === undefined || uptimeValue === null || uptimeValue === '') {
    return '--';
  }

  const valueAsNumber = Number(uptimeValue);
  if (Number.isFinite(valueAsNumber)) {
    const totalSeconds = Math.max(0, Math.floor(valueAsNumber));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  return String(uptimeValue);
}

function getFirstDefined(...values) {
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] !== undefined && values[i] !== null && values[i] !== '') {
      return values[i];
    }
  }
  return null;
}

function formatDisplayValue(value) {
  if (value === undefined || value === null || value === '') {
    return '--';
  }
  return String(value);
}

function parseDateValue(dateValue) {
  if (!dateValue) return null;
  const normalized = String(dateValue).replace(' ', 'T');
  const parsedDate = new Date(normalized);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatDateValue(dateValue) {
  const parsedDate = parseDateValue(dateValue);
  if (!parsedDate) {
    return formatDisplayValue(dateValue);
  }
  return parsedDate.toLocaleString();
}

function loadMaintenanceConfig() {
  try {
    const rawConfig = localStorage.getItem(MAINTENANCE_CONFIG_KEY);
    if (!rawConfig) {
      return {};
    }
    const parsedConfig = JSON.parse(rawConfig);
    return parsedConfig && typeof parsedConfig === 'object' ? parsedConfig : {};
  } catch (error) {
    console.warn('Unable to read maintenance config:', error);
    return {};
  }
}

function loadRailwayRelayConfig() {
  try {
    const rawConfig = localStorage.getItem(RAILWAY_RELAY_CONFIG_KEY);
    if (!rawConfig) {
      return null;
    }
    const parsed = JSON.parse(rawConfig);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return {
      enabled: parsed.enabled === true,
      endpoint: String(parsed.endpoint || '').trim(),
      apiKey: String(parsed.apiKey || '').trim(),
      deviceId: String(parsed.deviceId || 'esp32-motor-01').trim() || 'esp32-motor-01',
      intervalSeconds: Math.max(2, Math.min(3600, Number(parsed.intervalSeconds) || 10)),
      relayMode: String(parsed.relayMode || 'esp32')
    };
  } catch (error) {
    console.warn('Unable to read Railway relay config:', error);
    return null;
  }
}

function getAmbientLocationConfig() {
  const config = loadMaintenanceConfig();
  const mode = config.ambientLocationMode || 'auto';
  const state = String(config.ambientState || '').trim();
  const city = String(config.ambientCity || '').trim();
  return { mode, state, city };
}

function getFirstNumber(...values) {
  for (let i = 0; i < values.length; i += 1) {
    const asNumber = Number(values[i]);
    if (Number.isFinite(asNumber)) {
      return asNumber;
    }
  }
  return null;
}

function formatRemainingFromTotal(totalSeconds, uptimeSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0 || !Number.isFinite(uptimeSeconds)) {
    return '--';
  }

  const safeUptime = Math.max(0, uptimeSeconds);
  const remainingSeconds = Math.max(0, totalSeconds - safeUptime);
  const percentage = (remainingSeconds / totalSeconds) * 100;

  return `${formatUptime(remainingSeconds)} (${percentage.toFixed(1)}%)`;
}

function setFaultActionStatus(message, isError) {
  if (!elements.faultActionStatus) return;
  elements.faultActionStatus.textContent = message || '';
  elements.faultActionStatus.className = isError === true ? 'fault-action-status error' : 'fault-action-status';
}

async function acknowledgeFaults(faultKeys) {
  if (!Array.isArray(faultKeys) || faultKeys.length === 0 || isFaultActionInProgress) {
    return;
  }

  try {
    isFaultActionInProgress = true;
    setFaultActionStatus('Sending resolve request...', false);
    const response = await fetchWithTimeout(CONFIG.faultAcknowledgeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        faults: faultKeys
      })
    }, 5000);

    console.info('Fault resolve response status:', response.status);

    if (!response.ok) {
      throw new Error(`Fault acknowledge failed (${response.status})`);
    }

    isFaultResolvePending = true;
    faultResolveRequestedAtMs = Date.now();
    setFaultActionStatus('Resolve request sent. Waiting for ESP confirmation...', false);
    await fetchSensorData();
  } catch (error) {
    console.error('Fault resolve request failed:', error);
    isFaultResolvePending = false;
    setFaultActionStatus('Failed to send resolve request. Check ESP endpoint /faults/ack.', true);
  } finally {
    isFaultActionInProgress = false;
  }
}

function setupFaultActionHandlers() {
  const actionButtons = [
    elements.fault_overcurrent_action,
    elements.fault_overtemp_action,
    elements.fault_stall_action,
    elements.fault_vibration_action,
    elements.fault_overvoltage_action,
    elements.fault_undervoltage_action
  ];

  actionButtons.forEach((button) => {
    if (!button) return;
    button.addEventListener('click', async () => {
      const faultKey = button.dataset.faultKey;
      if (!faultKey) return;
      await acknowledgeFaults([faultKey]);
    });
  });

  if (elements.resolveAllFaultsBtn) {
    elements.resolveAllFaultsBtn.addEventListener('click', async () => {
      const serializedKeys = elements.resolveAllFaultsBtn.dataset.faultKeys;
      if (!serializedKeys) return;

      let faultKeys = [];
      try {
        faultKeys = JSON.parse(serializedKeys);
      } catch (error) {
        console.error('Invalid resolve-all fault list:', error);
      }
      await acknowledgeFaults(faultKeys);
    });
  }
}

// Update Functions
function updateMotorStatus(data) {
  const motor = data.motor || {};
  const isRunning = motor.running === true;
  isMotorRunning = isRunning;

  // Update motor indicator
  elements.motorIndicator.className = 'motor-indicator ' + (isRunning ? 'on' : 'off');
  elements.motorDot.className = 'motor-dot ' + (isRunning ? 'on' : 'off');
  elements.motorLabel.textContent = isRunning ? 'Running' : 'Stopped';
  updateMotorControlButton();
  
  // Update RPM and pulse
  elements.rpm.textContent = motor.rpm || 0;
  elements.pulse.textContent = motor.pulse || 0;

  // Additional ESP32 fields
  const savedMaintenanceConfig = loadMaintenanceConfig();
  const uptime = data.uptime ?? motor.uptime;
  const maintenance = data.maintenance || motor.maintenance || {};
  const nextMaintenance = getFirstDefined(
    data.nextMaintenanceTime,
    data.next_maintenance_time,
    data.nextMaintenance,
    data.next_maintenance,
    motor.nextMaintenanceTime,
    motor.next_maintenance_time,
    motor.nextMaintenance,
    maintenance.nextMaintenanceTime,
    maintenance.next_maintenance_time,
    maintenance.nextMaintenance,
    savedMaintenanceConfig.nextMaintenanceTime
  );
  let remainingLifeCycle = getFirstDefined(
    data.remainingLifeCycle,
    data.remaining_life_cycle,
    data.remainingLifecycle,
    motor.remainingLifeCycle,
    motor.remaining_life_cycle,
    motor.remainingLifecycle,
    maintenance.remainingLifeCycle,
    maintenance.remaining_life_cycle,
    maintenance.remainingLifecycle
  );
  const maintenanceHoursLimit = getFirstNumber(
    data.maintenanceHoursLimit,
    data.maintenance_hours_limit,
    motor.maintenanceHoursLimit,
    motor.maintenance_hours_limit,
    maintenance.maintenanceHoursLimit,
    maintenance.maintenance_hours_limit,
    savedMaintenanceConfig.maintenanceHoursLimit
  );

  if (remainingLifeCycle === null) {
    const totalLifeHours = getFirstNumber(
      data.totalLifeCycleHours,
      data.total_life_cycle_hours,
      motor.totalLifeCycleHours,
      motor.total_life_cycle_hours,
      maintenance.totalLifeCycleHours,
      maintenance.total_life_cycle_hours,
      savedMaintenanceConfig.totalLifeCycleHours
    );
    const totalLifeSeconds = getFirstNumber(
      data.totalLifeCycleSeconds,
      data.total_life_cycle_seconds,
      motor.totalLifeCycleSeconds,
      motor.total_life_cycle_seconds,
      maintenance.totalLifeCycleSeconds,
      maintenance.total_life_cycle_seconds,
      Number.isFinite(totalLifeHours) ? totalLifeHours * 3600 : null
    );
    const uptimeSeconds = getFirstNumber(uptime);
    remainingLifeCycle = formatRemainingFromTotal(totalLifeSeconds, uptimeSeconds);
  }

  const uptimeSeconds = getFirstNumber(uptime);
  const maintenanceLimitSeconds = Number.isFinite(maintenanceHoursLimit) ? maintenanceHoursLimit * 3600 : null;
  const remainingToMaintenanceSeconds =
    Number.isFinite(maintenanceLimitSeconds) && Number.isFinite(uptimeSeconds)
      ? Math.max(0, maintenanceLimitSeconds - uptimeSeconds)
      : null;
  const dueByHours =
    Number.isFinite(maintenanceLimitSeconds) && Number.isFinite(uptimeSeconds)
      ? uptimeSeconds >= maintenanceLimitSeconds
      : null;
  const nextMaintenanceDate = parseDateValue(nextMaintenance);
  const dueByDate = nextMaintenanceDate ? Date.now() >= nextMaintenanceDate.getTime() : null;
  const maintenanceDue = dueByHours === true || dueByDate === true;

  if (elements.uptimeValue) {
    elements.uptimeValue.textContent = formatUptime(uptime);
  }
  if (elements.nextMaintenanceValue) {
    elements.nextMaintenanceValue.textContent = formatDateValue(nextMaintenance);
  }
  if (elements.dueByHoursValue) {
    elements.dueByHoursValue.textContent =
      remainingToMaintenanceSeconds === null ? '--' : formatUptime(remainingToMaintenanceSeconds);
  }
  if (elements.dueByDateValue) {
    elements.dueByDateValue.textContent = dueByDate === null ? '--' : dueByDate ? 'Due' : 'Not due';
  }
  if (elements.maintenanceStatusValue) {
    elements.maintenanceStatusValue.textContent =
      dueByHours === null && dueByDate === null ? '--' : maintenanceDue ? 'Maintenance Due' : 'OK';
  }
  if (elements.remainingLifeCycleValue) {
    elements.remainingLifeCycleValue.textContent = formatDisplayValue(remainingLifeCycle);
  }
}

// Power metrics update

function updatePowerMetrics(data) {
  const power = data.power || {};
  
  // Voltage
  const voltage = parseFloat(power.voltage || 0);
  elements.voltage.innerHTML = voltage.toFixed(1) + '<span class="card-unit">V</span>';
  updateProgressBar(elements.voltageBar, voltage, 250, '#378ADD');
  
  // Current
  const current = parseFloat(power.current || 0);
  elements.current.innerHTML = current.toFixed(2) + '<span class="card-unit">A</span>';
  updateProgressBar(elements.currentBar, current, 10, '#EF9F27');
  
  // Power
  const activePower = Math.round(power.power || 0);
  elements.power.innerHTML = activePower + '<span class="card-unit">W</span>';
  updateProgressBar(elements.powerBar, activePower, 2000, '#D85A30');

  const pf = parseFloat(power.powerFactor || 0).toFixed(2);
  elements.powerFactor.textContent = pf;
  updateProgressBar(elements.powerFactorBar, pf, 1, '#1D9E75');

  const energy = parseFloat(power.energy || 0).toFixed(2);
  elements.energy.innerHTML = energy + '<span class="card-unit">kWh</span>';

  const freq = parseFloat(power.frequency || 0).toFixed(1);
  elements.frequency.innerHTML = freq + '<span class="card-unit">Hz</span>';
}

function updateProtectionSummary(data) {
  if (!elements.protectionOvUv || !elements.protectionCurrentTemp) return;

  const protection = data.protection || {};
  const ov = Number(protection.overvoltageV);
  const uv = Number(protection.undervoltageV);
  const maxCurrent = Number(protection.maxCurrentA);
  const maxTemp = Number(protection.maxTempC);

  const ovText = Number.isFinite(ov) ? ov.toFixed(1) : '--';
  const uvText = Number.isFinite(uv) ? uv.toFixed(1) : '--';
  const currentText = Number.isFinite(maxCurrent) ? maxCurrent.toFixed(1) : '--';
  const tempText = Number.isFinite(maxTemp) ? maxTemp.toFixed(1) : '--';

  elements.protectionOvUv.textContent = `OV ${ovText}V / UV ${uvText}V`;
  elements.protectionCurrentTemp.textContent = `I ${currentText}A | T ${tempText}C`;
}
function updateTemperature(data) {
  // [WARN] This function can run on pages that don't contain temp cards.
  // Guard early to avoid null element crashes.
  if (!elements.temp1 || !elements.temp1Bar || !elements.temp2 || !elements.temp2Bar) {
    return;
  }

  const temp = data.temperature || data.temp || {};

  // Temperature 1 (Motor)
  const t1 = parseFloat(temp.t1 || temp.sensor1 || temp.motor || 0);
  elements.temp1.innerHTML = t1.toFixed(1) + '<span class="card-unit">°C</span>';
  updateProgressBar(elements.temp1Bar, t1, 100, '#D85A30');

  // Temperature 2 (Ambient) - API first, ESP sensor fallback
  const espAmbient = getAmbientFromEsp(temp);
  if (Number.isFinite(ambientTempFromAPI)) {
    // [INFO] Preferred source: remote weather API.
    elements.temp2.innerHTML = ambientTempFromAPI.toFixed(1) + '<span class="card-unit">°C</span>';
    updateProgressBar(elements.temp2Bar, ambientTempFromAPI, 50, '#378ADD');
  } else if (Number.isFinite(espAmbient)) {
    // [WARN] Fallback source: ESP temp2 if API failed/unavailable.
    elements.temp2.innerHTML = espAmbient.toFixed(1) + '<span class="card-unit">°C</span>';
    updateProgressBar(elements.temp2Bar, espAmbient, 50, '#378ADD');
  } else {
    // [ERROR] No valid ambient source available.
    elements.temp2.innerHTML = '--<span class="card-unit">°C</span>';
    updateProgressBar(elements.temp2Bar, 0, 50, '#378ADD');
  }

  if (elements.ambientLocationLabel) {
    if (locationName) {
      elements.ambientLocationLabel.textContent = `Location: ${locationName}`;
    } else if (Number.isFinite(espAmbient)) {
      elements.ambientLocationLabel.textContent = 'Location: ESP sensor fallback';
    } else {
      elements.ambientLocationLabel.textContent = 'Location: Detecting...';
    }
  }
}
// Vibration update
function updateVibration(data) {
  const vibration = data.vibration || {};
  
  const x = parseFloat(vibration.x || 0);
  const y = parseFloat(vibration.y || 0);
  const z = parseFloat(vibration.z || 0);

  elements.accelX.textContent = x.toFixed(2);
  elements.accelY.textContent = y.toFixed(2);
  elements.accelZ.textContent = z.toFixed(2);

  const magnitude = Math.sqrt(x * x + y * y + z * z);
  if (elements.vibrationMagnitude) {
    elements.vibrationMagnitude.textContent = magnitude.toFixed(2);
  }
  const tapDetected = vibration.tap || false;
  elements.tapValue.textContent = tapDetected ? 'Yes' : 'No';
}

// Data log update
function updateDataLog(data) {
  if (!elements.logBody) {
    return;
  }

  const power = data.power || {};
  const temp = data.temperature || data.temp || {};
  const motor = data.motor || {};
  
  // Create log entry
  const logEntry = {
    time: getCurrentTime(),
    voltage: parseFloat(power.voltage || power.v || 0).toFixed(1),
    current: parseFloat(power.current || power.a || 0).toFixed(2),
    power: Math.round(power.power || power.w || 0),
    temp1: parseFloat(temp.t1 || temp.sensor1 || temp.motor || 0).toFixed(1),
    temp2: (() => {
      if (Number.isFinite(ambientTempFromAPI)) return ambientTempFromAPI.toFixed(1);
      const espAmbient = getAmbientFromEsp(temp);
      return Number.isFinite(espAmbient) ? espAmbient.toFixed(1) : '--';
    })(),
    rpm: motor.rpm || 0
  };
  
  // Add to log (newest first)
  dataLog.unshift(logEntry);
  
  // Keep only last N entries
  if (dataLog.length > CONFIG.maxLogEntries) {
    dataLog = dataLog.slice(0, CONFIG.maxLogEntries);
  }
  
  // Render log table
  elements.logBody.innerHTML = dataLog.map(entry => `
    <tr>
      <td>${entry.time}</td>
      <td>${entry.voltage}</td>
      <td>${entry.current}</td>
      <td>${entry.power}</td>
      <td>${entry.temp1}</td>
      <td>${entry.temp2}</td>
      <td>${entry.rpm}</td>
    </tr>
  `).join('');
}

function pushTrendPoint(seriesKey, value) {
  if (!Object.prototype.hasOwnProperty.call(trendSeries, seriesKey)) return;

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return;

  trendSeries[seriesKey].push(numericValue);
  if (trendSeries[seriesKey].length > TREND_POINTS) {
    trendSeries[seriesKey] = trendSeries[seriesKey].slice(-TREND_POINTS);
  }
}

function resizeTrendCanvas(canvas) {
  if (!canvas) return null;

  const dpr = window.devicePixelRatio || 1;
  const displayWidth = Math.max(10, Math.floor(canvas.clientWidth));
  const displayHeight = Math.max(10, Math.floor(canvas.clientHeight));
  const targetWidth = Math.floor(displayWidth * dpr);
  const targetHeight = Math.floor(displayHeight * dpr);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  return { ctx, width: displayWidth, height: displayHeight };
}

function drawTrend(canvas, series, strokeColor, fillColor) {
  if (!canvas || !Array.isArray(series)) return;
  const resized = resizeTrendCanvas(canvas);
  if (!resized) return;

  const { ctx, width, height } = resized;
  const padLeft = 8;
  const padRight = 6;
  const padTop = 8;
  const padBottom = 10;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  ctx.clearRect(0, 0, width, height);

  // subtle horizontal guides
  ctx.strokeStyle = 'rgba(140, 182, 222, 0.2)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i += 1) {
    const y = padTop + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(width - padRight, y);
    ctx.stroke();
  }

  if (series.length === 0) return;

  const minValue = Math.min(...series);
  const maxValue = Math.max(...series);
  const range = maxValue - minValue;
  const hasVariation = range > 0.0001;

  const points = series.map((value, index) => {
    const x = padLeft + (index / Math.max(1, series.length - 1)) * chartWidth;
    const y = hasVariation
      ? padTop + ((maxValue - value) / range) * chartHeight
      : padTop + chartHeight / 2;
    return { x, y };
  });

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.lineWidth = 2;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.lineTo(points[points.length - 1].x, height - padBottom);
  ctx.lineTo(points[0].x, height - padBottom);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
}

function renderTrendCharts() {
  drawTrend(elements.trendVoltage, trendSeries.voltage, '#62b3ff', 'rgba(98, 179, 255, 0.16)');
  drawTrend(elements.trendCurrent, trendSeries.current, '#ffd166', 'rgba(255, 209, 102, 0.16)');
  drawTrend(elements.trendPower, trendSeries.power, '#ff8a80', 'rgba(255, 138, 128, 0.16)');
  drawTrend(elements.trendRpm, trendSeries.rpm, '#7be6bf', 'rgba(123, 230, 191, 0.16)');
  drawTrend(elements.trendTemp1, trendSeries.temp1, '#ffb36b', 'rgba(255, 179, 107, 0.16)');
}

function updateTrendSeries(data) {
  const power = data.power || {};
  const temp = data.temperature || data.temp || {};
  const motor = data.motor || {};

  pushTrendPoint('voltage', power.voltage || power.v || 0);
  pushTrendPoint('current', power.current || power.a || 0);
  pushTrendPoint('power', power.power || power.w || 0);
  pushTrendPoint('rpm', motor.rpm || 0);
  pushTrendPoint('temp1', temp.t1 || temp.sensor1 || temp.motor || 0);
  renderTrendCharts();
}

function setupTrendCharts() {
  renderTrendCharts();
  window.addEventListener('resize', renderTrendCharts);
}

function updateMotorControlButton() {
  const button = document.getElementById('stopMotorBtn');
  if (!button) return;

  if (isMotorRunning) {
    button.textContent = 'STOP';
    button.classList.remove('start-btn-ribbon');
    button.classList.add('stop-btn-ribbon');
    button.title = 'Stop motor';
  } else {
    button.textContent = 'START';
    button.classList.remove('stop-btn-ribbon');
    button.classList.add('start-btn-ribbon');
    button.title = 'Start motor';
  }
}

function setupMotorControlButton() {
  const button = document.getElementById('stopMotorBtn');
  if (!button) return;

  updateMotorControlButton();
  button.addEventListener('click', async () => {
    const shouldStart = !isMotorRunning;
    const endpoint = shouldStart ? '/motor/start' : '/motor/stop';
    const pendingLabel = shouldStart ? 'Starting...' : 'Stopping...';
    const errorLabel = shouldStart
      ? 'Failed to start motor. Resolve active faults first.'
      : 'Failed to stop motor. Check if ESP32 is connected.';

    try {
      button.disabled = true;
      button.textContent = pendingLabel;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Motor control failed (${response.status})`);
      }

      await fetchSensorData();
    } catch (error) {
      console.error('Error controlling motor:', error);
      alert(errorLabel);
    } finally {
      button.disabled = false;
      updateMotorControlButton();
    }
  });
}

async function relayDataToRailway(data) {
  const relayConfig = loadRailwayRelayConfig();
  if (!relayConfig || relayConfig.enabled !== true || !relayConfig.endpoint) {
    return;
  }
  // Avoid duplicate uploads when ESP32 firmware relay is enabled.
  if (relayConfig.relayMode !== 'browser') {
    return;
  }

  const nowMs = Date.now();
  const intervalMs = relayConfig.intervalSeconds * 1000;
  if (railwayRelayState.inFlight) {
    return;
  }
  if ((nowMs - railwayRelayState.lastSentAtMs) < intervalMs) {
    return;
  }

  railwayRelayState.inFlight = true;
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (relayConfig.apiKey) {
      headers['x-api-key'] = relayConfig.apiKey;
      headers.Authorization = `Bearer ${relayConfig.apiKey}`;
    }

    const payload = {
      source: 'esp32-dashboard',
      deviceId: relayConfig.deviceId,
      timestamp: new Date().toISOString(),
      data
    };

    const response = await fetch(relayConfig.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Railway relay failed (${response.status})`);
    }

    railwayRelayState.lastSentAtMs = Date.now();
  } catch (error) {
    const now = Date.now();
    if ((now - railwayRelayState.lastErrorAtMs) > 30000) {
      console.warn('Railway relay error:', error);
      railwayRelayState.lastErrorAtMs = now;
    }
  } finally {
    railwayRelayState.inFlight = false;
  }
}

// Main Update Function
function updateDashboard(data) {
  try {
    // Update timestamp
    elements.timestamp.textContent = getCurrentTime();
    elements.date.textContent = getCurrentDate();

    // Update all sections
    updateMotorStatus(data);
    updatePowerMetrics(data);
    updateProtectionSummary(data);
    updateTemperature(data);
    updateVibration(data);
    updateFaults(data);
    updateDataLog(data);
    updateTrendSeries(data);
    relayDataToRailway(data);
    
    // Set connected status
    setConnectionStatus(true);
  } catch (error) {
    console.error('Error updating dashboard:', error);
  }
}

// Fetch Data from ESP32
async function fetchSensorData() {
  if (sensorFetchInFlight) return;
  sensorFetchInFlight = true;
  try {
    // [INFO] Primary telemetry poll from ESP32 HTTP server.
    const response = await fetch(CONFIG.dataEndpoint);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    updateDashboard(data);
    
  } catch (error) {
    // [ERROR] Dashboard data fetch failed.
    console.error('Failed to fetch sensor data:', error);
    if (
      !hasShownLocalhostHint &&
      (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    ) {
      // [WARN] Localhost serves static files only; ESP endpoints are not present there.
      hasShownLocalhostHint = true;
      console.warn('You are opening dashboard on localhost. Open ESP32 IP (for example http://192.168.x.x/) to read /data.');
      if (elements.statusText) {
        elements.statusText.textContent = 'Open ESP IP, not localhost';
      }
    }
    setConnectionStatus(false);
    // Keep ambient weather section reactive even when ESP data is offline.
    updateTemperature({});
  } finally {
    sensorFetchInFlight = false;
  }
}

// Initialize
function init() {
  console.log('ESP32 Dashboard initialized');
  
  // Initialize theme
  initializeTheme();
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
  }
  
  setupFaultActionHandlers();
  setupTrendCharts();
  setupMotorControlButton();
  
  // Initial fetch
  fetchSensorData();
  
  // Set up periodic updates
  setInterval(fetchSensorData, CONFIG.updateInterval);

  // Date display
  elements.date.textContent = getCurrentDate();

  // timestamp display
  elements.timestamp.textContent = getCurrentTime();

  // Load last known ambient temperature so refresh doesn't show "--" immediately.
  const ambientCache = loadAmbientCache();
  if (ambientCache) {
    ambientTempFromAPI = ambientCache.temperature;
    if (!locationName && ambientCache.location) {
      locationName = ambientCache.location;
    }
    updateTemperature({});
  }

  // Fetch ambient temperature using Geolocation API
  fetchAmbientTemperature();
  setInterval(fetchAmbientTemperature, 300000); // update every 5 min

  // Refresh ambient temperature when user returns to the page
  // or when maintenance/location settings are changed in another tab/page.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      fetchAmbientTemperature();
    }
  });
  window.addEventListener('focus', fetchAmbientTemperature);
  window.addEventListener('storage', (event) => {
    if (event.key === MAINTENANCE_CONFIG_KEY || event.key === AMBIENT_LOCATION_UPDATED_AT_KEY) {
      fetchAmbientTemperature();
    }
  });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function fetchAmbientTemperature() {
  if (ambientFetchInFlight) return;
  ambientFetchInFlight = true;
  try {
    // [INFO] Resolve location and fetch ambient weather temperature.
    const locationConfig = getAmbientLocationConfig();
    let lat;
    let lon;
    let label = '';

    if (locationConfig.mode === 'manual') {
      if (!locationConfig.city || !locationConfig.state) {
        // [WARN] Manual mode selected but location fields are incomplete.
        ambientTempFromAPI = null;
        locationName = 'Manual location not set';
        return;
      }

      const query = encodeURIComponent(`${locationConfig.city}, ${locationConfig.state}`);
      const geoData = await fetchJsonWithTimeout(
        `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=3&language=en&format=json`
      );
      const results = Array.isArray(geoData?.results) ? geoData.results : [];
      const wantedState = String(locationConfig.state || '').trim().toLowerCase();
      let best = results.find((item) => String(item?.admin1 || '').trim().toLowerCase() === wantedState);
      if (!best) {
        best = results[0];
      }
      if (!best) {
        // [ERROR] Geocoder couldn't resolve chosen manual city/state.
        throw new Error('No matching location found for manual city/state');
      }

      lat = best.latitude;
      lon = best.longitude;
      label = `${best.name}, ${best.admin1 || locationConfig.state}`;
      locationName = `${label} (Manual)`;
    } else {
      // [INFO] Auto detect: browser geolocation -> IP lookup providers
      let detected = null;
      try {
        if (!navigator.geolocation) {
          throw new Error('Geolocation API unavailable');
        }
        const geolocation = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            (err) => reject(err),
            { enableHighAccuracy: false, timeout: 6000, maximumAge: 120000 }
          );
        });
        detected = {
          latitude: Number(geolocation.coords.latitude),
          longitude: Number(geolocation.coords.longitude),
          city: null,
          region: null,
          source: 'gps'
        };
      } catch (_) {
        // [WARN] GPS unavailable/blocked; fall back to IP-based lookup.
        try {
          const locData = await fetchJsonWithTimeout('https://ipapi.co/json/');
          detected = {
            latitude: Number(locData.latitude),
            longitude: Number(locData.longitude),
            city: locData.city,
            region: locData.region,
            source: 'ipapi'
          };
        } catch (_) {
          // [WARN] Primary IP provider failed; use secondary provider.
          const fallbackData = await fetchJsonWithTimeout('https://ipwho.is/');
          if (!fallbackData || fallbackData.success === false) {
            // [ERROR] All auto-location providers failed.
            throw new Error('ipwho.is lookup failed');
          }
          detected = {
            latitude: Number(fallbackData.latitude),
            longitude: Number(fallbackData.longitude),
            city: fallbackData.city,
            region: fallbackData.region,
            source: 'ipwho'
          };
        }
      }

      lat = detected.latitude;
      lon = detected.longitude;
      if (detected.source === 'gps') {
        label = 'Device GPS';
      } else {
        label = `${detected.city || 'Unknown city'}, ${detected.region || 'Unknown state'}`;
      }
      locationName = `${label} (Auto)`;
      localStorage.setItem(AMBIENT_AUTO_LOCATION_KEY, label);
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      // [ERROR] Location resolved, but coordinates are invalid.
      throw new Error('Invalid coordinates for weather lookup');
    }

    const weatherData = await fetchJsonWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&current_weather=true&t=${Date.now()}`
    );

    const weatherTemp = weatherData?.current?.temperature_2m ?? weatherData?.current_weather?.temperature;
    ambientTempFromAPI = Number.isFinite(Number(weatherTemp)) ? Number(weatherTemp) : null;
    if (Number.isFinite(ambientTempFromAPI)) {
      saveAmbientCache(ambientTempFromAPI, locationName);
    }

  } catch (err) {
    // [ERROR] Ambient weather pipeline failed; keep graceful fallbacks active.
    console.error('Ambient temp fetch failed:', err);
    if (!Number.isFinite(ambientTempFromAPI)) {
      const ambientCache = loadAmbientCache();
      if (ambientCache) {
        ambientTempFromAPI = ambientCache.temperature;
        if (!locationName && ambientCache.location) {
          locationName = ambientCache.location;
        }
      } else {
        ambientTempFromAPI = null;
      }
    }
    if (!locationName) {
      locationName = 'Location unavailable';
    }
  } finally {
    // Render ambient section immediately with latest API/fallback state.
    updateTemperature({});
    ambientFetchInFlight = false;
  }
}
