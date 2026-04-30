(() => {
const THEME_KEY = 'appTheme';
const IS_MOBILE = window.matchMedia('(max-width: 760px)').matches;
const MAX_LOG_ENTRIES = IS_MOBILE ? 1000 : 3000;
const CONSOLE_POLL_INTERVAL_MS = IS_MOBILE ? 3000 : 1500;

let isPaused = false;
let lastLogId = 0;
let logEntries = [];
let pollTimer = null;
let pollInFlight = false;
let lastRenderedSignature = '';

const elements = {
  themeToggle: document.getElementById('themeToggle'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  timestamp: document.getElementById('timestamp'),
  date: document.getElementById('date'),
  pauseBtn: document.getElementById('pauseBtn'),
  clearBtn: document.getElementById('clearBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  levelFilter: document.getElementById('levelFilter'),
  searchInput: document.getElementById('searchInput'),
  autoScroll: document.getElementById('autoScroll'),
  consoleMeta: document.getElementById('consoleMeta'),
  consoleOutput: document.getElementById('consoleOutput')
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
  return new Date().toLocaleTimeString();
}

function getCurrentDate() {
  return new Date().toLocaleDateString();
}

function updateClock() {
  if (elements.timestamp) elements.timestamp.textContent = getCurrentTime();
  if (elements.date) elements.date.textContent = getCurrentDate();
}

function setConnectionStatus(connected) {
  if (!elements.statusDot || !elements.statusText) return;
  elements.statusDot.className = connected ? 'status-dot connected' : 'status-dot error';
  elements.statusText.textContent = connected ? 'Connected' : 'Disconnected';
}

function getLogLevel(message) {
  const m = String(message || '');
  if (/^\s*E\s*\(/.test(m)) return 'error';
  if (/^\s*W\s*\(/.test(m)) return 'warn';
  if (/^\s*I\s*\(/.test(m)) return 'info';
  if (/^\s*D\s*\(/.test(m)) return 'debug';
  if (/^\s*V\s*\(/.test(m)) return 'verbose';
  return 'other';
}

function entryToLine(entry) {
  return `[${entry.tsMs}] ${entry.msg}`;
}

function getFilteredEntries() {
  const level = elements.levelFilter?.value || 'all';
  const search = String(elements.searchInput?.value || '').trim().toLowerCase();

  return logEntries.filter((entry) => {
    const matchesLevel = level === 'all' ? true : entry.level === level;
    if (!matchesLevel) return false;

    if (!search) return true;
    return entry.msg.toLowerCase().includes(search) || String(entry.tsMs).includes(search);
  });
}

function renderLogs() {
  const filtered = getFilteredEntries();
  const signature = `${filtered.length}:${lastLogId}:${isPaused ? 1 : 0}:${elements.levelFilter?.value || 'all'}:${elements.searchInput?.value || ''}`;
  if (signature === lastRenderedSignature) return;
  lastRenderedSignature = signature;

  elements.consoleOutput.textContent = filtered.map(entryToLine).join('\n');
  if (filtered.length > 0) {
    elements.consoleOutput.textContent += '\n';
  }
  if (elements.autoScroll.checked) {
    elements.consoleOutput.scrollTop = elements.consoleOutput.scrollHeight;
  }
  elements.consoleMeta.textContent = `${isPaused ? 'Paused' : 'Live logs'} | Total: ${logEntries.length} | Showing: ${filtered.length} | Last ID: ${lastLogId}`;
}

function addLogEntries(newEntries) {
  if (!Array.isArray(newEntries) || newEntries.length === 0) return;

  newEntries.forEach((entry) => {
    const msg = String(entry.msg || '');
    const normalized = {
      id: Number(entry.id) || 0,
      tsMs: Number(entry.tsMs) || 0,
      msg,
      level: getLogLevel(msg)
    };
    logEntries.push(normalized);
  });

  if (logEntries.length > MAX_LOG_ENTRIES) {
    logEntries = logEntries.slice(logEntries.length - MAX_LOG_ENTRIES);
  }
}

function downloadLogs() {
  const lines = getFilteredEntries().map(entryToLine).join('\n');
  const blob = new Blob([`${lines}\n`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `esp32-console-${stamp}.log`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function pollConsoleLogs() {
  if (isPaused || document.hidden || pollInFlight) return;
  pollInFlight = true;
  try {
    const response = await fetch(`/console/logs?since=${lastLogId}`);
    if (!response.ok) throw new Error(`Console fetch failed (${response.status})`);
    const data = await response.json();
    const logs = Array.isArray(data.logs) ? data.logs : [];
    const prevLastLogId = lastLogId;
    const prevCount = logEntries.length;

    addLogEntries(logs);
    logs.forEach((entry) => {
      lastLogId = Math.max(lastLogId, Number(entry.id) || lastLogId);
    });
    lastLogId = Math.max(lastLogId, Number(data.nextId) || lastLogId);
    if (logs.length > 0 || lastLogId !== prevLastLogId || logEntries.length !== prevCount) {
      renderLogs();
    }
    setConnectionStatus(true);
  } catch (error) {
    elements.consoleMeta.textContent = 'Console disconnected. Retrying...';
    setConnectionStatus(false);
  } finally {
    pollInFlight = false;
  }
}

function startPolling() {
  if (pollTimer !== null) return;
  pollTimer = setInterval(pollConsoleLogs, CONSOLE_POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer === null) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

function init() {
  initializeTheme();
  updateClock();
  setInterval(updateClock, 1000);

  elements.themeToggle?.addEventListener('click', () => {
    const nextTheme = document.body.classList.contains('light-theme') ? 'dark' : 'light';
    setTheme(nextTheme);
  });

  elements.pauseBtn?.addEventListener('click', () => {
    isPaused = !isPaused;
    elements.pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    renderLogs();
  });

  elements.clearBtn?.addEventListener('click', () => {
    logEntries = [];
    lastRenderedSignature = '';
    renderLogs();
  });

  elements.downloadBtn?.addEventListener('click', downloadLogs);
  elements.levelFilter?.addEventListener('change', renderLogs);
  elements.searchInput?.addEventListener('input', renderLogs);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      pollConsoleLogs();
      startPolling();
    }
  });

  pollConsoleLogs();
  startPolling();
}

document.addEventListener('DOMContentLoaded', init);
})();

