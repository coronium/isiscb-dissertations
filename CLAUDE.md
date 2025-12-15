# CLAUDE.md - IsisCB Dissertations

## Project Overview

A web application suite for managing and exploring History of Science dissertation records (~10,000 records). Includes an **Editor** app for CRUD operations and an **Explorer** app for interactive data visualizations.

**Live URLs:**
- **Editor:** https://isiscb-dissertations.onrender.com
- **Explorer:** https://isiscb-dissertations-explorer.onrender.com
- **API:** https://isiscb-dissertations-api.onrender.com
- **Repository:** https://github.com/coronium/isiscb-dissertations
- **Database:** https://guswnhmbvgnspsdhsqby.supabase.co

## Current Status

**As of 2024-12-14:**
- ✅ Database schema deployed to Supabase
- ✅ 9,813 dissertation records imported from CSV
- ✅ API deployed to Render (production)
- ✅ Editor frontend deployed to Render (production)
- ✅ Explorer visualization app deployed to Render (production)
- ✅ Search functionality with separate name/school/title fields
- ✅ Advisor search working via database RPC functions
- ✅ Authority IDs linked to IsisCB (CBA* IDs)
- ✅ Soft delete with audit logging
- ✅ 8 interactive D3.js visualizations in Explorer
- ⏳ Editor login needs testing
- ⏳ Unit tests not yet written

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Frontend Apps                                 │
├──────────────────────────────┬──────────────────────────────────────────┤
│   Editor (Vanilla JS)        │   Explorer (Vanilla JS + D3.js)          │
│   - CRUD operations          │   - 8 interactive visualizations         │
│   - Search/filter            │   - Pre-computed JSON snapshots          │
│   - Authority management     │   - Animated charts and maps             │
└──────────────────────────────┴──────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │   API (Node.js/Express)          │
                    │   - Authentication               │
                    │   - Dissertations CRUD           │
                    │   - Explorer snapshot endpoints  │
                    └─────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │   Database (Supabase PostgreSQL) │
                    └─────────────────────────────────┘
```

## Quick Reference

### Running Locally

```bash
# API (from api/ directory)
npm install && npm run dev   # Runs on http://localhost:3000

# Editor - just open in browser or serve
open frontend/index.html
cd frontend && npx serve .

