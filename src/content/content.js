// ============================================================================
// Google Maps Scraper - Content Script
// ============================================================================

const CONFIG = {
  SELECTORS: {
    feedContainer: 'div[role="feed"]',
    feedContainerAlt: '.m6QErb.DxyBCb',
    listing: '.Nv2PK',
    listingName: '.qBF1Pd',
    clickTarget: 'a.hfpxzc',
    panelContainer: '.m6QErb[role="main"]',
    panelContainerAlt: 'div[role="main"]',
    name: 'h1.DUwDvf',
    category: 'button[jsaction*="category"]',
    rating: '.F7nice span span[aria-hidden="true"]',
    address: 'button[data-item-id="address"]',
    website: 'a.CsEnBe[aria-label^="Website"]',
    phone: 'button[data-item-id^="phone:"] .Io6YTe',
    plusCode: 'button[data-item-id="oloc"]',
    hours: '.t39EBf'
  },
  DEBOUNCE_MS: 800,
  MIN_DELAY_MS: 400,
  MAX_DELAY_MS: 1200,
  DETAIL_MIN_DELAY_MS: 2200,
  DETAIL_MAX_DELAY_MS: 4800,
  LONG_PAUSE_MIN_MS: 8000,
  LONG_PAUSE_MAX_MS: 16000,
  LONG_PAUSE_CHANCE: 0.15,
  SCROLL_DELAY_MIN_MS: 1500,
  SCROLL_DELAY_MAX_MS: 2800
};

// ============================================================================
// State
// ============================================================================

let isActiveListening = false;
let isScraping = false;
let panelObserver = null;
let debounceTimer = null;
let capturedNames = new Set(); // dedupe check
let currentSessionKeyword = 'unknown'; // persist keyword across entire scrape session

// ============================================================================
// Utilities
// ============================================================================

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function extractKeyword() {
  // Try to get keyword from URL or page title
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  const keyword = params.get('query') || params.get('q');
  if (keyword) return keyword;

  // Fallback: extract from page title (e.g., "xeriscape - Google Maps")
  const title = document.title;
  const match = title.match(/^([^-]+)\s*-\s*Google Maps/);
  return match ? match[1].trim() : 'unknown';
}

function extractCoordinates() {
  // Try to extract lat/lng from URL (format: @lat,lng,zoom)
  const url = window.location.href;
  const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (coordMatch) {
    return {
      latitude: coordMatch[1],
      longitude: coordMatch[2]
    };
  }
  return { latitude: 'N/A', longitude: 'N/A' };
}

function extractPlaceId() {
  // Try to extract place ID from URL (0x... format)
  const url = window.location.href;
  const placeIdMatch = url.match(/0x[a-f0-9]+/i);
  return placeIdMatch ? placeIdMatch[0] : 'N/A';
}

function extractMapsUrl() {
  // Return current Maps URL
  return window.location.href;
}

function extractOpenClosedStatus() {
  // Look for "Open now" or "Closed" text in the hours section
  const hoursEl = document.querySelector(CONFIG.SELECTORS.hours);
  if (!hoursEl) return 'N/A';

  const text = hoursEl.innerText?.toLowerCase() || '';
  const ariaLabel = hoursEl.getAttribute('aria-label')?.toLowerCase() || '';
  const fullText = text + ' ' + ariaLabel;

  if (fullText.includes('open now') || fullText.includes('currently open')) return 'Open';
  if (fullText.includes('closed') || fullText.includes('closes')) return 'Closed';
  if (fullText.includes('open 24')) return 'Open 24h';

  return 'N/A';
}

function extractPriceRange() {
  // Look for price indicator ($, $$, $$$, $$$$)
  const priceElements = Array.from(document.querySelectorAll('span, button, div'))
    .filter(el => {
      const text = el.innerText?.trim() || '';
      return /^\$+$/.test(text) && text.length <= 4;
    });

  if (priceElements.length > 0) {
    return priceElements[0].innerText.trim();
  }

  // Fallback: search for text like "Price: $$$"
  const allText = document.querySelector(CONFIG.SELECTORS.panelContainer)?.innerText || '';
  const priceMatch = allText.match(/\$+/);
  return priceMatch ? priceMatch[0] : 'N/A';
}

