https://www.google.com/maps/place/EC+LANDSCAPING+LLC/@41.1811977,-112.3918233,11z/data=!4m10!1m2!2m1!1sxeriscape!3m6!1s0x87530f2cfdca3adf:0x82a1eda6e66ff9eb!8m2!3d41.1811977!4d-112.1034322!15sCgl4ZXJpc2NhcGVaCyIJeGVyaXNjYXBlkgETY29uY3JldGVfY29udHJhY3RvcpoBJENoZERTVWhOTUc5blMwVkpRMEZuVFVSM2QzVm1jM3BCUlJBQuABAPoBBAg9ECI!16s%2Fg%2F11k638rcqc?entry=ttu&g_ep=EgoyMDI2MDYxMC4wIKXMDSoASAFQAw%3D%3D

we want to be able to open up this page and for each business listed, extract relevant information such as name, address, phone number, and website.
the tricky part will clicking each item to get the detailed information, such as phone number and website. because they are under each business listing.

something like this, not the exact usage i'm after but like this:
```
(async () => {
  const SELECTORS = {
    listContainer: ['div[role="feed"]', '.m6QErb.DxyBCb'],
    listing: '.Nv2PK',
    listingName: '.qBF1Pd',
    clickTarget: 'a.hfpxzc',
    name: 'h1.DUwDvf',
    category: 'button[jsaction*="category"]',
    rating: '.F7nice span span[aria-hidden="true"]',
    address: 'button[data-item-id="address"]',
    website: 'a.CsEnBe[aria-label^="Website"]',
    phone: 'button[data-item-id^="phone:"] .Io6YTe, a[href^="tel:"] .Io6YTe',
    plusCode: 'button[data-item-id="oloc"]',
    hours: '.t39EBf'
  };

  // --- human-like timing helpers ---
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const listContainer = document.querySelector(SELECTORS.listContainer[0]) || document.querySelector(SELECTORS.listContainer[1]);
  if (!listContainer) {
    console.error("List container not found. Make sure you are in the search results view.");
    return;
  }

  const results = [];
  const listings = Array.from(document.querySelectorAll(SELECTORS.listing));
  console.log(`Found ${listings.length} listings. Starting deep extraction...`);

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    const initialName = listing.querySelector(SELECTORS.listingName)?.innerText.trim() || 'N/A';
    console.log(`[${i + 1}/${listings.length}] Extracting: ${initialName}`);

    // small pause before clicking, like deciding which to open
    await sleep(rand(400, 1200));

    const clickTarget = listing.querySelector(SELECTORS.clickTarget) || listing;
    clickTarget.click();

    // wait for the panel to load + "read" it — varies each time
    await sleep(rand(2200, 4800));

    const details = {
      "Name": document.querySelector(SELECTORS.name)?.innerText || initialName,
      "Category": document.querySelector(SELECTORS.category)?.innerText || 'N/A',
      "Rating": document.querySelector(SELECTORS.rating)?.innerText || 'N/A',
      "Reviews": Array.from(document.querySelectorAll('span, button')).find(el => el.innerText && el.innerText.includes(' reviews'))?.innerText || 'N/A',
      "Address": document.querySelector(SELECTORS.address)?.innerText || 'N/A',
      "Website": document.querySelector(SELECTORS.website)?.href || 'N/A',
      "Phone": document.querySelector(SELECTORS.phone)?.innerText || 'N/A',
      "Plus Code": document.querySelector(SELECTORS.plusCode)?.innerText || 'N/A',
      "Hours": document.querySelector(SELECTORS.hours)?.getAttribute('aria-label') || 'N/A'
    };
    results.push(details);

    // occasionally take a longer break, like a human getting distracted
    if (Math.random() < 0.15) {
      const longPause = rand(8000, 16000);
      console.log(`  ...taking a ${(longPause / 1000).toFixed(1)}s break`);
      await sleep(longPause);
    }

    if (i % rand(3, 6) === 0) listing.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  console.table(results);
  const json = JSON.stringify(results, null, 2);
  const el = document.createElement('textarea');
  el.value = json;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  console.log("Extraction complete! Full data copied to your clipboard.");
})();
```

in the above code, we are selecting various elements from the Google Maps search results and extracting details like name, category, rating, reviews, address, website, phone, plus code, and hours. The script simulates human-like behavior by adding random delays and scrolling, and finally copies the extracted data to the clipboard.