# CLAUDE.md - IsisCB Dissertations Explorer

## Project Overview

A data visualization web app for exploring ~10,000 History of Science dissertation records. Provides 8 interactive D3.js visualizations including animated charts, geographic maps, and comparative analysis tools for researchers.

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
├── index.html                  # Main app HTML
├── styles/
│   ├── isiscb-base.css         # IsisCB UI standards
│   └── explorer.css            # Explorer-specific styles
├── scripts/
│   ├── config.js               # Configuration (API URL, school colors)
│   ├── api.js                  # API client for snapshots and auth
│   ├── auth.js                 # Authentication (viewer/editor)
│   ├── state.js                # Centralized state management with events
│   ├── app.js                  # Main entry point
│   ├── charts/
│   │   ├── timeline.js         # Dissertations over time (area chart)
│   │   ├── schoolComparison.js # Multi-school comparison (line chart)
│   │   ├── pareto.js           # School distribution (bar + cumulative)
│   │   ├── topShare.js         # Market concentration over time
│   │   ├── bumpChart.js        # School rankings over time
│   │   ├── streamgraph.js      # School output streams
│   │   ├── geoMap.js           # Geographic distribution (US map)
│   │   └── racingBar.js        # Top schools racing bar chart
│   ├── components/
│   │   ├── controls.js         # Granularity toggle, year slider
│   │   └── schoolSelector.js   # School search and selection
│   ├── data/
│   │   └── schoolLocations.js  # Lat/lng for 50+ institutions
│   └── utils/
│       ├── dataTransforms.js   # Aggregation, Pareto, stats calculations
│       └── formatters.js       # Number, percent, date formatting
└── data/                       # Generated snapshots (committed to repo)
    ├── meta.json               # Snapshot metadata
    ├── timeline.json           # Year/5-year/decade aggregations
    ├── schools.json            # School counts and Pareto stats
    ├── statistics.json         # Summary statistics
    └── school_timeseries.json  # Year-by-year counts for top 50 schools
```

## Authentication

Same as editor app:
- **Viewer:** Access code `1913` (read-only access to visualizations)
- **Editor:** Username + password (can refresh snapshots)

## Visualizations

### 1. Dissertations Over Time
**File:** `charts/timeline.js`
- Area chart showing dissertation output over time
- Toggle between Year, 5-Year, and Decade granularity
- Year range slider filters the display

### 2. School Comparison
**File:** `charts/schoolComparison.js`
- Select up to 5 schools to compare side-by-side
- Toggle between absolute count and percentage of total
- Lines colored by school (using official school colors when available)
- Responds to year range and granularity controls

### 3. School Distribution (Pareto)
**File:** `charts/pareto.js`
- Bar chart of top 50 schools by dissertation count
- Cumulative percentage line overlay
- 80-20 reference line
- Updates when year range changes

### 4. Market Concentration Over Time
**File:** `charts/topShare.js`
- Shows percentage of dissertations from top N schools over time
- Toggle between Top 5, 10, 15, and 20
- Reference lines at 25%, 50%, 75%
- Uses 5-year intervals

### 5. School Rankings Over Time (Bump Chart)
**File:** `charts/bumpChart.js`
- Shows rank changes for top 15 schools (1950-2020)
- Based on 10-year rolling average
- Lines colored by school colors
- Labels at end of each line

### 6. School Output Streams (Streamgraph)
**File:** `charts/streamgraph.js`
- Flowing streams showing relative contribution of top 15 schools
- Uses D3 stack with wiggle offset
- Hover highlights individual streams
- 5-year rolling average smoothing

### 7. Geographic Distribution
**File:** `charts/geoMap.js`
- Animated US map with bubbles at school locations
- Bubble size = 10-year rolling average output
- Play/pause/reset controls with speed slider
- Covers 1950-2020
- Includes 50+ school locations (US + Toronto)
- Uses TopoJSON for real US state boundaries

### 8. Top Schools Race (Racing Bar Chart)
**File:** `charts/racingBar.js`
- Animated bar chart showing top 15 schools racing over time
- Based on 10-year rolling average
- Play/pause/reset controls with speed slider
- School colors for visual consistency
- Year display updates during animation

## Controls

| Control | Description |
|---------|-------------|
| Time Granularity | Toggle: Year, 5-Year, Decade (default) |
| Year Range | Dual-handle slider (1878-2025) |
| Refresh Data | Editor-only button to regenerate snapshots |

## Data Snapshots

Pre-computed JSON files for fast loading:

### meta.json
```json
{
  "generated_at": "2025-12-14T...",
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

### school_timeseries.json
- Year-by-year dissertation counts for top 50 schools
- Used by racing bar chart, geographic map, school comparison, bump chart, streamgraph

## School Colors

Official school colors are defined in `config.js` for 30+ major institutions:

```javascript
SCHOOL_COLORS: {
    'Harvard University': '#A51C30',
    'University of Pennsylvania': '#011F5B',
    'Princeton University': '#E77500',
    'University of Wisconsin, Madison': '#C5050C',
    // ... etc
}
```

Fallback colors are used for schools without defined colors.

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
State.data             // Loaded snapshot data

// Events
'dataLoaded'        // Snapshots loaded
'granularityChange' // Time granularity changed
'yearRangeChange'   // Year slider moved
'schoolsChange'     // Schools selected/deselected
```

## Libraries (CDN)

- **D3.js v7** - All chart rendering
- **TopoJSON Client v3** - US map geography
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
- Timeline chart, Pareto chart recalculate based on selected year range
- School comparison uses filtered year range
- Animated charts (racing bar, geo map) have their own time controls

### School Timeseries
Top 50 schools have year-by-year data for:
- School comparison chart
- Racing bar chart
- Geographic map
- Bump chart
- Streamgraph

### Geographic Projection
Uses `d3.geoAlbersUsa()` for continental US. Canadian schools (Toronto, York) are positioned manually in a separate box.

### Bubble Z-Order
Geographic map uses `bubblesGroup.raise()` to ensure bubbles always appear on top of the map elements.

## Common Tasks

### Adding a New Chart
1. Create `scripts/charts/newChart.js`
2. Add container in `index.html`
3. Initialize in `app.js` (call `NewChart.init()`)
4. Subscribe to relevant State events

### Adding a School Color
1. Add to `SCHOOL_COLORS` in `config.js`
2. Use official school brand color (hex)

### Adding a School Location
1. Add to `SCHOOL_LOCATIONS` in `scripts/data/schoolLocations.js`
2. Include `lat`, `lng`, and `city` properties
3. Add `exclude: true` for non-US/Canada schools

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
| `/render.yaml` | Deployment configuration |