function extractDetails() {
  const name = document.querySelector(CONFIG.SELECTORS.name)?.innerText?.trim() || 'N/A';
  const category = document.querySelector(CONFIG.SELECTORS.category)?.innerText?.trim() || 'N/A';
  const rating = document.querySelector(CONFIG.SELECTORS.rating)?.innerText?.trim() || 'N/A';

  // Extract review count — search for patterns like "123 reviews" or "(123 reviews)"
  let reviews = 'N/A';
  const reviewSpans = Array.from(document.querySelectorAll('span'));
  for (const span of reviewSpans) {
    const text = span.innerText?.trim() || '';
    if (text.match(/^\d+\s*reviews?$/i) || text.match(/^\(\d+\s*reviews?\)$/i)) {
      reviews = text.replace(/[()]/g, '').trim();
      break;
    }
  }

  const address = document.querySelector(CONFIG.SELECTORS.address)?.innerText?.trim() || 'N/A';
  const website = document.querySelector(CONFIG.SELECTORS.website)?.href || 'N/A';
  const phone = document.querySelector(CONFIG.SELECTORS.phone)?.innerText?.trim() || 'N/A';

  // Plus Code extraction
  let plusCode = 'N/A';
  const plusEl = document.querySelector(CONFIG.SELECTORS.plusCode);
  if (plusEl) {
    const text = plusEl.innerText?.trim();
    plusCode = text && text !== '' ? text : 'N/A';
  }

  // Hours extraction
  let hours = 'N/A';
  const hoursEl = document.querySelector(CONFIG.SELECTORS.hours);
  if (hoursEl) {
    const ariaLabel = hoursEl.getAttribute('aria-label');
    if (ariaLabel) {
      hours = ariaLabel;
    } else {
      const text = hoursEl.innerText?.trim();
      if (text) hours = text;
    }
  }

  const coords = extractCoordinates();
  const status = extractOpenClosedStatus();
  const priceRange = extractPriceRange();
  const placeId = extractPlaceId();
  const mapsUrl = extractMapsUrl();

  return {
    name,
    category,
    rating,
    reviews,
    address,
    website,
    phone,
    plusCode,
    hours,
    status,
    priceRange,
    latitude: coords.latitude,
    longitude: coords.longitude,
    placeId,
    mapsUrl,
    keyword: currentSessionKeyword, // Use session keyword, not re-extracted
    capturedAt: new Date().toISOString(),
    source: 'unknown'
  };
}

function alreadyCaptured(name) {
  return capturedNames.has(name.toLowerCase());
}

function markCaptured(name) {
  capturedNames.add(name.toLowerCase());
}

// ============================================================================
// Passive Capture - Mutation Observer
// ============================================================================

function initPassiveCapture() {
  if (panelObserver) return;

  currentSessionKeyword = extractKeyword(); // Capture keyword when passive mode starts
  console.log(`[Maps Scraper] Passive capture activated for keyword: "${currentSessionKeyword}"`);

  const panelContainer = document.querySelector(CONFIG.SELECTORS.panelContainer)
                      || document.querySelector(CONFIG.SELECTORS.panelContainerAlt);

  if (!panelContainer) {
    console.warn('[Maps Scraper] Panel container not found');
    return;
  }

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const nameEl = document.querySelector(CONFIG.SELECTORS.name);
      if (nameEl && !alreadyCaptured(nameEl.innerText)) {
        const entry = extractDetails();
        entry.source = 'passive';
        markCaptured(entry.name);
        saveEntry(entry);
        console.log('[Maps Scraper] Captured:', entry.name);
      }
    }, CONFIG.DEBOUNCE_MS);
  });

  observer.observe(panelContainer, { childList: true, subtree: true });
  panelObserver = observer;
  console.log('[Maps Scraper] Passive capture initialized');
}

function stopPassiveCapture() {
  if (panelObserver) {
    panelObserver.disconnect();
    panelObserver = null;
    clearTimeout(debounceTimer);
    console.log('[Maps Scraper] Passive capture stopped');
  }
}

// ============================================================================
// Bulk Scrape
// ============================================================================

