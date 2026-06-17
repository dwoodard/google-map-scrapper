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
let shouldScrollToBottom = true; // toggle for scroll behavior

// ============================================================================
// Utilities
// ============================================================================

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function sanitizeValue(value) {
  if (value === null || value === undefined) return 'N/A';
  const str = String(value).trim();
  if (str === '') return 'N/A';
  // Replace newlines and multiple spaces with single space, trim again
  return str.replace(/\s+/g, ' ').trim();
}

function sanitizeEntry(entry) {
  const sanitized = {};
  for (const [key, value] of Object.entries(entry)) {
    // Sanitize all string fields
    if (typeof value === 'string') {
      sanitized[key] = sanitizeValue(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function extractKeyword() {
  const url = window.location.href;

  // Try to extract search query from data parameter (e.g., "!1srock+landscaping+Davis+County!")
  // This handles when you're on a place detail page but searching for something
  const dataMatch = url.match(/!1s([^!]+)!/);
  if (dataMatch) {
    return decodeURIComponent(dataMatch[1].replace(/\+/g, ' '));
  }

  // Try to extract from /search/ path (e.g., "/maps/search/rock+landscaping+Davis+County/@35...")
  const searchMatch = url.match(/\/maps\/search\/([^/@]+)/);
  if (searchMatch) {
    return decodeURIComponent(searchMatch[1].replace(/\+/g, ' '));
  }

  // Try to extract from /place/ path (only if no search query found)
  const placeMatch = url.match(/\/maps\/place\/([^/@]+)/);
  if (placeMatch) {
    return decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
  }

  // Fallback: extract from page title (e.g., "rock landscaping Davis County - Google Maps")
  const title = document.title;
  const titleMatch = title.match(/^([^-]+)\s*-\s*Google Maps/);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  return 'unknown';
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

  // Check if listing is sponsored
  const panelContainer = document.querySelector(CONFIG.SELECTORS.panelContainer)
                      || document.querySelector(CONFIG.SELECTORS.panelContainerAlt);
  let isSponsored = false;
  if (panelContainer) {
    const sponsoredBadge = panelContainer.innerText?.toLowerCase().includes('sponsored');
    isSponsored = sponsoredBadge || false;
  }

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
    isSponsored,
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

function extractPlaceIdFromListing(listingEl) {
  // Try to extract place ID from the listing's href
  const clickTarget = listingEl.querySelector(CONFIG.SELECTORS.clickTarget);
  if (clickTarget && clickTarget.href) {
    const placeIdMatch = clickTarget.href.match(/0x[a-f0-9]+/i);
    if (placeIdMatch) return placeIdMatch[0];
  }
  return 'N/A';
}

function extractPartialListing(listingEl) {
  // Phase 1: Extract only reliable fields from listing card
  // Detailed fields (address, hours, status, coords, plus code) will be filled in Phase 2
  const name = listingEl.querySelector(CONFIG.SELECTORS.listingName)?.innerText?.trim() || 'N/A';
  const placeId = extractPlaceIdFromListing(listingEl);

  // Phone - reliable on listing cards
  let phone = 'N/A';
  const phoneEl = listingEl.querySelector('.UsdlK');
  if (phoneEl) phone = phoneEl.innerText.trim();

  // Website - look for website link
  let website = 'N/A';
  const websiteLink = listingEl.querySelector('a[aria-label*="website" i]');
  if (websiteLink && websiteLink.href) website = websiteLink.href;

  // Rating and reviews from aria-label
  let rating = 'N/A';
  let reviews = 'N/A';
  const ratingEl = listingEl.querySelector('[role="img"][aria-label*="star"]');
  if (ratingEl) {
    const ariaLabel = ratingEl.getAttribute('aria-label') || '';
    const ratingMatch = ariaLabel.match(/([\d.]+)\s+star/i);
    if (ratingMatch) rating = ratingMatch[1];
    const reviewsMatch = ariaLabel.match(/(\d+)\s+review/i);
    if (reviewsMatch) reviews = reviewsMatch[1];
  }

  // Leave unreliable fields for Phase 2 enrichment
  return {
    name,
    placeId,
    category: 'N/A',
    rating,
    reviews,
    address: 'N/A',
    website,
    phone,
    plusCode: 'N/A',
    hours: 'N/A',
    status: 'N/A',
    priceRange: 'N/A',
    latitude: 'N/A',
    longitude: 'N/A',
    mapsUrl: 'N/A',
    isSponsored: false,
    keyword: currentSessionKeyword,
    capturedAt: new Date().toISOString(),
    source: 'partial'
  };
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

async function loadCapturedNames() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['results'], ({ results = [] }) => {
      // Load all captured names and placeIds to skip duplicates efficiently
      capturedNames = new Set(results.map(r => r.name.toLowerCase()));
      console.log(`[Maps Scraper] Loaded ${results.length} existing results to check against`);
      resolve();
    });
  });
}

async function alreadyHasCompleteData(placeId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['results'], ({ results = [] }) => {
      const existing = results.find(r => r.placeId === placeId);
      if (!existing) {
        resolve(false);
        return;
      }
      // Check if it's complete (has phone, website, address, or hours - not just N/A)
      const isComplete = existing.source === 'bulk' || (
        (existing.phone && existing.phone !== 'N/A') ||
        (existing.website && existing.website !== 'N/A') ||
        (existing.address && existing.address !== 'N/A') ||
        (existing.hours && existing.hours !== 'N/A')
      );
      resolve(isComplete);
    });
  });
}

