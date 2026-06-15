// ============================================================================
// Google Maps Scraper - Popup Script
// ============================================================================

const DOM = {
  activeToggle: document.getElementById('activeToggle'),
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.getElementById('statusText'),
  captureCount: document.getElementById('captureCount'),
  searchKeyword: document.querySelector('.keyword'),
  bulkScrapeBtn: document.getElementById('bulkScrapeBtn'),
  stopScrapeBtn: document.getElementById('stopScrapeBtn'),
  clearListBtn: document.getElementById('clearListBtn'),
  downloadJsonBtn: document.getElementById('downloadJsonBtn'),
  downloadCsvBtn: document.getElementById('downloadCsvBtn'),
  tableBody: document.getElementById('tableBody'),
  emptyState: document.getElementById('emptyState'),
  progressContainer: document.getElementById('progressContainer'),
  progressText: document.getElementById('progressText'),
  progressFill: document.getElementById('progressFill'),
  resultsTable: document.getElementById('resultsTable')
};

let results = [];
let isScraping = false;

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  loadResults();
  setupEventListeners();
  setupResize();
  updateUI();

  // Load captured names from content script
  const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { type: 'LOAD_CAPTURED' }, () => {
      // ignore error if content script not injected
    });
  }
});

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners() {
  DOM.activeToggle.addEventListener('change', (e) => {
    const active = e.target.checked;
    sendToContentScript({ type: 'ACTIVATE', active });
    updateStatusIndicator(active);
  });

  DOM.bulkScrapeBtn.addEventListener('click', () => {
    sendToContentScript({ type: 'BULK_SCRAPE' });
  });

  DOM.stopScrapeBtn.addEventListener('click', () => {
    sendToContentScript({ type: 'STOP_SCRAPE' });
  });

  DOM.clearListBtn.addEventListener('click', () => {
    if (confirm('Clear all collected data?')) {
      chrome.storage.local.set({ results: [] }, () => {
        results = [];
        updateUI();
      });
    }
  });

  DOM.downloadJsonBtn.addEventListener('click', downloadJSON);
  DOM.downloadCsvBtn.addEventListener('click', downloadCSV);
}

// ============================================================================
// Resize Handler
// ============================================================================

function setupResize() {
  const resizeHandle = document.getElementById('resizeHandle');
  if (!resizeHandle) return;

  let isResizing = false;
  let startX = 0;
  let startY = 0;
  let startWidth = 500;
  let startHeight = 600;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = window.innerWidth;
    startHeight = window.innerHeight;
    document.body.classList.add('resizing');
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    const newWidth = Math.max(350, startWidth + deltaX);
    const newHeight = Math.max(300, startHeight + deltaY);

    document.body.style.width = newWidth + 'px';
    document.body.style.height = newHeight + 'px';

    // Save preference
    chrome.storage.local.set({
      popupSize: { width: newWidth, height: newHeight }
    });
  });

  document.addEventListener('mouseup', () => {
    isResizing = false;
    document.body.classList.remove('resizing');
  });

  // Load saved size on startup
  chrome.storage.local.get(['popupSize'], ({ popupSize }) => {
    if (popupSize) {
      document.body.style.width = popupSize.width + 'px';
      document.body.style.height = popupSize.height + 'px';
    }
  });
}

// ============================================================================
// Communication
// ============================================================================

function sendToContentScript(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, message, () => {
        // ignore error if content script not present
      });
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PROGRESS') {
    isScraping = true;
    const { done, total, entry } = message;
    updateProgress(done, total);
    if (entry) {
      results.push(entry);
      addRowToTable(entry);
      updateCount();
    }
  } else if (message.type === 'SCRAPE_DONE') {
    isScraping = false;
    loadResults();
    updateUI();
  }
});

// ============================================================================
// UI Updates
// ============================================================================

function loadResults() {
  chrome.storage.local.get(['results'], ({ results: stored = [] }) => {
    results = stored;
    updateUI();
  });
}

function updateUI() {
  renderTable();
  updateCount();
  updateEmptyState();
  updateSearchKeyword();
  updateProgress(0, 0);
}

function renderTable() {
  DOM.tableBody.innerHTML = '';
  results.forEach(row => addRowToTable(row));
}

function addRowToTable(entry) {
  const row = document.createElement('tr');
  const phone = (entry.phone && entry.phone !== 'N/A') ? entry.phone : '-';
  let website = '-';
  if (entry.website && entry.website !== 'N/A' && entry.website.startsWith('http')) {
    const url = new URL(entry.website);
    website = url.hostname;
  }
  const status = getStatusBadge(entry);

  row.innerHTML = `
    <td title="${entry.name}">${truncate(entry.name, 20)}</td>
    <td title="${phone}">${truncate(phone, 15)}</td>
    <td title="${entry.website}"><a href="${entry.website}" target="_blank" style="color: #1a73e8; text-decoration: none; font-size: 11px;">${website}</a></td>
    <td>${status}</td>
  `;

  row.addEventListener('click', () => showDetails(entry));
  DOM.tableBody.appendChild(row);
}