async function bulkScrape() {
  isScraping = true;
  currentSessionKeyword = extractKeyword(); // Capture keyword ONCE at start
  console.log(`[Maps Scraper] Starting bulk scrape for keyword: "${currentSessionKeyword}"`);

  try {
    // Phase 1: Scroll and collect all listings
    const listings = await phase1ScrollCollect();
    const total = listings.length;
    console.log(`[Maps Scraper] Found ${total} listings`);

    // Phase 2: Click each and extract details
    for (let i = 0; i < listings.length; i++) {
      if (!isScraping) break; // allow stop signal

      const listing = listings[i];
      const name = listing.querySelector(CONFIG.SELECTORS.listingName)?.innerText?.trim() || 'N/A';

      console.log(`[Maps Scraper] [${i + 1}/${total}] Processing: "${name}"`);

      if (alreadyCaptured(name)) {
        console.log(`[Maps Scraper] ⏭️  Already captured, skipping`);
        sendProgress(i + 1, total, null);
        continue;
      }

      // Human-like delay before clicking
      const delayBefore = rand(CONFIG.MIN_DELAY_MS, CONFIG.MAX_DELAY_MS);
      console.log(`[Maps Scraper] ⏳ Waiting ${delayBefore}ms before click...`);
      await sleep(delayBefore);

      const clickTarget = listing.querySelector(CONFIG.SELECTORS.clickTarget) || listing;
      const currentUrl = window.location.href;
      console.log(`[Maps Scraper] 🖱️  Clicking... (URL before: ${currentUrl.substring(0, 100)}...)`);

      // Prevent navigation to full page while allowing sidebar panel to load
      const clickHandler = (e) => {
        if (clickTarget.tagName === 'A') {
          e.preventDefault();
        }
      };
      clickTarget.addEventListener('click', clickHandler, true);
      clickTarget.click();
      clickTarget.removeEventListener('click', clickHandler, true);

      // Wait for panel to load
      const delayAfter = rand(CONFIG.DETAIL_MIN_DELAY_MS, CONFIG.DETAIL_MAX_DELAY_MS);
      console.log(`[Maps Scraper] ⏳ Waiting ${delayAfter}ms for panel to load...`);
      await sleep(delayAfter);

      const urlAfter = window.location.href;
      console.log(`[Maps Scraper] 📄 URL after click: ${urlAfter.substring(0, 100)}...`);

      // Extract details
      const entry = extractDetails();
      console.log(`[Maps Scraper] ✅ Extracted: "${entry.name}" | Phone: ${entry.phone} | Website: ${entry.website}`);
      entry.source = 'bulk';
      markCaptured(entry.name);
      await saveEntry(entry);

      // Occasional long pause
      if (Math.random() < CONFIG.LONG_PAUSE_CHANCE) {
        const pauseMs = rand(CONFIG.LONG_PAUSE_MIN_MS, CONFIG.LONG_PAUSE_MAX_MS);
        console.log(`[Maps Scraper] Taking ${(pauseMs / 1000).toFixed(1)}s pause...`);
        await sleep(pauseMs);
      }

      // Scroll listing into view periodically
      if (i % rand(3, 6) === 0) {
        listing.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      sendProgress(i + 1, total, entry);
    }
  } catch (err) {
    console.error('[Maps Scraper] Error during bulk scrape:', err);
  } finally {
    isScraping = false;
    sendMessage({ type: 'SCRAPE_DONE' });
    console.log('[Maps Scraper] Bulk scrape completed');
  }
}

async function phase1ScrollCollect() {
  const feed = document.querySelector(CONFIG.SELECTORS.feedContainer)
            || document.querySelector(CONFIG.SELECTORS.feedContainerAlt);

  if (!feed) {
    throw new Error('Feed container not found');
  }

  let prevCount = 0;
  while (isScraping) {
    const listings = document.querySelectorAll(CONFIG.SELECTORS.listing);
    const count = listings.length;

    if (count === prevCount) {
      // No new listings — stable
      break;
    }

    prevCount = count;
    feed.scrollTop = feed.scrollHeight;
    await sleep(rand(CONFIG.SCROLL_DELAY_MIN_MS, CONFIG.SCROLL_DELAY_MAX_MS));
  }

  return Array.from(document.querySelectorAll(CONFIG.SELECTORS.listing));
}

// ============================================================================
// Storage & Communication
// ============================================================================

async function saveEntry(entry) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['results'], ({ results = [] }) => {
      // Check for duplicate by name
      const exists = results.some(r => r.name.toLowerCase() === entry.name.toLowerCase());
      if (!exists) {
        results.push(entry);
        chrome.storage.local.set({ results }, resolve);
      } else {
        resolve();
      }
    });
  });
}

function sendMessage(message) {
  chrome.runtime.sendMessage(message, () => {
    // ignore errors if popup is closed
  });
}

function sendProgress(done, total, entry) {
  sendMessage({
    type: 'PROGRESS',
    done,
    total,
    entry
  });
}

// ============================================================================
// Message Listener
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Maps Scraper] Message received:', message.type);

  if (message.type === 'ACTIVATE') {
    if (message.active) {
      initPassiveCapture();
      isActiveListening = true;
    } else {
      stopPassiveCapture();
      isActiveListening = false;
    }
    sendResponse({ success: true });
  } else if (message.type === 'BULK_SCRAPE') {
    if (!isScraping) {
      bulkScrape().catch(err => console.error(err));
    }
    sendResponse({ success: true });
  } else if (message.type === 'STOP_SCRAPE') {
    isScraping = false;
    sendResponse({ success: true });
  } else if (message.type === 'LOAD_CAPTURED') {
    // Popup wants to know which names are already captured
    chrome.storage.local.get(['results'], ({ results = [] }) => {
      capturedNames = new Set(results.map(r => r.name.toLowerCase()));
      sendResponse({ count: results.length });
    });
    return true; // async response
  }
});

console.log('[Maps Scraper] Content script loaded');
