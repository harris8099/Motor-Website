(() => {
const THEME_KEY = 'appTheme';

const elements = {
  themeToggle: document.getElementById('themeToggle'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  timestamp: document.getElementById('timestamp'),
  date: document.getElementById('date'),
  wifiConnectedValue: document.getElementById('wifiConnectedValue'),
  currentSsidValue: document.getElementById('currentSsidValue'),
  rssiValue: document.getElementById('rssiValue'),
  lastSsidValue: document.getElementById('lastSsidValue'),
  staIpValue: document.getElementById('staIpValue'),
  wifiStatusMessage: document.getElementById('wifiStatusMessage'),
  scanStatusMessage: document.getElementById('scanStatusMessage'),
  connectStatusMessage: document.getElementById('connectStatusMessage'),
  forgetStatusMessage: document.getElementById('forgetStatusMessage'),
  scanBtn: document.getElementById('scanBtn'),
  refreshStatusBtn: document.getElementById('refreshStatusBtn'),
  wifiList: document.getElementById('wifiList'),
  wifiConnectForm: document.getElementById('wifiConnectForm'),
  wifiSsidInput: document.getElementById('wifiSsidInput'),
  wifiPasswordInput: document.getElementById('wifiPasswordInput'),
  forgetBtn: document.getElementById('forgetBtn')
};

function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  setTheme(savedTheme);
}

function setTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  localStorage.setItem(THEME_KEY, theme);
  if (elements.themeToggle) {
    elements.themeToggle.textContent = theme === 'light' ? '\u2600\uFE0F' : '\u{1F319}';
  }
}

function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString();
}

function getCurrentDate() {
  const now = new Date();
  return now.toLocaleDateString();
}

function setConnectionBadge(connected) {
  if (!elements.statusDot || !elements.statusText) return;
  elements.statusDot.className = connected ? 'status-dot connected' : 'status-dot error';
  elements.statusText.textContent = connected ? 'Connected' : 'Disconnected';
}

function setStatusMessage(message, isError = false) {
  if (!elements.wifiStatusMessage) return;
  elements.wifiStatusMessage.textContent = `Status: ${message}`;
  elements.wifiStatusMessage.style.color = isError ? '#D85A30' : '';
}