function getStatusBadge(entry) {
  const hasPhone = entry.phone && entry.phone !== 'N/A';
  const hasWebsite = entry.website && entry.website !== 'N/A';
  const hasAddress = entry.address && entry.address !== 'N/A';
  const hasHours = entry.hours && entry.hours !== 'N/A';
  const hasReviews = entry.reviews && entry.reviews !== 'N/A';

  const completeFields = [hasPhone, hasWebsite, hasAddress, hasHours, hasReviews].filter(Boolean).length;

  let statusClass, statusText;
  if (completeFields >= 4) {
    statusClass = 'status-full';
    statusText = '✓ Complete';
  } else if (completeFields >= 2) {
    statusClass = 'status-basic';
    statusText = '◐ Partial';
  } else {
    statusClass = 'status-basic';
    statusText = '⏳ Basic';
  }

  return `<span class="status-badge ${statusClass}">${statusText}</span>`;
}

function showDetails(entry) {
  const details = `${entry.name}
Category: ${entry.category}
Rating: ${entry.rating}
Reviews: ${entry.reviews}
Address: ${entry.address}
Phone: ${entry.phone}
Website: ${entry.website}
Plus Code: ${entry.plusCode}
Hours: ${entry.hours}`;
  alert(details);
}

function updateCount() {
  const count = results.length;
  DOM.captureCount.textContent = `${count} captured`;
}

function updateEmptyState() {
  const isEmpty = results.length === 0;
  DOM.emptyState.style.display = isEmpty ? 'flex' : 'none';
  DOM.resultsTable.style.display = isEmpty ? 'none' : 'table';
}

function updateStatusIndicator(active) {
  DOM.activeToggle.checked = active;
  DOM.statusIndicator.className = active ? 'indicator active' : 'indicator inactive';
  DOM.statusText.textContent = active ? 'Active' : 'Inactive';
}

function updateSearchKeyword() {
  // Try to get keyword from the active tab's URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const url = new URL(tabs[0].url);
      const params = new URLSearchParams(url.search);
      const keyword = params.get('query') || params.get('q') || '-';
      DOM.searchKeyword.textContent = keyword;
    }
  });
}

function updateProgress(done, total) {
  if (total === 0) {
    DOM.progressContainer.style.display = 'none';
    DOM.bulkScrapeBtn.style.display = 'block';
    return;
  }

  isScraping = true;
  DOM.progressContainer.style.display = 'block';
  DOM.bulkScrapeBtn.style.display = 'none';
  DOM.progressText.textContent = `Scraping ${done} / ${total}...`;
  const percent = total > 0 ? (done / total) * 100 : 0;
  DOM.progressFill.style.width = percent + '%';
}

// ============================================================================
// Download Functions
// ============================================================================

function downloadJSON() {
  // Transform results to match CSV headers for consistency
  const transformed = results.map(r => ({
    'Name': r.name,
    'Category': r.category,
    'Rating': r.rating,
    'Reviews': r.reviews,
    'Address': r.address,
    'Phone': r.phone,
    'Website': r.website,
    'Plus Code': r.plusCode,
    'Hours': r.hours,
    'Keyword': r.keyword,
    'Captured At': r.capturedAt
  }));
  const blob = new Blob([JSON.stringify(transformed, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `maps-results-${Date.now()}.json`);
}

function downloadCSV() {
  const headers = ['Name', 'Category', 'Rating', 'Reviews', 'Address', 'Phone', 'Website', 'Plus Code', 'Hours', 'Keyword', 'Captured At'];
  const fieldMap = {
    'Name': 'name',
    'Category': 'category',
    'Rating': 'rating',
    'Reviews': 'reviews',
    'Address': 'address',
    'Phone': 'phone',
    'Website': 'website',
    'Plus Code': 'plusCode',
    'Hours': 'hours',
    'Keyword': 'keyword',
    'Captured At': 'capturedAt'
  };

  const rows = results.map(r =>
    headers.map(h => {
      const fieldName = fieldMap[h];
      const val = String(r[fieldName] || '');
      // Properly escape CSV: quote if contains comma, newline, or quote
      if (val.includes(',') || val.includes('\n') || val.includes('"')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  triggerDownload(blob, `maps-results-${Date.now()}.csv`);
}

function triggerDownload(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ============================================================================
// Utilities
// ============================================================================

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '...' : str;
}

console.log('[Maps Scraper Popup] Loaded');
