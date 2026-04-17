// Configuration
const CONFIG = {
  dataEndpoint: '/data',
  faultAcknowledgeEndpoint: '/faults/ack',
  updateInterval: 2000, // 2 seconds
  maxLogEntries: 10
};
const MAINTENANCE_CONFIG_KEY = 'maintenanceConfig';
const AMBIENT_AUTO_LOCATION_KEY = 'ambientAutoLocationLabel';

// State
let dataLog = [];
let isConnected = false;
let isFaultActionInProgress = false;
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
  const faultKeys = ['overcurrent', 'overtemp', 'stall', 'vibration'];
  const faultTitles = {
    overcurrent: 'Overcurrent',
    overtemp: 'Overtemp',
    stall: 'Stall',
    vibration: 'Vibration'
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
    const response = await fetch(CONFIG.faultAcknowledgeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        faults: faultKeys
      })
    });

    if (!response.ok) {
      throw new Error(`Fault acknowledge failed (${response.status})`);
    }

    setFaultActionStatus('Resolve request sent. Waiting for ESP confirmation...', false);
    await fetchSensorData();
  } catch (error) {
    console.error('Fault resolve request failed:', error);
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
    elements.fault_vibration_action
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

  // Update motor indicator
  elements.motorIndicator.className = 'motor-indicator ' + (isRunning ? 'on' : 'off');
  elements.motorDot.className = 'motor-dot ' + (isRunning ? 'on' : 'off');
  elements.motorLabel.textContent = isRunning ? 'Running' : 'Stopped';
  
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
function updateTemperature(data) {
  const temp = data.temperature || data.temp || {};
  
  // Temperature 1 (Motor)
  const t1 = parseFloat(temp.t1 || temp.sensor1 || temp.motor || 0);
  elements.temp1.innerHTML = t1.toFixed(1) + '<span class="card-unit">°C</span>';
  updateProgressBar(elements.temp1Bar, t1, 100, '#D85A30');
  
  // Temperature 2 (Ambient) - Weather API only (no ESP fallback)
  if (Number.isFinite(ambientTempFromAPI)) {
    elements.temp2.innerHTML = ambientTempFromAPI.toFixed(1) + '<span class="card-unit">°C</span>';
    updateProgressBar(elements.temp2Bar, ambientTempFromAPI, 50, '#378ADD');
  } else {
    elements.temp2.innerHTML = '--<span class="card-unit">°C</span>';
    updateProgressBar(elements.temp2Bar, 0, 50, '#378ADD');
  }

  if (elements.ambientLocationLabel) {
    elements.ambientLocationLabel.textContent = locationName
      ? `Location: ${locationName}`
      : 'Location: Detecting...';
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
    temp2: Number.isFinite(ambientTempFromAPI) ? ambientTempFromAPI.toFixed(1) : '--',
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

// Main Update Function
function updateDashboard(data) {
  try {
    // Update timestamp
    elements.timestamp.textContent = getCurrentTime();
    elements.date.textContent = getCurrentDate();

    // Update all sections
    updateMotorStatus(data);
    updatePowerMetrics(data);
    updateTemperature(data);
    updateVibration(data);
    updateFaults(data);
    updateDataLog(data);
    updateTrendSeries(data);
    
    // Set connected status
    setConnectionStatus(true);
  } catch (error) {
    console.error('Error updating dashboard:', error);
  }
}

// Fetch Data from ESP32
async function fetchSensorData() {
  try {
    const response = await fetch(CONFIG.dataEndpoint);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    updateDashboard(data);
    
  } catch (error) {
    console.error('Failed to fetch sensor data:', error);
    setConnectionStatus(false);
  }
}

// Initialize
function init() {
  console.log('ESP32 Dashboard initialized');
  setupFaultActionHandlers();
  setupTrendCharts();
  
  // Initial fetch
  fetchSensorData();
  
  // Set up periodic updates
  setInterval(fetchSensorData, CONFIG.updateInterval);

  // Date display
  elements.date.textContent = getCurrentDate();

  // timestamp display
  elements.timestamp.textContent = getCurrentTime();

  // Fetch ambient temperature using Geolocation API
  fetchAmbientTemperature();
  setInterval(fetchAmbientTemperature, 300000); // update every 5 min
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function fetchAmbientTemperature() {
  try {
    const locationConfig = getAmbientLocationConfig();
    let lat;
    let lon;
    let label = '';

    if (locationConfig.mode === 'manual') {
      if (!locationConfig.city || !locationConfig.state) {
        ambientTempFromAPI = null;
        locationName = 'Manual location not set';
        return;
      }

      const query = encodeURIComponent(`${locationConfig.city}, ${locationConfig.state}`);
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1&language=en&format=json`);
      if (!geoRes.ok) {
        throw new Error(`Geocoding lookup failed (${geoRes.status})`);
      }

      const geoData = await geoRes.json();
      const best = geoData?.results?.[0];
      if (!best) {
        throw new Error('No matching location found for manual city/state');
      }

      lat = best.latitude;
      lon = best.longitude;
      label = `${best.name}, ${best.admin1 || locationConfig.state}`;
      locationName = `${label} (Manual)`;
    } else {
      // Auto detect from IP
      const locRes = await fetch('https://ipapi.co/json/');
      if (!locRes.ok) {
        throw new Error(`Location lookup failed (${locRes.status})`);
      }
      const locData = await locRes.json();

      lat = locData.latitude;
      lon = locData.longitude;
      label = `${locData.city || 'Unknown city'}, ${locData.region || 'Unknown state'}`;
      locationName = `${label} (Auto)`;
      localStorage.setItem(AMBIENT_AUTO_LOCATION_KEY, label);
    }

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
    );
    if (!weatherRes.ok) {
      throw new Error(`Weather lookup failed (${weatherRes.status})`);
    }

    const weatherData = await weatherRes.json();
    const weatherTemp = weatherData?.current_weather?.temperature;
    ambientTempFromAPI = Number.isFinite(Number(weatherTemp)) ? Number(weatherTemp) : null;

  } catch (err) {
    console.error("Ambient temp fetch failed:", err);
    ambientTempFromAPI = null;
    if (!locationName) {
      locationName = 'Location unavailable';
    }
  }
}