async function isAlreadyEnriched(placeId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['results'], ({ results = [] }) => {
      const existing = results.find(r => r.placeId === placeId);
      resolve(existing && existing.source === 'bulk');
    });
  });
}

async function scrollListingIntoView(targetPlaceId, targetName) {
  console.log(`[Maps Scraper] Scrolling listing into view: ${targetName} (${targetPlaceId})`);

  try {
    // Find the listing by placeId
    const listings = document.querySelectorAll(CONFIG.SELECTORS.listing);
    let targetListing = null;

    for (const listing of listings) {
      const placeId = extractPlaceIdFromListing(listing);
      if (placeId === targetPlaceId) {
        targetListing = listing;
        console.log(`[Maps Scraper] Found listing, scrolling into view...`);
        break;
      }
    }

    if (!targetListing) {
      console.log(`[Maps Scraper] Listing not found on page`);
      return;
    }

    // Scroll into view
    targetListing.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Highlight it temporarily
    const originalBg = targetListing.style.backgroundColor;
    targetListing.style.backgroundColor = 'rgba(26, 115, 232, 0.1)';
    targetListing.style.transition = 'background-color 0.3s';

    setTimeout(() => {
      targetListing.style.backgroundColor = originalBg;
    }, 2000);

    console.log(`[Maps Scraper] ✅ Scrolled listing into view`);
  } catch (err) {
    console.error('[Maps Scraper] Error scrolling listing:', err);
  }
}