function setSectionStatus(element, message, isError = false) {
  if (!element) return;
  element.textContent = `Status: ${message}`;
  element.style.color = isError ? '#D85A30' : '';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function authLabel(auth) {
  if (!auth || auth === 'OPEN') return 'Open';
  return auth;
}

async function fetchWifiStatus() {
  const response = await fetch('/wifi/status');
  if (!response.ok) {
    throw new Error(`Unable to fetch WiFi status (${response.status})`);
  }

  const data = await response.json();
  const connected = data.connected === true;

  setConnectionBadge(connected);
  elements.wifiConnectedValue.textContent = connected ? 'Yes' : 'No';
  elements.currentSsidValue.textContent = data.currentSsid || '--';
  elements.rssiValue.textContent = connected && Number.isFinite(Number(data.rssi)) ? `${data.rssi} dBm` : '--';
  elements.lastSsidValue.textContent = data.lastConnectedSsid || '--';
  elements.staIpValue.textContent = connected && data.staIp ? data.staIp : '--';

  return data;
}

function renderWifiList(networks) {
  if (!elements.wifiList) return;

  if (!Array.isArray(networks) || networks.length === 0) {
    elements.wifiList.innerHTML = '<p class="settings-status">No networks found. Try scanning again.</p>';
    return;
  }

  const rows = networks.map((network) => {
    const ssidRaw = String(network.ssid || '');
    const ssid = escapeHtml(ssidRaw);
    const ssidEncoded = encodeURIComponent(ssidRaw);
    const rssi = Number.isFinite(Number(network.rssi)) ? `${network.rssi} dBm` : '--';
    const auth = authLabel(network.auth);
    const channel = Number.isFinite(Number(network.channel)) ? network.channel : '--';

    return `
      <button type="button" class="wifi-item" data-ssid="${ssidEncoded}">
        <span class="wifi-item-main">
          <span class="wifi-item-ssid">${ssid || '<hidden>'}</span>
          <span class="wifi-item-meta">${escapeHtml(auth)} | Ch ${channel}</span>
        </span>
        <span class="wifi-item-rssi">${rssi}</span>
      </button>
    `;
  });

  elements.wifiList.innerHTML = rows.join('');

  const items = elements.wifiList.querySelectorAll('.wifi-item');
  items.forEach((item) => {
    item.addEventListener('click', () => {
      const encoded = item.getAttribute('data-ssid') || '';
      const selectedSsid = decodeURIComponent(encoded);
      elements.wifiSsidInput.value = selectedSsid;
      elements.wifiPasswordInput.focus();
    });
  });
}

async function scanWifi() {
  elements.scanBtn.disabled = true;
  setSectionStatus(elements.scanStatusMessage, 'Scanning nearby WiFi networks...');
  try {
    const response = await fetch('/wifi/scan');
    if (!response.ok) {
      throw new Error(`Scan failed (${response.status})`);
    }
    const data = await response.json();
    renderWifiList(data.networks || []);
    setSectionStatus(elements.scanStatusMessage, `Scan complete. Found ${(data.networks || []).length} network(s).`);
  } catch (error) {
    renderWifiList([]);
    setSectionStatus(elements.scanStatusMessage, error.message, true);
  } finally {
    elements.scanBtn.disabled = false;
  }
}

async function connectWifi(event) {
  event.preventDefault();
  const ssid = (elements.wifiSsidInput.value || '').trim();
  const password = elements.wifiPasswordInput.value || '';

  if (!ssid) {
    setSectionStatus(elements.connectStatusMessage, 'SSID is required before connecting.', true);
    return;
  }

  setSectionStatus(elements.connectStatusMessage, `Connecting to "${ssid}"...`);
  try {
    const response = await fetch('/wifi/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ssid, password })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Connect failed (${response.status})`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
    await fetchWifiStatus();
    setSectionStatus(elements.connectStatusMessage, `Connect request sent for "${ssid}".`);
  } catch (error) {
    setSectionStatus(elements.connectStatusMessage, error.message, true);
  }
}

async function forgetWifi() {
  const confirmed = confirm('Forget remembered WiFi and clear STA configuration?');
  if (!confirmed) return;

  setSectionStatus(elements.forgetStatusMessage, 'Forgetting saved WiFi...');
  try {
    const response = await fetch('/wifi/forget', { method: 'POST' });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Forget failed (${response.status})`);
    }

    elements.wifiPasswordInput.value = '';
    await fetchWifiStatus();
    setSectionStatus(elements.forgetStatusMessage, 'Saved WiFi removed successfully.');
  } catch (error) {
    setSectionStatus(elements.forgetStatusMessage, error.message, true);
  }
}

function tickClock() {
  if (elements.timestamp) elements.timestamp.textContent = getCurrentTime();
  if (elements.date) elements.date.textContent = getCurrentDate();
}

async function refreshStatus() {
  try {
    await fetchWifiStatus();
  } catch (error) {
    setConnectionBadge(false);
    setStatusMessage(error.message, true);
  }
}

function init() {
  initializeTheme();
  elements.themeToggle?.addEventListener('click', () => {
    const nextTheme = document.body.classList.contains('light-theme') ? 'dark' : 'light';
    setTheme(nextTheme);
  });

  elements.scanBtn?.addEventListener('click', scanWifi);
  elements.refreshStatusBtn?.addEventListener('click', refreshStatus);
  elements.wifiConnectForm?.addEventListener('submit', connectWifi);
  elements.forgetBtn?.addEventListener('click', forgetWifi);

  tickClock();
  setInterval(tickClock, 1000);
  refreshStatus();
}

document.addEventListener('DOMContentLoaded', init);
})();

