// Constants
const MAINTENANCE_CONFIG_KEY = 'maintenanceConfig';
const MAINTENANCE_CONFIG_ENDPOINT = '/maintenance/config';
const AMBIENT_AUTO_LOCATION_KEY = 'ambientAutoLocationLabel';
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
  ambientLocationMode: document.getElementById('ambientLocationMode'),
  ambientState: document.getElementById('ambientState'),
  ambientCity: document.getElementById('ambientCity'),
  manualLocationFields: document.getElementById('manualLocationFields'),
  detectedLocationText: document.getElementById('detectedLocationText'),
  clearBtn: document.getElementById('clearBtn'),
  saveStatus: document.getElementById('saveStatus')
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
  if (themeBtn) themeBtn.textContent = theme === 'light' ? '☀️' : '🌙';
}

// --- Data Utilities ---
function pad2(value) { return String(value).padStart(2, '0'); }

function loadConfig() {
  try {
    const raw = localStorage.getItem(MAINTENANCE_CONFIG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function saveConfig(config) {
  localStorage.setItem(MAINTENANCE_CONFIG_KEY, JSON.stringify(config));
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
  elements.ambientLocationMode.value = config.ambientLocationMode || 'auto';
  
  if (config.ambientState) {
    elements.ambientState.value = config.ambientState;
    updateCityDropdown(config.ambientState, config.ambientCity);
  }
  
  applyLocationModeUI();
  const autoLoc = localStorage.getItem(AMBIENT_AUTO_LOCATION_KEY) || '--';
  elements.detectedLocationText.textContent = `Auto-detected location: ${autoLoc}`;
}

// --- API Sync ---
async function pushConfigToEsp(config) {
  const payload = {
    ...config,
    totalLifeCycleSeconds: config.totalLifeCycleHours ? Math.round(config.totalLifeCycleHours * 3600) : null,
    maintenanceHoursLimitSeconds: config.maintenanceHoursLimit ? Math.round(config.maintenanceHoursLimit * 3600) : null
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
    config.nextMaintenanceTime = `${y}-${pad2(m)}-${pad2(d)}T${pad2(h)}:${pad2(mi)}`;
  }

  config.totalLifeCycleHours = parseFloat(elements.totalLifeCycleHours.value) || null;
  config.maintenanceHoursLimit = parseFloat(elements.maintenanceHoursLimit.value) || null;

  try {
    saveConfig(config);
    await pushConfigToEsp(config);
    elements.saveStatus.textContent = "Maintenance settings saved & synced!";
    elements.saveStatus.style.color = "#1D9E75";
  } catch (err) {
    elements.saveStatus.textContent = "Saved locally, but ESP is offline.";
    elements.saveStatus.style.color = "#EF9F27";
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

  try {
    saveConfig(config);
    await pushConfigToEsp(config);
    elements.saveStatus.textContent = "Location updated successfully!";
    elements.saveStatus.style.color = "#1D9E75";
  } catch (err) {
    elements.saveStatus.textContent = "Location saved (ESP Sync failed).";
  }
}

function init() {
  initializeTheme();
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const newTheme = document.body.classList.contains('light-theme') ? 'dark' : 'light';
    setTheme(newTheme);
  });

  initializeDateTimeDropdowns();
  initializeLocationDropdowns();
  fillForm();

  elements.maintenanceForm?.addEventListener('submit', handleMaintenanceSave);
  elements.locationForm?.addEventListener('submit', handleLocationSave);
  elements.clearBtn?.addEventListener('click', () => {
    if(confirm("Clear all settings?")) {
      localStorage.removeItem(MAINTENANCE_CONFIG_KEY);
      location.reload();
    }
  });
  elements.ambientLocationMode?.addEventListener('change', applyLocationModeUI);
}

document.addEventListener('DOMContentLoaded', init);