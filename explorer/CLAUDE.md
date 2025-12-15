# CLAUDE.md - IsisCB Dissertations Explorer

## Project Overview

A data visualization web app for exploring ~10,000 History of Science dissertation records. Provides interactive charts, statistics, and comparative analysis tools for researchers.

**Live URL:** https://isiscb-dissertations-explorer.onrender.com
**Repository:** https://github.com/coronium/isiscb-dissertations (monorepo with editor app)

## Architecture

```
Static Site (Vanilla JS + D3.js)  →  API (shared with editor)  →  Supabase PostgreSQL
         Render Static                  Render Web Service              Supabase
```

The explorer uses pre-computed JSON snapshots for fast loading, with API endpoints for dynamic school comparisons and snapshot regeneration.

## Quick Reference

### Running Locally

```bash
# Start API (from api/ directory)
cd ../api && npm run dev   # Runs on http://localhost:3000

# Serve explorer (from explorer/ directory)
npx serve .                # Or any static file server
```

### Regenerating Snapshots

```bash
# Via CLI script
cd ../api && node scripts/generate-explorer-snapshots.js

# Via API (editor auth required)
POST /api/explorer/refresh-snapshot
```

## Project Structure

```
explorer/
├── index.html              # Main app HTML
├── styles/
│   ├── isiscb-base.css     # IsisCB UI standards
│   └── explorer.css        # Explorer-specific styles
├── scripts/
│   ├── config.js           # Configuration (API URL, colors, options)
│   ├── api.js              # API client for snapshots and auth
│   ├── auth.js             # Authentication (viewer/editor)
│   ├── state.js            # Centralized state management with events
│   ├── app.js              # Main entry point
│   ├── charts/
│   │   ├── timeline.js     # Dissertations over time (area chart)
│   │   ├── schoolComparison.js  # Multi-school comparison (line chart)
│   │   ├── pareto.js       # School distribution (bar + cumulative)
│   │   └── topN.js         # Top N vs rest comparison
│   ├── components/
│   │   ├── controls.js     # Granularity toggle, year slider
│   │   ├── schoolSelector.js    # School search and selection
│   │   └── statisticsPanel.js   # Stats grid with filtered metrics
│   └── utils/
│       ├── dataTransforms.js    # Aggregation, Pareto, stats calculations
│       └── formatters.js        # Number, percent, date formatting
└── data/                   # Generated snapshots (committed to repo)
    ├── meta.json           # Snapshot metadata
    ├── timeline.json       # Year/5-year/decade aggregations
    ├── schools.json        # School counts and Pareto stats
    └── statistics.json     # Summary statistics
```

## Authentication

Same as editor app:
- **Viewer:** Access code `1913` (read-only access to visualizations)
- **Editor:** Username + password (can refresh snapshots)

## Visualizations

### P1: Core
1. **Dissertations Over Time** - Area chart with granularity toggle (Year/5-Year/Decade)
2. **School Comparison** - Select up to 5 schools, overlay time series

### P2: Distribution Analysis
3. **School Distribution (Pareto)** - Top 50 schools bar chart with cumulative percentage line, 80-20 reference
4. **Top Schools vs Rest** - Compare Top 10/25/50/100 against remaining schools

### P3: Statistics Dashboard
- Total dissertations (filtered by year range)
- Unique schools (all years)
- Selected year range
- Mean/Median per year (filtered)
- Gini coefficient (all years, measures concentration)
- HHI - Herfindahl-Hirschman Index (all years)
- Top 10 share (all years)
- Growth rates by decade (filtered)

### Placeholders (Limited Data)
- Department Breakdown - disabled, limited data coverage
- Subject Over Time - disabled, limited data coverage
- Academic Genealogy - coming in future release

## Controls

| Control | Description |
|---------|-------------|
| Time Granularity | Toggle: Year, 5-Year, Decade (default) |
| Year Range | Dual-handle slider (1878-2025) |
| Department | Placeholder dropdown (disabled) |
| Subject | Placeholder dropdown (disabled) |
| Refresh Data | Editor-only button to regenerate snapshots |

