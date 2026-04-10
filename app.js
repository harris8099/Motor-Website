// Configuration
const CONFIG = {
  dataEndpoint: '/data',
  updateInterval: 2000, // 2 seconds
  maxLogEntries: 10
};

// State
let dataLog = [];
let isConnected = false;

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
  
  // Vibration
  accelX: document.getElementById('accelX'),
  accelY: document.getElementById('accelY'),
  accelZ: document.getElementById('accelZ'),
  tapBadge: document.getElementById('tapBadge'),
  
  // Log
  logBody: document.getElementById('logBody')
};

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
  const percentage = Math.min(100, (value / max) * 100);
  element.style.width = percentage.toFixed(0) + '%';
  element.style.background = color;
}

// Update Functions
function updateMotorStatus(data) {
  const motor = data.motor || {};
  const isRunning = motor.running || motor.state === 1 || motor.status === 'on';
  
  // Update motor indicator
  elements.motorIndicator.className = 'motor-indicator ' + (isRunning ? 'on' : 'off');
  elements.motorDot.className = 'motor-dot ' + (isRunning ? 'on' : 'off');
  elements.motorLabel.textContent = isRunning ? 'Running' : 'Stopped';
  
  // Update RPM and pulse
  elements.rpm.textContent = motor.rpm || 0;
  elements.pulse.textContent = motor.pulse || motor.pulseCount || 0;
}

function updatePowerMetrics(data) {
  const power = data.power || {};
  
  // Voltage
  const voltage = parseFloat(power.voltage || power.v || 0).toFixed(1);
  elements.voltage.innerHTML = voltage + '<span class="card-unit">V</span>';
  updateProgressBar(elements.voltageBar, voltage, 250, '#378ADD');
  
  // Current
  const current = parseFloat(power.current || power.a || 0).toFixed(2);
  elements.current.innerHTML = current + '<span class="card-unit">A</span>';
  updateProgressBar(elements.currentBar, current, 10, '#EF9F27');
  
  // Active Power
  const activePower = Math.round(power.power || power.w || 0);
  elements.power.innerHTML = activePower + '<span class="card-unit">W</span>';
  updateProgressBar(elements.powerBar, activePower, 2000, '#D85A30');
  
  // Power Factor
  const powerFactor = parseFloat(power.powerFactor || power.pf || 0).toFixed(2);
  elements.powerFactor.textContent = powerFactor;
  updateProgressBar(elements.powerFactorBar, powerFactor, 1, '#1D9E75');
  
  // Energy
  const energy = parseFloat(power.energy || power.e || 0).toFixed(2);
  elements.energy.innerHTML = energy + '<span class="card-unit">kWh</span>';
  
  // Frequency
  const frequency = parseFloat(power.frequency || power.hz || 0).toFixed(1);
  elements.frequency.innerHTML = frequency + '<span class="card-unit">Hz</span>';
}

function updateTemperature(data) {
  const temp = data.temperature || data.temp || {};
  
  // Temperature 1
  const t1 = parseFloat(temp.t1 || temp.sensor1 || temp.motor || 0).toFixed(1);
  elements.temp1.innerHTML = t1 + '<span class="card-unit">°C</span>';
  updateProgressBar(elements.temp1Bar, t1, 100, '#D85A30');
  
  // Temperature 2
  const t2 = parseFloat(temp.t2 || temp.sensor2 || temp.ambient || 0).toFixed(1);
  elements.temp2.innerHTML = t2 + '<span class="card-unit">°C</span>';
  updateProgressBar(elements.temp2Bar, t2, 100, '#378ADD');
}

function updateVibration(data) {
  const vibration = data.vibration || data.accel || {};
  
  // Acceleration
  elements.accelX.textContent = parseFloat(vibration.x || 0).toFixed(2);
  elements.accelY.textContent = parseFloat(vibration.y || 0).toFixed(2);
  elements.accelZ.textContent = parseFloat(vibration.z || 0).toFixed(2);
  
  // Tap detection
  const tapDetected = vibration.tap || vibration.tapDetected || false;
  elements.tapBadge.className = tapDetected ? 'badge badge-on' : 'badge badge-off';
  elements.tapBadge.textContent = tapDetected ? 'Tap detected!' : 'No tap';
}

function updateDataLog(data) {
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
    temp2: parseFloat(temp.t2 || temp.sensor2 || temp.ambient || 0).toFixed(1),
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
    updateDataLog(data);
    
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
  
  // Initial fetch
  fetchSensorData();
  
  // Set up periodic updates
  setInterval(fetchSensorData, CONFIG.updateInterval);

  // Date display
  elements.date.textContent = getCurrentDate();

  // timestamp display
  elements.timestamp.textContent = getCurrentTime();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}