async function enrichSingleResult(targetPlaceId, targetName, mapsUrl) {
  console.log(`[Maps Scraper] Attempting to enrich: ${targetName} (${targetPlaceId})`);
  console.log(`[Maps Scraper] Maps URL: ${mapsUrl}`);

  try {
    // Use the Google Maps URL directly if available
    if (mapsUrl && mapsUrl !== 'N/A') {
      console.log(`[Maps Scraper] 🔗 Using Google Maps URL to navigate...`);

      // Navigate to the place URL
      window.location.href = mapsUrl;

      // Wait for page to load - use longer timeout to ensure page loads
      console.log(`[Maps Scraper] ⏳ Waiting 7 seconds for page to load...`);
      await sleep(7000);

      // Extract and merge details
      const fullDetails = extractDetails();
      fullDetails.source = 'bulk';

      console.log(`[Maps Scraper] 📊 Extracted details from URL:`, {
        name: fullDetails.name,
        category: fullDetails.category,
        phone: fullDetails.phone,
        website: fullDetails.website,
        address: fullDetails.address,
        hours: fullDetails.hours,
        placeId: fullDetails.placeId
      });

      console.log(`[Maps Scraper] 💾 Merging entry to storage...`);
      await mergeEntry(fullDetails);
      console.log(`[Maps Scraper] 📤 Sending enrichment complete message...`);
      sendMessage({ type: 'ENRICHMENT_COMPLETE', entry: fullDetails });
      console.log(`[Maps Scraper] ✅ Single enrichment complete`);
      return;
    }

    // Check if detail panel is already open (user clicked listing manually)
    let panelContainer = document.querySelector(CONFIG.SELECTORS.panelContainer)
                      || document.querySelector(CONFIG.SELECTORS.panelContainerAlt);
    let waitedForPanel = false;

    if (panelContainer && document.querySelector(CONFIG.SELECTORS.name)) {
      console.log(`[Maps Scraper] ✅ Detail panel already open, extracting data now...`);
    } else {
      // Fallback: Find and click listing if panel not open
      console.log(`[Maps Scraper] ⏳ Panel not open, searching for listing...`);

      const listings = document.querySelectorAll(CONFIG.SELECTORS.listing);
      let targetListing = null;

      for (const listing of listings) {
        const placeId = extractPlaceIdFromListing(listing);
        if (placeId === targetPlaceId) {
          targetListing = listing;
          console.log(`[Maps Scraper] ✅ Found listing`);
          break;
        }
      }

      if (!targetListing) {
        console.log(`[Maps Scraper] ❌ Could not find listing with Place ID ${targetPlaceId}`);
        console.log(`[Maps Scraper] 💡 Try clicking the listing manually first, then click Fetch Data again`);
        return;
      }

      console.log(`[Maps Scraper] 🖱️ Clicking listing to open detail panel...`);

      // Scroll listing into view first
      targetListing.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(500);

      // Click the listing
      const clickTarget = targetListing.querySelector(CONFIG.SELECTORS.clickTarget) || targetListing;
      const clickHandler = (e) => {
        if (clickTarget.tagName === 'A') {
          e.preventDefault();
        }
      };
      clickTarget.addEventListener('click', clickHandler, true);
      clickTarget.click();
      clickTarget.removeEventListener('click', clickHandler, true);

      console.log(`[Maps Scraper] ⏳ Waiting for detail panel to load...`);
      await sleep(5000);
      waitedForPanel = true;
    }

    // Extract and merge details
    const fullDetails = extractDetails();
    fullDetails.source = 'bulk';

    console.log(`[Maps Scraper] 📊 Extracted details:`, {
      name: fullDetails.name,
      phone: fullDetails.phone,
      website: fullDetails.website,
      address: fullDetails.address,
      hours: fullDetails.hours
    });

    await mergeEntry(fullDetails);
    console.log(`[Maps Scraper] 📤 Sending ENRICHMENT_COMPLETE message:`, {
      name: fullDetails.name,
      source: fullDetails.source,
      placeId: fullDetails.placeId
    });
    sendMessage({ type: 'ENRICHMENT_COMPLETE', entry: fullDetails });
    console.log(`[Maps Scraper] ✅ Single enrichment complete`);
  } catch (err) {
    console.error('[Maps Scraper] Error enriching single result:', err);
  }
}

