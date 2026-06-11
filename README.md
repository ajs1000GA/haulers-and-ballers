# Haulers & Ballers

A React + Vite dashboard for a 1-800-GOT-JUNK franchise in Atlanta. It combines a competitive
leaderboard with a live daily route tracker using Google Sheets API v4.

## Features

- ESPN-style dark scoreboard aesthetic with orange and blue accents
- Dark/light mode toggle
- Mobile-responsive leaderboard and route cards
- MTD/QTD/YTD leaderboard controls
- Combined 0-100 teammate score:
  - Resi AJS: 45%
  - Residential Revenue: 30%
  - Google 9-10 Reviews %: 15%
  - Cancels + Complaints: 10% low-issue component
- Top 25% / middle 50% / bottom 25% badges
- Search by teammate name or position
- Expandable leaderboard rows and full profile modal
- Profile modal with full stats, achievements, rank, score, and trend chart
- Live Today route tracker for Westside `AW` and Eastside `AE` routes
- Team totals banner and 60-second auto-refresh
- Sample fallback data when the API key is still the placeholder

## Google Sheets sources

### Teammate Metrics

- Sheet ID: `14qEXnzL1W0xEL-DAZcf9ydAvxgVJERMEVjUkZgPwkm8`
- Tab: `2TM Metrics`
- Range used by the app: `'2TM Metrics'!D6:AH`

Expected columns:

| Column | Metric |
| --- | --- |
| D | Position |
| E | Teammate Name |
| F | Total Revenue |
| G | Total Jobs |
| H | AJS |
| I | Residential Revenue |
| J | Resi Jobs |
| K | Resi AJS |
| L | Revenue Per Hour |
| N | Google Reviews count |
| O | 9-10 Reviews % |
| W | Full Truck+ % |
| X | Resi Over 1K count |
| Y | Resi Over 1K % |
| AE | TTM Cancels count |
| AF | TTM Cancels % |
| AG | TTM Complaints count |
| AH | TTM Complaints % |

### Daily Routes

- Sheet ID: `1_C4jslS4QvS3UAllwx-tIf-suhWsGvlHdpzFdAGsYTM`
- Westside tab: `LIVE ROUTES`
- Eastside tab: `East Routes`

Each route column is parsed for:

- Route code: `AW1`, `AW2`, etc. for Westside and `AE1`, `AE2`, etc. for Eastside
- Teammate names: rows 4-6
- Truck number: row 10
- Total revenue: row 13
- Residential revenue: row 14
- Summary metrics from rows 58-84 where available

## Google Sheets API setup

1. In Google Cloud Console, enable **Google Sheets API**.
2. Create an API key.
3. Restrict the key to Google Sheets API and your deployed domain when possible.
4. Make sure the two Google Sheets are readable by the key. Common approaches:
   - Publish/read-only share the sheets as appropriate for your organization.
   - Use domain-level access if deployed behind an internal account boundary.
5. Create a local `.env` file:

```bash
VITE_GOOGLE_SHEETS_API_KEY=YOUR_GOOGLE_SHEETS_API_KEY
```

Replace `YOUR_GOOGLE_SHEETS_API_KEY` with the real key. The app intentionally falls back to sample
data until the placeholder is replaced.

## Local development

```bash
npm install
npm run dev
```

Then open the local Vite URL printed in your terminal.

## Production build

```bash
npm run build
npm run preview
```

## Deployment

Any static host that supports Vite apps works, including Netlify, Vercel, Cloudflare Pages, or S3.

General steps:

1. Set the environment variable `VITE_GOOGLE_SHEETS_API_KEY`.
2. Use `npm run build` as the build command.
3. Publish the `dist` directory.
4. Confirm the deployed domain is allowed by your Google API key restrictions.

## Notes

- The profile trend chart uses current leaderboard metrics as a baseline until dedicated historical
  monthly ranges are added to the sheet.
- Route green/red standards are defined in `src/App.jsx` and can be tuned as franchise standards
  change.
