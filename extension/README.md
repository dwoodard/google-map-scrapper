# Google Maps Scraper Extension

A Chrome extension for scraping business listings from Google Maps search results.

## Files

- **manifest.json** — MV3 extension manifest
- **popup.html** — Extension popup UI structure
- **popup.js** — Popup logic, UI updates, storage, downloads
- **popup.css** — Styling for the popup
- **content.js** — Core scraping logic (runs in page context)

## How to Install (Dev Mode)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **"Load unpacked"**
4. Select this `extension/` folder
5. The extension icon should appear in your toolbar

## How to Use

1. Go to [Google Maps](https://www.google.com/maps)
2. Search for any keyword (e.g., "xeriscape", "pizza restaurants", etc.)
3. Click the extension icon to open the popup
4. **Option A (Passive)**: Toggle "Active" ON, then click individual listings naturally—data is captured automatically
5. **Option B (Bulk)**: Click "Scroll & Collect All" to automatically scroll through all listings and capture details
6. View collected results in the table
7. Download as JSON or CSV

## Features

- **Passive capture**: Auto-captures data when you click a listing
- **Bulk scrape**: Scrolls all results and clicks each one with human-like delays
- **Persistent storage**: Data saved in `chrome.storage.local`—survives browser restarts
- **Deduplication**: Won't re-capture the same business name
- **Multi-search**: Accumulate results from multiple searches (tagged by keyword)
- **Downloads**: Export as JSON or CSV
- **Human-like behavior**: Random delays, occasional long pauses to avoid bot detection

## Selectors Used (from goal.md)

The extension extracts:
- Name, Category, Rating, Review Count
- Address, Phone, Website, Plus Code
- Hours of operation
- Search keyword and capture timestamp

All selectors are configurable in `content.js` under `CONFIG.SELECTORS`.

## Debug

Open Chrome DevTools (`F12`) and check the Console for `[Maps Scraper]` log messages.