# Explorer - serve static files
cd explorer && npx serve .   # Runs on http://localhost:3000 (or next available)
```

### Importing Data

```bash
# Import dissertations from CSV (handles multi-line quoted values)
cd api && node scripts/import-csv.js ../data/Dissertations-2025.12.14-1.csv
```

### Database

- **Provider:** Supabase PostgreSQL
- **URL:** https://guswnhmbvgnspsdhsqby.supabase.co
- **Tables:** dissertations, authorities_persons, authorities_institutions, audit_log, authority_sequences
- **Migrations:** `data/migrations/`
- **Records:** 9,813 dissertations imported

## Project Structure

```
isiscb-dissertations/
├── api/
│   ├── src/
│   │   ├── routes/              # Express route handlers (incl. explorer.js)
│   │   ├── middleware/          # Auth, validation middleware
│   │   ├── services/            # Business logic
│   │   ├── models/              # Database queries
│   │   └── utils/               # Helpers, constants
│   ├── scripts/
│   │   └── generate-explorer-snapshots.js  # CLI snapshot generator
│   ├── tests/
│   └── package.json
├── frontend/                    # Editor app
│   ├── index.html
│   ├── styles/
│   │   ├── isiscb-base.css      # IsisCB UI standards (don't modify)
│   │   └── app.css              # Project-specific styles
│   ├── scripts/
│   │   ├── app.js               # Main entry point
│   │   ├── api.js               # API client
│   │   ├── auth.js              # Authentication
│   │   ├── search.js            # Search/list functionality
│   │   ├── editor.js            # Add/edit forms
│   │   └── components/          # Reusable UI components
│   └── pages/
├── explorer/                    # Explorer visualization app
│   ├── index.html
│   ├── styles/
│   │   ├── isiscb-base.css      # IsisCB UI standards
│   │   └── explorer.css         # Explorer-specific styles
│   ├── scripts/
│   │   ├── config.js            # Config (API URL, school colors)
│   │   ├── api.js               # API client
│   │   ├── auth.js              # Authentication
│   │   ├── state.js             # Centralized state management
│   │   ├── app.js               # Main entry point
│   │   ├── charts/              # D3.js visualizations
│   │   │   ├── timeline.js      # Dissertations over time
│   │   │   ├── schoolComparison.js  # Multi-school comparison
│   │   │   ├── pareto.js        # School distribution
│   │   │   ├── topShare.js      # Market concentration
│   │   │   ├── bumpChart.js     # School rankings
│   │   │   ├── streamgraph.js   # School output streams
│   │   │   ├── geoMap.js        # Geographic distribution
│   │   │   └── racingBar.js     # Top schools race
│   │   ├── components/          # UI components
│   │   ├── data/                # School location data
│   │   └── utils/               # Formatters, transforms
│   ├── data/                    # Pre-computed JSON snapshots
│   │   ├── timeline.json
│   │   ├── schools.json
│   │   ├── statistics.json
│   │   ├── school_timeseries.json
│   │   └── meta.json
│   └── CLAUDE.md                # Explorer-specific docs
├── data/
│   └── migrations/              # SQL migration files
├── SPECIFICATION.md             # Detailed technical spec
├── render.yaml                  # Render deployment config
└── CLAUDE.md                    # This file
```

## Key Documentation

- **Full Specification:** `SPECIFICATION.md` in this directory
- **IsisCB UI Standards:** `/Users/alex/.claude/skills/isiscb-ui-standards.md`
- **Dissertation Data Schema:** `/Users/alex/.claude/skills/dissertations-data/SKILL.md`

## Authentication

| User Type | Credentials | Permissions |
|-----------|-------------|-------------|
| Viewer | Access code: `1913` | Search, view, export |
| Editor: AX | Username + password | Full CRUD |
| Editor: SPW | Username + password | Full CRUD |
| Editor: Vieth | Username + password | Full CRUD |

Passwords are stored as bcrypt hashes in environment variables.

## Authority ID System

| Prefix | Source | Example |
|--------|--------|---------|
| CBA | IsisCB (imported) | CBA000043359 |
| AX- | Editor AX created | AX-1000 |
| SPW- | Editor SPW created | SPW-1001 |
| Vieth- | Editor Vieth created | Vieth-1002 |
| *-INST- | Institution authorities | SPW-INST-1000 |

**Important:** New authority sequences start at 1000 to avoid conflicts with existing AX- IDs.

## Key Business Rules

1. **Required Fields for New Records:** author_name, title (validated at API level, not database)
2. **Optional Fields:** Most fields are nullable to accommodate legacy data import
3. **Year Validation:** 1800 to current year +1, warn but allow override for outliers
4. **Degree Type:** Defaults to 'PhD' if not specified
5. **Soft Delete:** Records are never hard deleted; require reason for deletion
6. **Audit Trail:** All changes logged with editor, timestamp, and field-level diffs
7. **Duplicate Author Warning:** Modal shown when author already has dissertation(s)
8. **[unknown] Values:** Allowed for title, school, advisor - skips authority linking

### Database Constraints Relaxed for Import
The following fields had NOT NULL constraints removed to allow importing legacy data as-is:
- `title` - some records have missing/placeholder titles
- `author_name` - handled at application level
- `subject_broad` - many legacy records lack this
- `root_dissertation` - many legacy records lack this
- `source_notes` - many legacy records lack this

## Predefined Values

### Subject Broad
History of Science, History of Medicine, History of Technology, Philosophy, Philosophy of Science, History, Science, Medicine, Engineering, Social Science, Humanities, Librarianship, NONE

### Department Broad (placeholders)
History, History of Science, History of Medicine, History and Philosophy of Science (HPS), Philosophy, Science (general), Physics, Chemistry, Biology, Medicine, Engineering, Sociology / STS, Library Science, Other, Unknown

### Degree Types
PhD (default), MD, MLIS, BPhil, ScD, MA, MS, Other

### Root Dissertation
Yes, No

## API Endpoints Quick Reference

```
# Authentication
POST /api/auth/viewer              # Viewer login (access code)
POST /api/auth/login               # Editor login

# Dissertations (Editor app)
GET  /api/dissertations            # Search/list (with query params)
GET  /api/dissertations/schools/suggest  # School name autocomplete
GET  /api/dissertations/:id        # Get single record
POST /api/dissertations            # Create (editor only)
PUT  /api/dissertations/:id        # Update (editor only)
DELETE /api/dissertations/:id      # Soft delete (editor only)

# Authorities
GET  /api/authorities/persons      # Search people
POST /api/authorities/persons      # Create person authority

# Export
GET  /api/export/csv               # Export all data
POST /api/export/csv               # Export filtered results

