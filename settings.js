const MAINTENANCE_CONFIG_KEY = 'maintenanceConfig';
const MAINTENANCE_CONFIG_ENDPOINT = '/maintenance/config';
const AMBIENT_AUTO_LOCATION_KEY = 'ambientAutoLocationLabel';
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

const elements = {
  maintenanceForm: document.getElementById('maintenanceForm'),
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

function pad2(value) {
  return String(value).padStart(2, '0');
}

function fillSelect(selectElement, options, placeholder) {
  if (!selectElement) return;
  selectElement.innerHTML = `<option value="">${placeholder}</option>`;
  options.forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = label;
    selectElement.appendChild(option);
  });
}

function initializeDateTimeDropdowns() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = [];
  for (let year = currentYear; year <= currentYear + 10; year += 1) {
    years.push({ value: year, label: String(year) });
  }

  const months = [];
  for (let month = 1; month <= 12; month += 1) {
    months.push({ value: month, label: pad2(month) });
  }

  const days = [];
  for (let day = 1; day <= 31; day += 1) {
    days.push({ value: day, label: pad2(day) });
  }

  const hours = [];
  for (let hour = 0; hour <= 23; hour += 1) {
    hours.push({ value: hour, label: pad2(hour) });
  }

  const minutes = [];
  for (let minute = 0; minute <= 59; minute += 1) {
    minutes.push({ value: minute, label: pad2(minute) });
  }

  fillSelect(elements.nextMaintenanceDay, days, 'Day');
  fillSelect(elements.nextMaintenanceMonth, months, 'Month');
  fillSelect(elements.nextMaintenanceYear, years, 'Year');
  fillSelect(elements.nextMaintenanceHour, hours, 'Hour');
  fillSelect(elements.nextMaintenanceMinute, minutes, 'Minute');
}

function loadConfig() {
  try {
    const rawConfig = localStorage.getItem(MAINTENANCE_CONFIG_KEY);
    if (!rawConfig) {
      return {};
    }
    const parsedConfig = JSON.parse(rawConfig);
    return parsedConfig && typeof parsedConfig === 'object' ? parsedConfig : {};
  } catch (error) {
    console.warn('Unable to load maintenance settings:', error);
    return {};
  }
}

function saveConfig(config) {
  localStorage.setItem(MAINTENANCE_CONFIG_KEY, JSON.stringify(config));
}

async function pushConfigToEsp(config) {
  const payload = {
    nextMaintenanceTime: config.nextMaintenanceTime || null,
    totalLifeCycleHours: config.totalLifeCycleHours,
    maintenanceHoursLimit: config.maintenanceHoursLimit,
    ambientLocationMode: config.ambientLocationMode || 'auto',
    ambientState: config.ambientState || '',
    ambientCity: config.ambientCity || '',
    totalLifeCycleSeconds:
      Number.isFinite(config.totalLifeCycleHours) ? Math.round(config.totalLifeCycleHours * 3600) : null,
    maintenanceHoursLimitSeconds:
      Number.isFinite(config.maintenanceHoursLimit) ? Math.round(config.maintenanceHoursLimit * 3600) : null
  };

  const response = await fetch(MAINTENANCE_CONFIG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Maintenance config push failed (${response.status})`);
  }
}

function showStatus(message) {
  if (elements.saveStatus) {
    elements.saveStatus.textContent = message;
  }
}

function setDateTimeDropdownValue(dateTimeValue) {
  if (!dateTimeValue) {
    elements.nextMaintenanceDay.value = '';
    elements.nextMaintenanceMonth.value = '';
    elements.nextMaintenanceYear.value = '';
    elements.nextMaintenanceHour.value = '';
    elements.nextMaintenanceMinute.value = '';
    return;
  }

  const normalized = dateTimeValue.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return;
  }

  elements.nextMaintenanceDay.value = String(date.getDate());
  elements.nextMaintenanceMonth.value = String(date.getMonth() + 1);
  elements.nextMaintenanceYear.value = String(date.getFullYear());
  elements.nextMaintenanceHour.value = String(date.getHours());
  elements.nextMaintenanceMinute.value = String(date.getMinutes());
}

function getDateTimeFromDropdowns() {
  const day = elements.nextMaintenanceDay.value;
  const month = elements.nextMaintenanceMonth.value;
  const year = elements.nextMaintenanceYear.value;
  const hour = elements.nextMaintenanceHour.value;
  const minute = elements.nextMaintenanceMinute.value;

  if (!day || !month || !year || !hour || !minute) {
    return '';
  }

  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}`;
}

function setOptions(selectElement, values, placeholder) {
  if (!selectElement) return;
  selectElement.innerHTML = '';
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = placeholder;
  selectElement.appendChild(placeholderOption);

  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    selectElement.appendChild(option);
  });
}

