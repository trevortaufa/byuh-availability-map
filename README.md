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

## Refreshing

`.github/workflows/refresh-hours.yml` re-scrapes daily at 05:00 campus time and
commits `src/data/facilities.json`, which is what deploys. It commits even when
nothing changed, because `generatedAt` is what the freshness banner reads and
"checked today, nothing had changed" is the fact it needs to show.

Run it by hand from the Actions tab, or locally with `npm run scrape`.

## Scraper sources

| Source | Facilities | Notes |
|---|---|---|
| `library.byuh.edu` | Joseph F. Smith Library | Weekly hours + 17 dated holiday overrides |
| `seasidersports.byuh.edu` | Fitness Center, Cardio Room, Fitness Studio | Multi-interval days; cleaning gaps excluded |
| `foodservices.byuh.edu` | Banyan Dining Hall | All seven days. "Fast Sunday" and "Holidays" give times but no dates, so they go in the note, not the hours |

If a source breaks, the scraper keeps the previous entries and marks them `stale`
rather than dropping facilities off the map.

## Known gaps

- Coordinates in `src/data/coords.json` are placed by eye and all have
  `verified: false`. They need checking against the real campus map.
- Banyan's "Fast Sunday" and "Holidays" rows are surfaced as a note only. The
  page gives times without dates, so publishing them as hours would mean guessing
  which dates they land on.
- Fitness facility hours for a weekday hidden behind a holiday notice are carried
  over from the previous scrape, so they can lag a real change by one term
  boundary.