# Explorer (visualization app)
GET  /api/explorer/snapshot/meta   # Snapshot metadata
POST /api/explorer/refresh-snapshot  # Regenerate snapshots (editor only)
GET  /api/explorer/schools/compare # Time series for selected schools
```

### Search Query Parameters

| Parameter | Description |
|-----------|-------------|
| `q` | Name search term (author and/or advisors) |
| `name_scope` | `all` (authors+advisors), `authors`, `advisors_committee` |
| `school_search` | School name filter |
| `title_search` | Title filter |
| `department_broad` | Department category filter |
| `subject_broad` | Subject category filter |
| `root_dissertation` | `any`, `yes`, `no` |
| `year_from`, `year_to` | Year range filter |
| `page`, `limit` | Pagination |
| `sort`, `order` | Sorting (`year`, `author_name`, `title`, `school`) |

## UI Patterns

Follow IsisCB UI Standards. Key patterns:

- **Colors:** Deep space blue (#173753), Sky reflection (#6daedb), Blue bell (#2892d7)
- **Font:** Inter (Google Fonts)
- **Autocomplete:** Use for all searchable fields (names, institutions)
- **Tables:** Default view, with inline row expansion for details
- **Forms:** Grouped sections, clear labels, validation feedback

## Common Tasks

### Adding a New Field
1. Add column to database schema in `SPECIFICATION.md`
2. Add SQL migration in `data/migrations/`
3. Update API model and routes
4. Update frontend form and display
5. Add validation rules
6. Update CSV export

### Adding a New Predefined Value
1. Update the constant array in `api/src/utils/constants.js`
2. Update frontend dropdown options
3. Document in `SPECIFICATION.md`

### Importing Data
1. Place CSV in `data/` directory
2. Run import script: `cd api && node scripts/import.js <filename>`
3. Verify in Supabase dashboard

## Environment Variables

### API (.env)
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
JWT_SECRET=
VIEWER_ACCESS_CODE_HASH=
EDITOR_AX_PASSWORD_HASH=
EDITOR_SPW_PASSWORD_HASH=
EDITOR_VIETH_PASSWORD_HASH=
NODE_ENV=
PORT=
```

### Frontend (config.js)
```javascript
const CONFIG = {
    API_URL: 'https://isiscb-dissertations-api.onrender.com'
};
```

## Deployment

Deployed to Render via `render.yaml` (Blueprint):
- **API:** https://isiscb-dissertations-api.onrender.com (Node.js web service)
- **Editor:** https://isiscb-dissertations.onrender.com (Static site)
- **Explorer:** https://isiscb-dissertations-explorer.onrender.com (Static site)

Push to main branch triggers automatic deployment of all three services.

### Render Dashboard
- Blueprint: Connected to `coronium/isiscb-dissertations` GitHub repo
- Auto-deploy: Enabled on push to main

### Environment Variables (set in Render)
The API service requires these env vars (configured in Render dashboard):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- `JWT_SECRET` (auto-generated by Render)
- `VIEWER_ACCESS_CODE_HASH`
- `EDITOR_AX_PASSWORD_HASH`, `EDITOR_SPW_PASSWORD_HASH`, `EDITOR_VIETH_PASSWORD_HASH`

## Related Projects

- **hsci-genealogy:** Read-only genealogy visualization (uses same data, will be updated to use this database)
- **IsisCB:** Main bibliography database at data.isiscb.org

## Testing Checklist

Production deployed - verify these work:
- [x] Viewer login works (access code: 1913)
- [ ] Editor login works for all 3 editors (AX, SPW, Vieth)
- [ ] CRUD operations work correctly
- [ ] Audit log captures changes
- [x] Search/list displays records correctly
- [x] Name search works (authors, advisors, combined)
- [x] School search with autocomplete works
- [x] Title search works
- [x] Search filters work (department, subject, root, year)
- [x] Clear button resets all search fields
- [ ] CSV export includes all columns
- [ ] Unsaved changes warning fires
- [ ] Authority autocomplete searches all sources
- [ ] New authority IDs increment correctly (starting from 1000)
- [x] Soft delete hides records from search (no UI to view deleted yet)

## Implementation Notes

### Data Import (2024-12-14)
- Imported 9,813 unique dissertation records from `data/Dissertations-2025.12.14-1.csv`
- 32 duplicate IDs in source CSV were skipped (first occurrence kept)
- CSV parser rewritten to handle multi-line quoted values
- Import script: `api/scripts/import-csv.js`

### Schema Changes from Original Spec
- Removed NOT NULL constraints on several fields to allow legacy data import
- Fields are validated at API level for new records, not at database level

### CORS Configuration
- Development: All origins allowed (`origin: true`)
- Production: Restricted to Render domain

### Frontend Config
- Handles `file://` protocol for local development
- Auto-detects localhost vs production for API URL

### Database Functions (RPC)
Two PostgreSQL functions were added to enable JSONB text search for advisors:

```sql
-- Search both authors and advisors
search_dissertations_combined(search_term, p_limit, p_offset)

-- Search advisors only
search_dissertations_advisors(search_term, p_limit, p_offset)
```

These are called via Supabase RPC because PostgREST doesn't support `::text` casts in filter expressions.

### Search UI Features
- **Three separate search boxes:** Name (with scope dropdown), School (with autocomplete), Title
- **School autocomplete:** Shows matching schools with dissertation counts
- **Clear button:** Resets all search fields and filters
- **Clickable names:** Author, school, and advisor names in expanded view trigger searches
- **Linked authority IDs:** CBA* IDs link to IsisCB (https://data.isiscb.org/p/isis/authority/{id}/)

### Editor Form Changes
- Author section moved above Dissertation Information
- Department and Subject dropdowns start with "-- Select --" (no default)
