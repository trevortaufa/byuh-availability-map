# BYUH Availability Map

What's open right now on the BYU–Hawaii campus. Mobile-first web app, hours scraped
from official byuh.edu pages.

```
npm install
npm run dev      # http://localhost:5173
npm run test     # open/closed logic + scraper parsing
npm run scrape   # refresh src/data/facilities.json (takes ~30s, see below)
```

## How it fits together

```
UI (map + list)
      |
      v
  getFacilities()        <-- src/data/source.js   the seam
      |
  facilities.json        <-- written by scripts/scrape
```

Nothing in `src/components` imports `facilities.json` directly. Everything goes
through `getFacilities()`. When this moves to a database and an admin screen,
that swap is one file.

## Two things that will bite you

**Time zone.** "Open now" is computed in `Pacific/Honolulu`, never the browser's
clock — see `src/lib/time.js`. Reading `new Date()` directly gives the wrong answer
for anyone off-island, and it looks correct the whole time you're developing in Hawaii.

**Crawl delay.** `byuh.edu/robots.txt` sets `Crawl-delay: 10`, so the scraper waits
10 seconds between requests. That's why a full run takes ~30s. Don't remove it.

## Scraper sources

| Source | Facilities | Notes |
|---|---|---|
| `library.byuh.edu` | Joseph F. Smith Library | Weekly hours + 17 dated holiday overrides |
| `seasidersports.byuh.edu` | Fitness Center, Cardio Room, Fitness Studio | Multi-interval days; cleaning gaps excluded |
| `foodservices.byuh.edu` | Banyan Dining Hall | **Mon–Fri only** — weekend hours aren't in a table and aren't parsed yet |

If a source breaks, the scraper keeps the previous entries and marks them `stale`
rather than dropping facilities off the map.

## Known gaps

- Coordinates in `scripts/scrape/coords.json` are placed by eye and all have
  `verified: false`. They need checking against the real campus map.
- Banyan weekend and holiday hours are unscraped.
- No scheduled refresh yet — `npm run scrape` is manual.
