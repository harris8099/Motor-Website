const CONFIG = {
  dataEndpoint: '/data',
  updateInterval: 2000,
  maxLogEntries: 80
};
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

let dataLog = [];

const elements = {
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  timestamp: document.getElementById('timestamp'),
  date: document.getElementById('date'),
  logBody: document.getElementById('logBody')
};

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getCurrentDate() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

function setConnectionStatus(connected) {
  elements.statusDot.className = connected ? 'status-dot connected' : 'status-dot error';
  elements.statusText.textContent = connected ? 'Connected' : 'Disconnected';
}

function updateHeaderClock() {
  elements.timestamp.textContent = getCurrentTime();
  elements.date.textContent = getCurrentDate();
}

function pushLogEntry(data) {
  const power = data.power || {};
  const temp = data.temperature || data.temp || {};
  const motor = data.motor || {};

  const logEntry = {
    time: getCurrentTime(),
    voltage: Number.parseFloat(power.voltage || power.v || 0).toFixed(1),
    current: Number.parseFloat(power.current || power.a || 0).toFixed(2),
    power: Math.round(power.power || power.w || 0),
    temp1: Number.parseFloat(temp.t1 || temp.sensor1 || temp.motor || 0).toFixed(1),
    temp2: Number.parseFloat(temp.t2 || temp.sensor2 || temp.ambient || 0).toFixed(1),
    rpm: motor.rpm || 0
  };

  dataLog.unshift(logEntry);
  if (dataLog.length > CONFIG.maxLogEntries) {
    dataLog = dataLog.slice(0, CONFIG.maxLogEntries);
  }
}

function renderLog() {
  if (dataLog.length === 0) {
    elements.logBody.innerHTML = '<tr><td colspan="7" class="no-data">No data available</td></tr>';
    return;
  }

  elements.logBody.innerHTML = dataLog.map((entry) => `
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

async function fetchSensorData() {
  updateHeaderClock();
  try {
    const response = await fetch(CONFIG.dataEndpoint);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    pushLogEntry(data);
    renderLog();
    setConnectionStatus(true);
  } catch (error) {
    setConnectionStatus(false);
  }
}

function init() {
  // Initialize theme
  initializeTheme();
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
  }
  
  updateHeaderClock();
  fetchSensorData();
  setInterval(fetchSensorData, CONFIG.updateInterval);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