async function bulkScrape(options = {}) {
  isScraping = true;
  shouldScrollToBottom = options.scrollToBottom !== false;
  const statusFilter = options.statusFilter || 'all';
  currentSessionKeyword = extractKeyword(); // Capture keyword ONCE at start
  console.log(`[Maps Scraper] Starting bulk scrape for keyword: "${currentSessionKeyword}"`);
  console.log(`[Maps Scraper] Scroll to bottom: ${shouldScrollToBottom}`);
  console.log(`[Maps Scraper] Status filter: ${statusFilter}`);

  // Send current keyword to popup
  sendMessage({ type: 'KEYWORD_ACTIVE', keyword: currentSessionKeyword });

  // Load already-captured names from storage to avoid clicking duplicates
  await loadCapturedNames();

  try {
    // Phase 1: Scroll and collect all listings
    const listings = await phase1ScrollCollect();
    const total = listings.length;
    console.log(`[Maps Scraper] Found ${total} listings`);

    // Phase 2: Click each and extract details
    // Get fresh references each iteration to avoid stale DOM references
    for (let i = 0; i < total; i++) {
      if (!isScraping) break; // allow stop signal

      // Re-query the listing fresh - DOM changes during clicks
      const freshListings = document.querySelectorAll(CONFIG.SELECTORS.listing);
      if (i >= freshListings.length) {
        console.log(`[Maps Scraper] [${i + 1}/${total}] Listing no longer in DOM, skipping`);
        sendProgress(i + 1, total, null);
        continue;
      }

      const listing = freshListings[i];
      const name = listing.querySelector(CONFIG.SELECTORS.listingName)?.innerText?.trim() || 'N/A';
      const placeId = extractPlaceIdFromListing(listing);

      console.log(`[Maps Scraper] [${i + 1}/${total}] Processing: "${name}"`);

      // Skip based on filter
      if (statusFilter === 'pending' && placeId !== 'N/A' && await isAlreadyEnriched(placeId)) {
        console.log(`[Maps Scraper] ⏭️  Already attempted enrichment, skipping (filter: pending)`);
        sendProgress(i + 1, total, null);
        continue;
      }

      // For other filters, skip if we already have complete data
      if (statusFilter !== 'pending' && placeId !== 'N/A' && await alreadyHasCompleteData(placeId)) {
        console.log(`[Maps Scraper] ⏭️  Already have complete data, skipping`);
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
      const fullDetails = extractDetails();
      console.log(`[Maps Scraper] ✅ Extracted: "${fullDetails.name}" | Phone: ${fullDetails.phone} | Website: ${fullDetails.website}`);
      fullDetails.source = 'bulk';
      markCaptured(fullDetails.name);
      await mergeEntry(fullDetails);

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

      // Send current page listings to keep it updated during Phase 2
      const listings = document.querySelectorAll(CONFIG.SELECTORS.listing);
      const pageListings = Array.from(listings).map(listing => extractPlaceIdFromListing(listing)).filter(id => id !== 'N/A');
      sendMessage({ type: 'PAGE_LISTINGS', placeIds: pageListings });

      console.log(`[Maps Scraper] Entry placeId: ${fullDetails.placeId}`);
      sendProgress(i + 1, total, fullDetails);
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
      break;
    }

    prevCount = count;

    // Send current page listings to popup
    const pageListings = Array.from(listings).map(listing => extractPlaceIdFromListing(listing)).filter(id => id !== 'N/A');
    sendMessage({ type: 'PAGE_LISTINGS', placeIds: pageListings });

    // Only scroll if shouldScrollToBottom is enabled
    if (shouldScrollToBottom) {
      feed.scrollTop = feed.scrollHeight;
      await sleep(rand(CONFIG.SCROLL_DELAY_MIN_MS, CONFIG.SCROLL_DELAY_MAX_MS));
    } else {
      // Just a small delay to let content load without scrolling
      await sleep(rand(CONFIG.SCROLL_DELAY_MIN_MS / 2, CONFIG.SCROLL_DELAY_MAX_MS / 2));
    }
  }

  return Array.from(document.querySelectorAll(CONFIG.SELECTORS.listing));
}

// ============================================================================
// Storage & Communication
// ============================================================================

async function mergeEntry(fullDetails) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['results'], ({ results = [] }) => {
      const sanitized = sanitizeEntry(fullDetails);
      const placeId = sanitized.placeId;

      // Try to find existing partial with same placeId
      if (placeId && placeId !== 'N/A') {
        const existingIndex = results.findIndex(r => r.placeId === placeId);
        if (existingIndex !== -1) {
          // Update existing partial with full details
          results[existingIndex] = { ...results[existingIndex], ...sanitized };
          console.log(`[Maps Scraper] Merged details into existing partial: ${sanitized.name}`);
          chrome.storage.local.set({ results }, resolve);
          return;
        }
      }

      // No existing partial found, save as new complete entry
      results.push(sanitized);
      chrome.storage.local.set({ results }, resolve);
    });
  });
}

async function saveEntry(entry) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['results'], ({ results = [] }) => {
      const sanitized = sanitizeEntry(entry);
      // Check for duplicate by Place ID (unique identifier) instead of name
      const exists = results.some(r => r.placeId && r.placeId === sanitized.placeId);
      if (!exists) {
        results.push(sanitized);
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
  console.log(`[Maps Scraper] 📤 Sending progress: ${done}/${total} - ${entry?.name || 'N/A'}`);
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
      bulkScrape({
        scrollToBottom: message.scrollToBottom,
        statusFilter: message.statusFilter
      }).catch(err => console.error(err));
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
  } else if (message.type === 'ENRICH_SINGLE') {
    // Enrich a single result using Google Maps URL or by finding and clicking it
    enrichSingleResult(message.placeId, message.name, message.mapsUrl).catch(err => console.error(err));
    sendResponse({ success: true });
  } else if (message.type === 'SCROLL_TO_LISTING') {
    // Scroll a listing into view on the Maps page
    scrollListingIntoView(message.placeId, message.name).catch(err => console.error(err));
    sendResponse({ success: true });
  }
});

console.log('[Maps Scraper] Content script loaded');