function ensureOption(selectElement, value) {
  if (!selectElement || !value) return;
  const exists = Array.from(selectElement.options).some((option) => option.value === value);
  if (!exists) {
    const customOption = document.createElement('option');
    customOption.value = value;
    customOption.textContent = value;
    selectElement.appendChild(customOption);
  }
}

function populateStateDropdown(selectedState) {
  const states = Object.keys(STATE_CITY_OPTIONS).sort((a, b) => a.localeCompare(b));
  setOptions(elements.ambientState, states, 'Select state');
  if (selectedState) {
    ensureOption(elements.ambientState, selectedState);
    elements.ambientState.value = selectedState;
  }
}

function populateCityDropdown(state, selectedCity) {
  const cities = STATE_CITY_OPTIONS[state] || [];
  setOptions(elements.ambientCity, cities, 'Select city');
  if (selectedCity) {
    ensureOption(elements.ambientCity, selectedCity);
    elements.ambientCity.value = selectedCity;
  }
}

function initializeLocationDropdowns() {
  populateStateDropdown('');
  populateCityDropdown('', '');

  elements.ambientState.addEventListener('change', () => {
    populateCityDropdown(elements.ambientState.value, '');
  });
}

function updateDetectedLocationLabel() {
  if (!elements.detectedLocationText) return;
  const autoLocationLabel = localStorage.getItem(AMBIENT_AUTO_LOCATION_KEY) || '--';
  elements.detectedLocationText.textContent = `Auto-detected location: ${autoLocationLabel}`;
}

function applyLocationModeUI() {
  const mode = elements.ambientLocationMode.value || 'auto';
  const showManual = mode === 'manual';
  elements.manualLocationFields.classList.toggle('is-hidden', !showManual);
}

function fillForm() {
  const config = loadConfig();
  setDateTimeDropdownValue(config.nextMaintenanceTime || '');
  elements.totalLifeCycleHours.value = config.totalLifeCycleHours ?? '';
  elements.maintenanceHoursLimit.value = config.maintenanceHoursLimit ?? '';
  elements.ambientLocationMode.value = config.ambientLocationMode || 'auto';
  populateStateDropdown(config.ambientState || '');
  populateCityDropdown(config.ambientState || '', config.ambientCity || '');
  applyLocationModeUI();
  updateDetectedLocationLabel();
}

async function handleSave(event) {
  event.preventDefault();

  const nextMaintenanceTime = getDateTimeFromDropdowns();
  const totalLifeCycleHoursInput = elements.totalLifeCycleHours.value;
  const parsedHours = totalLifeCycleHoursInput === '' ? null : Number(totalLifeCycleHoursInput);
  const totalLifeCycleHours = Number.isFinite(parsedHours) && parsedHours >= 0 ? parsedHours : null;
  const maintenanceHoursLimitInput = elements.maintenanceHoursLimit.value;
  const parsedMaintenanceLimit = maintenanceHoursLimitInput === '' ? null : Number(maintenanceHoursLimitInput);
  const maintenanceHoursLimit = Number.isFinite(parsedMaintenanceLimit) && parsedMaintenanceLimit >= 0 ? parsedMaintenanceLimit : null;

  const config = {
    nextMaintenanceTime,
    totalLifeCycleHours,
    maintenanceHoursLimit,
    ambientLocationMode: elements.ambientLocationMode.value || 'auto',
    ambientState: (elements.ambientState.value || '').trim(),
    ambientCity: (elements.ambientCity.value || '').trim()
  };

  if (config.ambientLocationMode === 'manual' && (!config.ambientState || !config.ambientCity)) {
    showStatus('Manual mode needs both State and City.');
    return;
  }

  saveConfig(config);

  try {
    await pushConfigToEsp(config);
    showStatus('Saved and sent to ESP successfully.');
  } catch (error) {
    console.error('Failed to push maintenance config:', error);
    showStatus('Saved locally, but failed to send to ESP. Check endpoint /maintenance/config.');
  }
}

async function handleClear() {
  localStorage.removeItem(MAINTENANCE_CONFIG_KEY);
  fillForm();
  try {
    await pushConfigToEsp({
      nextMaintenanceTime: null,
      totalLifeCycleHours: null,
      maintenanceHoursLimit: null,
      ambientLocationMode: 'auto',
      ambientState: '',
      ambientCity: ''
    });
    showStatus('Settings cleared and sent to ESP.');
  } catch (error) {
    console.error('Failed to clear maintenance config on ESP:', error);
    showStatus('Settings cleared locally, but failed to notify ESP.');
  }
}

function init() {
  initializeDateTimeDropdowns();
  initializeLocationDropdowns();
  fillForm();
  elements.maintenanceForm.addEventListener('submit', handleSave);
  elements.clearBtn.addEventListener('click', handleClear);
  elements.ambientLocationMode.addEventListener('change', applyLocationModeUI);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