## Data Snapshots

Pre-computed JSON files for fast loading (~100KB total):

### meta.json
```json
{
  "generated_at": "2025-12-14T23:07:08.439Z",
  "record_count": 9813,
  "year_range": [1878, 2025],
  "school_count": 541
}
```

### timeline.json
- `by_year`: Array of `{year, count}` for each year
- `by_5year`: Array of `{period, start, count}` for 5-year intervals
- `by_decade`: Array of `{period, start, count}` for decades

### schools.json
- `schools`: Array of `{name, count, min_year, max_year}` sorted by count
- `pareto`: Top 10/25% counts, percentages, Gini coefficient

### statistics.json
- Total counts, year range
- Mean/median per year
- Growth rates by decade
- HHI, Gini, top N shares

## API Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/explorer/snapshot/meta` | Viewer+ | Snapshot metadata |
| POST | `/api/explorer/refresh-snapshot` | Editor | Regenerate all snapshots |
| GET | `/api/explorer/schools/compare?schools=Harvard,Yale` | Viewer+ | Time series for selected schools |

## State Management

Centralized in `state.js` with event-based updates:

```javascript
// State properties
State.timeGranularity  // 'year', '5year', 'decade'
State.yearRange        // [minYear, maxYear]
State.selectedSchools  // Array of school names (max 5)
State.topNMode         // '10', '25', '50', '100'
State.data             // Loaded snapshot data

// Events
'dataLoaded'        // Snapshots loaded
'granularityChange' // Time granularity changed
'yearRangeChange'   // Year slider moved
'schoolsChange'     // Schools selected/deselected
'topNModeChange'    // Top N toggle changed
```

## Libraries (CDN)

- **D3.js v7** - All chart rendering
- **noUiSlider v15** - Year range slider
- **Inter font** - Google Fonts

## Deployment

Configured in `render.yaml` as static site:
- Auto-deploys on push to main
- Serves from `explorer/` directory
- Cache headers: 1 hour for assets, no-cache for data files

## Key Implementation Details

### Initial Render Fix
Charts render after `showVisualizations()` makes containers visible, then `dataLoaded` is emitted again so D3 can calculate proper dimensions.

### Year Range Filtering
- Timeline chart and statistics recalculate based on selected year range
- School-based metrics (Gini, HHI) show full dataset (no per-school-per-year data in snapshots)

### Pagination for Snapshot Generation
Supabase limits queries to 1000 rows by default. The snapshot generator uses `.range()` pagination to fetch all ~10K records.

### Snapshot Workflow
1. Editor clicks "Refresh Data" button (or runs CLI script)
2. API fetches all dissertations and generates aggregated JSONs
3. Files written to `explorer/data/`
4. Editor commits and pushes to trigger Render deploy

## Common Tasks

### Adding a New Chart
1. Create `scripts/charts/newChart.js`
2. Add container in `index.html`
3. Initialize in `app.js` (call `NewChart.init()`)
4. Subscribe to relevant State events

### Adding a New Statistic
1. Add calculation in `dataTransforms.js`
2. Include in snapshot generation (`api/scripts/generate-explorer-snapshots.js` and `api/src/routes/explorer.js`)
3. Display in `statisticsPanel.js`

### Updating Snapshot Schema
1. Modify generation scripts (both CLI and API route)
2. Update consuming code (charts/components)
3. Regenerate snapshots
4. Commit new snapshot files

## Related Files

| File | Purpose |
|------|---------|
| `/api/src/routes/explorer.js` | API endpoints for explorer |
| `/api/scripts/generate-explorer-snapshots.js` | CLI snapshot generator |
| `/data/migrations/003_explorer_functions.sql` | PostgreSQL aggregation functions |
| `/render.yaml` | Deployment configuration |
