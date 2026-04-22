(() => {
// Constants
const MAINTENANCE_CONFIG_KEY = 'maintenanceConfig';
const AMBIENT_LOCATION_UPDATED_AT_KEY = 'ambientLocationUpdatedAt';
const MAINTENANCE_CONFIG_ENDPOINT = '/maintenance/config';
const PROTECTION_CONFIG_ENDPOINT = '/protection/config';
const RELAY_CONFIG_ENDPOINT = '/relay/config';
const MQTT_CONFIG_ENDPOINT = '/mqtt/config';
const MQTT_STATUS_ENDPOINT = '/mqtt/status';
const AMBIENT_AUTO_LOCATION_KEY = 'ambientAutoLocationLabel';
const RAILWAY_RELAY_CONFIG_KEY = 'railwayRelayConfig';
const MQTT_RELAY_CONFIG_KEY = 'mqttRelayConfig';
const PROTECTION_CONFIG_KEY = 'protectionConfig';
const THEME_KEY = 'appTheme';

const STATE_CITY_OPTIONS = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati'],
  'Delhi': ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Sambalpur', 'Puri'],
  'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
  'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Noida', 'Varanasi', 'Prayagraj'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri', 'Asansol']
};

// DOM Elements
const elements = {
  maintenanceForm: document.getElementById('maintenanceForm'),
  locationForm: document.getElementById('locationForm'),
  nextMaintenanceDay: document.getElementById('nextMaintenanceDay'),
  nextMaintenanceMonth: document.getElementById('nextMaintenanceMonth'),
  nextMaintenanceYear: document.getElementById('nextMaintenanceYear'),
  nextMaintenanceHour: document.getElementById('nextMaintenanceHour'),
  nextMaintenanceMinute: document.getElementById('nextMaintenanceMinute'),
  totalLifeCycleHours: document.getElementById('totalLifeCycleHours'),
  maintenanceHoursLimit: document.getElementById('maintenanceHoursLimit'),
  uptimeHours: document.getElementById('uptimeHours'),
  ambientLocationMode: document.getElementById('ambientLocationMode'),
  ambientState: document.getElementById('ambientState'),
  ambientCity: document.getElementById('ambientCity'),
  manualLocationFields: document.getElementById('manualLocationFields'),
  detectedLocationText: document.getElementById('detectedLocationText'),
  clearMaintenanceBtn: document.getElementById('clearMaintenanceBtn'),
  clearLocationBtn: document.getElementById('clearLocationBtn'),
  clearNvsBtn: document.getElementById('clearNvsBtn'),
  maintenanceStatus: document.getElementById('maintenanceStatus'),
  protectionStatus: document.getElementById('protectionStatus'),
  railwayStatus: document.getElementById('railwayStatus'),
  protectionForm: document.getElementById('protectionForm'),
  maxCurrentA: document.getElementById('maxCurrentA'),
  maxTempC: document.getElementById('maxTempC'),
  minRpm: document.getElementById('minRpm'),
  overvoltageV: document.getElementById('overvoltageV'),
  undervoltageV: document.getElementById('undervoltageV'),
  stallCurrentA: document.getElementById('stallCurrentA'),
  startupGraceMs: document.getElementById('startupGraceMs'),
  faultTripCount: document.getElementById('faultTripCount'),
  vibrationAckGraceMs: document.getElementById('vibrationAckGraceMs'),
  resetProtectionDefaultsBtn: document.getElementById('resetProtectionDefaultsBtn'),
  railwayForm: document.getElementById('railwayForm'),
  railwayEnabled: document.getElementById('railwayEnabled'),
  railwayEndpoint: document.getElementById('railwayEndpoint'),
  railwayApiKey: document.getElementById('railwayApiKey'),
  railwayDeviceId: document.getElementById('railwayDeviceId'),
  railwayIntervalSeconds: document.getElementById('railwayIntervalSeconds'),
  clearRailwayBtn: document.getElementById('clearRailwayBtn'),
  mqttForm: document.getElementById('mqttForm'),
  mqttEnabled: document.getElementById('mqttEnabled'),
  mqttBrokerUri: document.getElementById('mqttBrokerUri'),
  mqttTopic: document.getElementById('mqttTopic'),
  mqttClientId: document.getElementById('mqttClientId'),
  mqttUsername: document.getElementById('mqttUsername'),
  mqttPassword: document.getElementById('mqttPassword'),
  mqttIntervalSeconds: document.getElementById('mqttIntervalSeconds'),
  mqttQos: document.getElementById('mqttQos'),
  mqttRetain: document.getElementById('mqttRetain'),
  clearMqttBtn: document.getElementById('clearMqttBtn'),
  refreshMqttStatusBtn: document.getElementById('refreshMqttStatusBtn'),
  mqttStatusEnabled: document.getElementById('mqttStatusEnabled'),
  mqttStatusConnected: document.getElementById('mqttStatusConnected'),
  mqttStatusLastPublish: document.getElementById('mqttStatusLastPublish'),
  mqttStatusLastErrorMs: document.getElementById('mqttStatusLastErrorMs'),
  mqttStatusSuccessCount: document.getElementById('mqttStatusSuccessCount'),
  mqttStatusFailCount: document.getElementById('mqttStatusFailCount'),
  mqttStatusLastErrorText: document.getElementById('mqttStatusLastErrorText'),
  mqttStatus: document.getElementById('mqttStatus'),
  saveStatus: document.getElementById('saveStatus')
};

const DEFAULT_RAILWAY_RELAY_CONFIG = {
  enabled: false,
  endpoint: '',
  apiKey: '',
  deviceId: 'esp32-motor-01',
  intervalSeconds: 10,
  relayMode: 'esp32'
};

const DEFAULT_MQTT_RELAY_CONFIG = {
  enabled: false,
  brokerUri: 'mqtt://broker.hivemq.com:1883',
  topic: 'esp32/motor/data',
  clientId: 'esp32-motor-01',
  username: '',
  password: '',
  intervalSeconds: 10,
  qos: 1,
  retain: false,
  relayMode: 'esp32'
};

const DEFAULT_PROTECTION_CONFIG = {
  maxCurrentA: 5.0,
  maxTempC: 80.0,
  minRpm: 500,
  overvoltageV: 250.0,
  undervoltageV: 190.0,
  stallCurrentA: 0.5,
  startupGraceMs: 3000,
  faultTripCount: 3,
  vibrationAckGraceMs: 1500
};

// --- Theme Management ---
function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  setTheme(savedTheme);
}

function setTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  localStorage.setItem(THEME_KEY, theme);
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.textContent = theme === 'light' ? '\u2600\uFE0F' : '\u{1F319}';
}

function setSectionStatus(element, message, color = '#1D9E75') {
  if (!element) return;
  element.textContent = message;
  element.style.color = color;
}

// --- Data Utilities ---
function pad2(value) { return String(value).padStart(2, '0'); }

function toIso8601WithTimezone(year, month, day, hour, minute) {
  const y = Number(year);
  const mo = Number(month);
  const d = Number(day);
  const h = Number(hour);
  const mi = Number(minute);
  const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;

  const offsetMinutes = -dt.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffsetMinutes = Math.abs(offsetMinutes);
  const tzHours = Math.floor(absOffsetMinutes / 60);
  const tzMinutes = absOffsetMinutes % 60;

  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}T${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:00${sign}${pad2(tzHours)}:${pad2(tzMinutes)}`;
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(MAINTENANCE_CONFIG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function saveConfig(config) {
  localStorage.setItem(MAINTENANCE_CONFIG_KEY, JSON.stringify(config));
}

function clearMaintenanceFromConfig(config) {
  const next = { ...config };
  next.nextMaintenanceTime = null;
  next.totalLifeCycleHours = null;
  next.maintenanceHoursLimit = null;
  next.uptimeHours = null;
  return next;
}

function clearLocationFromConfig(config) {
  const next = { ...config };
  next.ambientLocationMode = 'auto';
  next.ambientState = '';
  next.ambientCity = '';
  return next;
}

function loadRailwayRelayConfig() {
  try {
    const raw = localStorage.getItem(RAILWAY_RELAY_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_RAILWAY_RELAY_CONFIG };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_RAILWAY_RELAY_CONFIG };
    return {
      ...DEFAULT_RAILWAY_RELAY_CONFIG,
      ...parsed
    };
  } catch (error) {
    return { ...DEFAULT_RAILWAY_RELAY_CONFIG };
  }
}

function saveRailwayRelayConfig(config) {
  localStorage.setItem(RAILWAY_RELAY_CONFIG_KEY, JSON.stringify(config));
}

function clearRailwayRelayConfig() {
  localStorage.removeItem(RAILWAY_RELAY_CONFIG_KEY);
}

function loadMqttRelayConfig() {
  try {
    const raw = localStorage.getItem(MQTT_RELAY_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_MQTT_RELAY_CONFIG };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_MQTT_RELAY_CONFIG };
    return {
      ...DEFAULT_MQTT_RELAY_CONFIG,
      ...parsed
    };
  } catch (error) {
    return { ...DEFAULT_MQTT_RELAY_CONFIG };
  }
}

function saveMqttRelayConfig(config) {
  localStorage.setItem(MQTT_RELAY_CONFIG_KEY, JSON.stringify(config));
}

function clearMqttRelayConfig() {
  localStorage.removeItem(MQTT_RELAY_CONFIG_KEY);
}

function loadProtectionConfig() {
  try {
    const raw = localStorage.getItem(PROTECTION_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_PROTECTION_CONFIG };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PROTECTION_CONFIG };
    return {
      ...DEFAULT_PROTECTION_CONFIG,
      ...parsed
    };
  } catch (error) {
    return { ...DEFAULT_PROTECTION_CONFIG };
  }
}

function saveProtectionConfig(config) {
  localStorage.setItem(PROTECTION_CONFIG_KEY, JSON.stringify(config));
}

function clearProtectionConfig() {
  localStorage.removeItem(PROTECTION_CONFIG_KEY);
}

async function pullRailwayRelayConfigFromEsp() {
  const response = await fetch(RELAY_CONFIG_ENDPOINT);
  if (!response.ok) throw new Error('Failed to read relay config from ESP');
  const data = await response.json();
  const next = {
    ...DEFAULT_RAILWAY_RELAY_CONFIG,
    ...data,
    enabled: data.enabled === true,
    endpoint: String(data.endpoint || '').trim(),
    apiKey: String(data.apiKey || '').trim(),
    deviceId: String(data.deviceId || DEFAULT_RAILWAY_RELAY_CONFIG.deviceId).trim() || DEFAULT_RAILWAY_RELAY_CONFIG.deviceId,
    intervalSeconds: parseRelayIntervalSeconds(data.intervalSeconds),
    relayMode: 'esp32'
  };
  saveRailwayRelayConfig(next);
  return next;
}

async function pushRailwayRelayConfigToEsp(config) {
  const payload = {
    enabled: config.enabled === true,
    endpoint: config.endpoint || '',
    apiKey: config.apiKey || '',
    deviceId: config.deviceId || DEFAULT_RAILWAY_RELAY_CONFIG.deviceId,
    intervalSeconds: parseRelayIntervalSeconds(config.intervalSeconds),
    relayMode: 'esp32'
  };

  const response = await fetch(RELAY_CONFIG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('Failed to save relay config to ESP');
}

async function clearRailwayRelayConfigOnEsp() {
  const response = await fetch(RELAY_CONFIG_ENDPOINT, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to clear relay config on ESP');
}

async function pullMqttRelayConfigFromEsp() {
  const response = await fetch(MQTT_CONFIG_ENDPOINT);
  if (!response.ok) throw new Error('Failed to read MQTT config from ESP');
  const data = await response.json();
  const next = {
    ...DEFAULT_MQTT_RELAY_CONFIG,
    ...data,
    enabled: data.enabled === true,
    brokerUri: String(data.brokerUri || DEFAULT_MQTT_RELAY_CONFIG.brokerUri).trim() || DEFAULT_MQTT_RELAY_CONFIG.brokerUri,
    topic: String(data.topic || DEFAULT_MQTT_RELAY_CONFIG.topic).trim() || DEFAULT_MQTT_RELAY_CONFIG.topic,
    clientId: String(data.clientId || DEFAULT_MQTT_RELAY_CONFIG.clientId).trim() || DEFAULT_MQTT_RELAY_CONFIG.clientId,
    username: String(data.username || '').trim(),
    password: String(data.password || '').trim(),
    intervalSeconds: parseRelayIntervalSeconds(data.intervalSeconds),
    qos: parseMqttQos(data.qos),
    retain: data.retain === true,
    relayMode: 'esp32'
  };
  saveMqttRelayConfig(next);
  return next;
}

async function pushMqttRelayConfigToEsp(config) {
  const payload = {
    enabled: config.enabled === true,
    brokerUri: config.brokerUri || DEFAULT_MQTT_RELAY_CONFIG.brokerUri,
    topic: config.topic || DEFAULT_MQTT_RELAY_CONFIG.topic,
    clientId: config.clientId || DEFAULT_MQTT_RELAY_CONFIG.clientId,
    username: config.username || '',
    password: config.password || '',
    intervalSeconds: parseRelayIntervalSeconds(config.intervalSeconds),
    qos: parseMqttQos(config.qos),
    retain: config.retain === true,
    relayMode: 'esp32'
  };

  const response = await fetch(MQTT_CONFIG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('Failed to save MQTT config to ESP');
}

async function clearMqttRelayConfigOnEsp() {
  const response = await fetch(MQTT_CONFIG_ENDPOINT, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to clear MQTT config on ESP');
}

async function pullProtectionConfigFromEsp() {
  const response = await fetch(PROTECTION_CONFIG_ENDPOINT);
  if (!response.ok) throw new Error('Failed to read protection config from ESP');
  const data = await response.json();
  const next = {
    ...DEFAULT_PROTECTION_CONFIG,
    ...data,
    maxCurrentA: Number(data.maxCurrentA) || DEFAULT_PROTECTION_CONFIG.maxCurrentA,
    maxTempC: Number(data.maxTempC) || DEFAULT_PROTECTION_CONFIG.maxTempC,
    minRpm: Math.round(Number(data.minRpm) || DEFAULT_PROTECTION_CONFIG.minRpm),
    overvoltageV: Number(data.overvoltageV) || DEFAULT_PROTECTION_CONFIG.overvoltageV,
    undervoltageV: Number(data.undervoltageV) || DEFAULT_PROTECTION_CONFIG.undervoltageV,
    stallCurrentA: Number(data.stallCurrentA) || DEFAULT_PROTECTION_CONFIG.stallCurrentA,
    startupGraceMs: Math.round(Number(data.startupGraceMs) || DEFAULT_PROTECTION_CONFIG.startupGraceMs),
    faultTripCount: Math.round(Number(data.faultTripCount) || DEFAULT_PROTECTION_CONFIG.faultTripCount),
    vibrationAckGraceMs: Math.round(Number(data.vibrationAckGraceMs) || DEFAULT_PROTECTION_CONFIG.vibrationAckGraceMs)
  };
  saveProtectionConfig(next);
  return next;
}

async function pushProtectionConfigToEsp(config) {
  const payload = {
    maxCurrentA: Number(config.maxCurrentA),
    maxTempC: Number(config.maxTempC),
    minRpm: Math.round(Number(config.minRpm)),
    overvoltageV: Number(config.overvoltageV),
    undervoltageV: Number(config.undervoltageV),
    stallCurrentA: Number(config.stallCurrentA),
    startupGraceMs: Math.round(Number(config.startupGraceMs)),
    faultTripCount: Math.round(Number(config.faultTripCount)),
    vibrationAckGraceMs: Math.round(Number(config.vibrationAckGraceMs))
  };

  const response = await fetch(PROTECTION_CONFIG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('Failed to save protection config to ESP');
}

async function clearProtectionConfigOnEsp() {
  const response = await fetch(PROTECTION_CONFIG_ENDPOINT, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to clear protection config on ESP');
}

async function refreshMqttStatus() {
  try {
    const response = await fetch(MQTT_STATUS_ENDPOINT);
    if (!response.ok) throw new Error('MQTT status unavailable');
    const status = await response.json();

    if (elements.mqttStatusEnabled) elements.mqttStatusEnabled.textContent = status.enabled ? 'Yes' : 'No';
    if (elements.mqttStatusConnected) elements.mqttStatusConnected.textContent = status.connected ? 'Yes' : 'No';
    if (elements.mqttStatusLastPublish) elements.mqttStatusLastPublish.textContent = Number(status.lastPublishMs) || 0;
    if (elements.mqttStatusLastErrorMs) elements.mqttStatusLastErrorMs.textContent = Number(status.lastErrorMs) || 0;
    if (elements.mqttStatusSuccessCount) elements.mqttStatusSuccessCount.textContent = Number(status.publishSuccessCount) || 0;
    if (elements.mqttStatusFailCount) elements.mqttStatusFailCount.textContent = Number(status.publishFailCount) || 0;
    if (elements.mqttStatusLastErrorText) {
      elements.mqttStatusLastErrorText.textContent = `Last error: ${status.lastError || '--'}`;
    }
  } catch (error) {
    if (elements.mqttStatusLastErrorText) {
      elements.mqttStatusLastErrorText.textContent = 'Last error: Unable to fetch MQTT status';
    }
  }
}

// --- Dropdown Initialization ---
function initializeDateTimeDropdowns() {
  const now = new Date();
  const fill = (el, start, end) => {
    if (!el) return;
    el.innerHTML = '<option value="">--</option>';
    for (let i = start; i <= end; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = pad2(i);
      el.appendChild(opt);
    }
  };
  fill(elements.nextMaintenanceDay, 1, 31);
  fill(elements.nextMaintenanceMonth, 1, 12);
  fill(elements.nextMaintenanceYear, now.getFullYear(), now.getFullYear() + 5);
  fill(elements.nextMaintenanceHour, 0, 23);
  fill(elements.nextMaintenanceMinute, 0, 59);
}

function updateCityDropdown(stateName, selectedCity = "") {
  if (!elements.ambientCity) return;
  const cities = STATE_CITY_OPTIONS[stateName] || [];
  elements.ambientCity.innerHTML = '<option value="">Select city</option>';
  cities.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    elements.ambientCity.appendChild(opt);
  });
  if (selectedCity) elements.ambientCity.value = selectedCity;
}

function initializeLocationDropdowns() {
  if (!elements.ambientState) return;
  const states = Object.keys(STATE_CITY_OPTIONS).sort();
  elements.ambientState.innerHTML = '<option value="">Select state</option>';
  states.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    elements.ambientState.appendChild(opt);
  });

  elements.ambientState.addEventListener('change', (e) => {
    updateCityDropdown(e.target.value);
  });
}

// --- UI Logic ---
function applyLocationModeUI() {
  const isManual = elements.ambientLocationMode.value === 'manual';
  if (elements.manualLocationFields) {
    elements.manualLocationFields.style.display = isManual ? 'grid' : 'none';
  }
}

function fillForm() {
  const config = loadConfig();
  const railwayConfig = loadRailwayRelayConfig();
  const mqttConfig = loadMqttRelayConfig();
  const protectionConfig = loadProtectionConfig();
  
  if (config.nextMaintenanceTime) {
    const d = new Date(config.nextMaintenanceTime);
    if (!isNaN(d.getTime())) {
      elements.nextMaintenanceDay.value = d.getDate();
      elements.nextMaintenanceMonth.value = d.getMonth() + 1;
      elements.nextMaintenanceYear.value = d.getFullYear();
      elements.nextMaintenanceHour.value = d.getHours();
      elements.nextMaintenanceMinute.value = d.getMinutes();
    }
  }
  elements.totalLifeCycleHours.value = config.totalLifeCycleHours || '';
  elements.maintenanceHoursLimit.value = config.maintenanceHoursLimit || '';
  elements.uptimeHours.value = config.uptimeHours || '';
  elements.ambientLocationMode.value = config.ambientLocationMode || 'auto';
  
  if (config.ambientState) {
    elements.ambientState.value = config.ambientState;
    updateCityDropdown(config.ambientState, config.ambientCity);
  }
  
  applyLocationModeUI();
  const autoLoc = localStorage.getItem(AMBIENT_AUTO_LOCATION_KEY) || '--';
  elements.detectedLocationText.textContent = `Auto-detected location: ${autoLoc}`;

  if (elements.railwayEnabled) {
    elements.railwayEnabled.value = railwayConfig.enabled ? 'true' : 'false';
  }
  if (elements.railwayEndpoint) {
    elements.railwayEndpoint.value = railwayConfig.endpoint || '';
  }
  if (elements.railwayApiKey) {
    elements.railwayApiKey.value = railwayConfig.apiKey || '';
  }
  if (elements.railwayDeviceId) {
    elements.railwayDeviceId.value = railwayConfig.deviceId || DEFAULT_RAILWAY_RELAY_CONFIG.deviceId;
  }
  if (elements.railwayIntervalSeconds) {
    elements.railwayIntervalSeconds.value = railwayConfig.intervalSeconds || DEFAULT_RAILWAY_RELAY_CONFIG.intervalSeconds;
  }

  if (elements.mqttEnabled) {
    elements.mqttEnabled.value = mqttConfig.enabled ? 'true' : 'false';
  }
  if (elements.mqttBrokerUri) {
    elements.mqttBrokerUri.value = mqttConfig.brokerUri || DEFAULT_MQTT_RELAY_CONFIG.brokerUri;
  }
  if (elements.mqttTopic) {
    elements.mqttTopic.value = mqttConfig.topic || DEFAULT_MQTT_RELAY_CONFIG.topic;
  }
  if (elements.mqttClientId) {
    elements.mqttClientId.value = mqttConfig.clientId || DEFAULT_MQTT_RELAY_CONFIG.clientId;
  }
  if (elements.mqttUsername) {
    elements.mqttUsername.value = mqttConfig.username || '';
  }
  if (elements.mqttPassword) {
    elements.mqttPassword.value = mqttConfig.password || '';
  }
  if (elements.mqttIntervalSeconds) {
    elements.mqttIntervalSeconds.value = mqttConfig.intervalSeconds || DEFAULT_MQTT_RELAY_CONFIG.intervalSeconds;
  }
  if (elements.mqttQos) {
    elements.mqttQos.value = String(parseMqttQos(mqttConfig.qos));
  }
  if (elements.mqttRetain) {
    elements.mqttRetain.value = mqttConfig.retain === true ? 'true' : 'false';
  }

  if (elements.maxCurrentA) elements.maxCurrentA.value = protectionConfig.maxCurrentA;
  if (elements.maxTempC) elements.maxTempC.value = protectionConfig.maxTempC;
  if (elements.minRpm) elements.minRpm.value = protectionConfig.minRpm;
  if (elements.overvoltageV) elements.overvoltageV.value = protectionConfig.overvoltageV;
  if (elements.undervoltageV) elements.undervoltageV.value = protectionConfig.undervoltageV;
  if (elements.stallCurrentA) elements.stallCurrentA.value = protectionConfig.stallCurrentA;
  if (elements.startupGraceMs) elements.startupGraceMs.value = protectionConfig.startupGraceMs;
  if (elements.faultTripCount) elements.faultTripCount.value = protectionConfig.faultTripCount;
  if (elements.vibrationAckGraceMs) elements.vibrationAckGraceMs.value = protectionConfig.vibrationAckGraceMs;
}

// --- API Sync ---
async function pullConfigFromEsp() {
  const res = await fetch(MAINTENANCE_CONFIG_ENDPOINT);
  if (!res.ok) throw new Error('Failed to read maintenance config');
  const data = await res.json();

  const cfg = loadConfig();
  cfg.nextMaintenanceTime = data.nextMaintenanceTime ?? cfg.nextMaintenanceTime ?? null;
  cfg.totalLifeCycleHours = data.totalLifeCycleHours ?? cfg.totalLifeCycleHours ?? null;
  cfg.maintenanceHoursLimit = data.maintenanceHoursLimit ?? cfg.maintenanceHoursLimit ?? null;

  const uptimeSeconds = Number(data.uptimeSeconds);
  cfg.uptimeHours = Number.isFinite(uptimeSeconds) ? +(uptimeSeconds / 3600).toFixed(2) : (cfg.uptimeHours ?? null);

  saveConfig(cfg);
  fillForm();
}

async function pushConfigToEsp(config) {
  const payload = {
    ...config,
    totalLifeCycleSeconds: config.totalLifeCycleHours ? Math.round(config.totalLifeCycleHours * 3600) : null,
    maintenanceHoursLimitSeconds: config.maintenanceHoursLimit ? Math.round(config.maintenanceHoursLimit * 3600) : null,
    uptimeSeconds: config.uptimeHours ? Math.round(config.uptimeHours * 3600) : null
  };

  const res = await fetch(MAINTENANCE_CONFIG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('ESP Sync Failed');
}

// --- Event Handlers ---
async function handleMaintenanceSave(e) {
  e.preventDefault();
  const config = loadConfig();
  
  const d = elements.nextMaintenanceDay.value;
  const m = elements.nextMaintenanceMonth.value;
  const y = elements.nextMaintenanceYear.value;
  const h = elements.nextMaintenanceHour.value;
  const mi = elements.nextMaintenanceMinute.value;

  if (y && m && d) {
    const dateWithTimezone = toIso8601WithTimezone(y, m, d, h || 0, mi || 0);
    if (!dateWithTimezone) {
      setSectionStatus(elements.maintenanceStatus, "Error: Invalid maintenance date/time.", "#D85A30");
      return;
    }
    config.nextMaintenanceTime = dateWithTimezone;
  } else {
    config.nextMaintenanceTime = null;
  }

  config.totalLifeCycleHours = parseFloat(elements.totalLifeCycleHours.value) || null;
  config.maintenanceHoursLimit = parseFloat(elements.maintenanceHoursLimit.value) || null;
  config.uptimeHours = parseFloat(elements.uptimeHours.value) || null;

  try {
    saveConfig(config);
    await pushConfigToEsp(config);
    setSectionStatus(elements.maintenanceStatus, "Maintenance settings saved & synced!", "#1D9E75");
  } catch (err) {
    setSectionStatus(elements.maintenanceStatus, "Saved locally, but ESP is offline.", "#EF9F27");
  }
}

async function handleLocationSave(e) {
  e.preventDefault();
  const config = loadConfig();

  config.ambientLocationMode = elements.ambientLocationMode.value;
  config.ambientState = elements.ambientState.value;
  config.ambientCity = elements.ambientCity.value;

  if (config.ambientLocationMode === 'manual' && (!config.ambientState || !config.ambientCity)) {
    elements.saveStatus.textContent = "Error: Please select State and City.";
    elements.saveStatus.style.color = "#D85A30";
    return;
  }

  saveConfig(config);
  localStorage.setItem(AMBIENT_LOCATION_UPDATED_AT_KEY, String(Date.now()));
  elements.saveStatus.textContent = "Location updated successfully (saved locally).";
  elements.saveStatus.style.color = "#1D9E75";
}

function handleClearMaintenanceForm() {
  const next = clearMaintenanceFromConfig(loadConfig());
  saveConfig(next);
  fillForm();
  setSectionStatus(elements.maintenanceStatus, "Maintenance form cleared locally.", "#1D9E75");
}

function handleClearLocationForm() {
  const next = clearLocationFromConfig(loadConfig());
  saveConfig(next);
  localStorage.setItem(AMBIENT_LOCATION_UPDATED_AT_KEY, String(Date.now()));
  fillForm();
  elements.saveStatus.textContent = "Location form cleared locally.";
  elements.saveStatus.style.color = "#1D9E75";
}

async function handleClearNvs() {
  const shouldClear = confirm("Clear ESP32 NVS maintenance/runtime data?");
  if (!shouldClear) return;

  try {
    const response = await fetch(MAINTENANCE_CONFIG_ENDPOINT, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`ESP clear failed (${response.status})`);
    }

    const next = clearMaintenanceFromConfig(loadConfig());
    saveConfig(next);
    fillForm();
    setSectionStatus(elements.maintenanceStatus, "ESP32 NVS cleared successfully.", "#1D9E75");
  } catch (error) {
    setSectionStatus(elements.maintenanceStatus, "Failed to clear ESP32 NVS.", "#D85A30");
  }
}

function parseNumberInRange(rawValue, fallback, min, max, integerOnly = false) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = integerOnly ? Math.round(parsed) : parsed;
  return Math.min(max, Math.max(min, normalized));
}

async function handleProtectionSave(e) {
  e.preventDefault();

  const next = {
    maxCurrentA: parseNumberInRange(elements.maxCurrentA?.value, DEFAULT_PROTECTION_CONFIG.maxCurrentA, 0.1, 100),
    maxTempC: parseNumberInRange(elements.maxTempC?.value, DEFAULT_PROTECTION_CONFIG.maxTempC, 1, 200),
    minRpm: parseNumberInRange(elements.minRpm?.value, DEFAULT_PROTECTION_CONFIG.minRpm, 0, 50000, true),
    overvoltageV: parseNumberInRange(elements.overvoltageV?.value, DEFAULT_PROTECTION_CONFIG.overvoltageV, 10, 500),
    undervoltageV: parseNumberInRange(elements.undervoltageV?.value, DEFAULT_PROTECTION_CONFIG.undervoltageV, 10, 500),
    stallCurrentA: parseNumberInRange(elements.stallCurrentA?.value, DEFAULT_PROTECTION_CONFIG.stallCurrentA, 0, 30),
    startupGraceMs: parseNumberInRange(elements.startupGraceMs?.value, DEFAULT_PROTECTION_CONFIG.startupGraceMs, 0, 60000, true),
    faultTripCount: parseNumberInRange(elements.faultTripCount?.value, DEFAULT_PROTECTION_CONFIG.faultTripCount, 1, 20, true),
    vibrationAckGraceMs: parseNumberInRange(elements.vibrationAckGraceMs?.value, DEFAULT_PROTECTION_CONFIG.vibrationAckGraceMs, 0, 60000, true)
  };

  if (next.undervoltageV >= next.overvoltageV) {
    setSectionStatus(elements.protectionStatus, "Error: Undervoltage must be lower than overvoltage.", "#D85A30");
    return;
  }

  try {
    saveProtectionConfig(next);
    await pushProtectionConfigToEsp(next);
    await pullProtectionConfigFromEsp().catch(() => {});
    fillForm();
    setSectionStatus(elements.protectionStatus, "Protection settings saved and synced!", "#1D9E75");
  } catch (error) {
    setSectionStatus(elements.protectionStatus, "Saved locally, but failed to sync protection settings to ESP32.", "#EF9F27");
  }
}

async function handleResetProtectionDefaults() {
  try {
    clearProtectionConfig();
    await clearProtectionConfigOnEsp();
    await pullProtectionConfigFromEsp().catch(() => {});
    fillForm();
    setSectionStatus(elements.protectionStatus, "Protection settings reset to firmware defaults.", "#1D9E75");
  } catch (error) {
    setSectionStatus(elements.protectionStatus, "Failed to reset protection settings on ESP32.", "#D85A30");
  }
}

function parseRelayIntervalSeconds(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return DEFAULT_RAILWAY_RELAY_CONFIG.intervalSeconds;
  const rounded = Math.round(parsed);
  return Math.min(3600, Math.max(2, rounded));
}

function parseMqttQos(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return DEFAULT_MQTT_RELAY_CONFIG.qos;
  const rounded = Math.round(parsed);
  return Math.min(2, Math.max(0, rounded));
}

function isHttpUrl(value) {
  if (!value) return false;
  return /^https?:\/\//i.test(value);
}

function isMqttUrl(value) {
  if (!value) return false;
  return /^(mqtt|mqtts|ws|wss):\/\//i.test(value);
}

async function handleRailwaySave(e) {
  e.preventDefault();

  const enabled = elements.railwayEnabled?.value === 'true';
  const endpoint = String(elements.railwayEndpoint?.value || '').trim();
  const apiKey = String(elements.railwayApiKey?.value || '').trim();
  const deviceId = String(elements.railwayDeviceId?.value || '').trim() || DEFAULT_RAILWAY_RELAY_CONFIG.deviceId;
  const intervalSeconds = parseRelayIntervalSeconds(elements.railwayIntervalSeconds?.value);

  if (enabled && !isHttpUrl(endpoint)) {
    setSectionStatus(elements.railwayStatus, "Error: Railway endpoint must start with http:// or https://", "#D85A30");
    return;
  }

  const relayConfig = {
    enabled,
    endpoint,
    apiKey,
    deviceId,
    intervalSeconds,
    relayMode: 'esp32'
  };

  try {
    saveRailwayRelayConfig(relayConfig);
    await pushRailwayRelayConfigToEsp(relayConfig);
    await pullRailwayRelayConfigFromEsp();
    fillForm();
    setSectionStatus(
      elements.railwayStatus,
      enabled ? "Railway relay saved to ESP32 and enabled." : "Railway relay saved to ESP32 (disabled).",
      "#1D9E75"
    );
  } catch (error) {
    setSectionStatus(elements.railwayStatus, "Saved locally, but failed to sync relay config to ESP32.", "#EF9F27");
  }
}

async function handleClearRailway() {
  try {
    clearRailwayRelayConfig();
    await clearRailwayRelayConfigOnEsp();
    await pullRailwayRelayConfigFromEsp().catch(() => {});
    fillForm();
    setSectionStatus(elements.railwayStatus, "Railway relay config cleared from ESP32.", "#1D9E75");
  } catch (error) {
    setSectionStatus(elements.railwayStatus, "Failed to clear relay config on ESP32.", "#D85A30");
  }
}

async function handleMqttSave(e) {
  e.preventDefault();

  const enabled = elements.mqttEnabled?.value === 'true';
  const brokerUri = String(elements.mqttBrokerUri?.value || '').trim();
  const topic = String(elements.mqttTopic?.value || '').trim();
  const clientId = String(elements.mqttClientId?.value || '').trim() || DEFAULT_MQTT_RELAY_CONFIG.clientId;
  const username = String(elements.mqttUsername?.value || '').trim();
  const password = String(elements.mqttPassword?.value || '').trim();
  const intervalSeconds = parseRelayIntervalSeconds(elements.mqttIntervalSeconds?.value);
  const qos = parseMqttQos(elements.mqttQos?.value);
  const retain = elements.mqttRetain?.value === 'true';

  if (enabled && !isMqttUrl(brokerUri)) {
    setSectionStatus(elements.mqttStatus, "Error: MQTT broker URI must start with mqtt://, mqtts://, ws:// or wss://", "#D85A30");
    return;
  }
  if (enabled && !topic) {
    setSectionStatus(elements.mqttStatus, "Error: MQTT topic is required.", "#D85A30");
    return;
  }

  const mqttConfig = {
    enabled,
    brokerUri,
    topic,
    clientId,
    username,
    password,
    intervalSeconds,
    qos,
    retain,
    relayMode: 'esp32'
  };

  try {
    saveMqttRelayConfig(mqttConfig);
    await pushMqttRelayConfigToEsp(mqttConfig);
    await pullMqttRelayConfigFromEsp();
    await refreshMqttStatus();
    fillForm();
    setSectionStatus(
      elements.mqttStatus,
      enabled ? "MQTT relay saved to ESP32 and enabled." : "MQTT relay saved to ESP32 (disabled).",
      "#1D9E75"
    );
  } catch (error) {
    setSectionStatus(elements.mqttStatus, "Saved locally, but failed to sync MQTT config to ESP32.", "#EF9F27");
  }
}

async function handleClearMqtt() {
  try {
    clearMqttRelayConfig();
    await clearMqttRelayConfigOnEsp();
    await pullMqttRelayConfigFromEsp().catch(() => {});
    await refreshMqttStatus();
    fillForm();
    setSectionStatus(elements.mqttStatus, "MQTT relay config cleared from ESP32.", "#1D9E75");
  } catch (error) {
    setSectionStatus(elements.mqttStatus, "Failed to clear MQTT config on ESP32.", "#D85A30");
  }
}

function init() {
  initializeTheme();

  initializeDateTimeDropdowns();
  initializeLocationDropdowns();
  fillForm();
  pullConfigFromEsp().catch(() => {});
  pullRailwayRelayConfigFromEsp().then(fillForm).catch(() => {});
  pullMqttRelayConfigFromEsp().then(fillForm).catch(() => {});
  pullProtectionConfigFromEsp().then(fillForm).catch(() => {});
  refreshMqttStatus();
  setInterval(refreshMqttStatus, 3000);

  elements.maintenanceForm?.addEventListener('submit', handleMaintenanceSave);
  elements.locationForm?.addEventListener('submit', handleLocationSave);
  elements.clearMaintenanceBtn?.addEventListener('click', handleClearMaintenanceForm);
  elements.clearLocationBtn?.addEventListener('click', handleClearLocationForm);
  elements.clearNvsBtn?.addEventListener('click', handleClearNvs);
  elements.protectionForm?.addEventListener('submit', handleProtectionSave);
  elements.resetProtectionDefaultsBtn?.addEventListener('click', handleResetProtectionDefaults);
  elements.railwayForm?.addEventListener('submit', handleRailwaySave);
  elements.clearRailwayBtn?.addEventListener('click', handleClearRailway);
  elements.mqttForm?.addEventListener('submit', handleMqttSave);
  elements.clearMqttBtn?.addEventListener('click', handleClearMqtt);
  elements.refreshMqttStatusBtn?.addEventListener('click', refreshMqttStatus);
  elements.ambientLocationMode?.addEventListener('change', applyLocationModeUI);
}

document.addEventListener('DOMContentLoaded', init);
})();

