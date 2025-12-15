# IsisCB Dissertations Editor - Technical Specification

## Project Overview

A web application for searching, viewing, adding, editing, and managing History of Science dissertation records. This system will become the authoritative source for dissertation data, replacing the current Google Sheets workflow.

**Repository:** https://github.com/coronium/isiscb-dissertations
**Editor:** https://isiscb-dissertations.onrender.com
**Explorer:** https://isiscb-dissertations-explorer.onrender.com
**API:** https://isiscb-dissertations-api.onrender.com
**Database:** Supabase PostgreSQL (https://guswnhmbvgnspsdhsqby.supabase.co)

---

## Implementation Status (2024-12-14)

### Completed
- ✅ Database schema deployed to Supabase
- ✅ 9,813 dissertation records imported
- ✅ API deployed to Render (auth, dissertations, authorities, export, explorer routes)
- ✅ Editor frontend deployed to Render (login, search/list, editor forms)
- ✅ Explorer visualization app deployed to Render (8 interactive D3.js charts)
- ✅ Viewer authentication working
- ✅ Search by name (authors/advisors), school (autocomplete), title
- ✅ PostgreSQL RPC functions for JSONB advisor search
- ✅ Clickable names/schools in detail view trigger searches
- ✅ CBA authority IDs link to IsisCB (data.isiscb.org)
- ✅ Soft delete with audit logging

### Pending
- ⏳ Editor authentication testing
- ⏳ Full CRUD testing
- ⏳ Unit tests
- ⏳ Authority data import (CBA persons/institutions)
- ⏳ UI to view/restore deleted records

### Changes from Original Spec
1. **Database constraints relaxed** - Removed NOT NULL from: `title`, `author_name`, `subject_broad`, `root_dissertation`, `source_notes` to allow legacy data import
2. **Validation moved to API** - Required fields enforced at API level for new records, not database level
3. **CSV parser rewritten** - Handles multi-line quoted values in source data

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│                   (Static Site on Render)                       │
│                 Vanilla JS + IsisCB UI Standards                │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Central API                               │
│                   (Node.js/Express on Render)                   │
│                                                                 │
│  • Authentication (access code + editor credentials)            │
│  • CRUD operations for dissertations                            │
│  • Authority management (people, institutions)                  │
│  • Audit trail logging                                          │
│  • Search and filtering                                         │
│  • Data export                                                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL                          │
│                                                                 │
│  Tables:                                                        │
│  • dissertations        • audit_log                             │
│  • authorities_persons  • authorities_institutions              │
│  • users                • sessions                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authentication

### User Types

| Type | Credentials | Permissions |
|------|-------------|-------------|
| Viewer | Access code: `1913` | Search, view, export |
| Editor: AX | Username + password | Full CRUD, view audit log |
| Editor: SPW | Username + password | Full CRUD, view audit log |
| Editor: Vieth | Username + password | Full CRUD, view audit log |

### Editor Credentials (to be hashed)

| Username | Password |
|----------|----------|
| AX | `Kj#9mPx$vL2nQw8R` |
| SPW | `Ht@4bNc&yF7sZd3W` |
| Vieth | `Xm!6pRv*eJ9qKf5G` |

### Login Flow

Single login page with two paths:
1. **Viewer access:** Enter access code only → limited UI (no edit controls)
2. **Editor access:** Enter username + password → full UI with CRUD controls

### Session Management

- JWT tokens stored in httpOnly cookies
- Session expiry: 24 hours for editors, 8 hours for viewers
- Include user type and username in token payload

---

## Database Schema

### Table: `dissertations`

```sql
-- NOTE: Several NOT NULL constraints were removed to allow legacy data import.
-- Validation is enforced at the API level for new records.
CREATE TABLE dissertations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id VARCHAR(20) UNIQUE NOT NULL,  -- COMB_XXXXXX format
    original_cb_id VARCHAR(20),              -- CBB... if from IsisCB
    original_vieth_id VARCHAR(50),

    -- Author
    author_name VARCHAR(255),                -- NOT NULL removed for import
    author_id VARCHAR(20),                   -- CBA, AX-, or NULL for [unknown]
    author_years VARCHAR(50),                -- e.g., "1917-1995"

    -- Dissertation
    title TEXT,                              -- NOT NULL removed for import
    year INTEGER,
    date_free_text VARCHAR(100),              -- For uncertain dates, e.g., "1953 or 54", "ca. 1960"
    degree_type VARCHAR(50) DEFAULT 'PhD',    -- PhD, MD, MLIS, BPhil, ScD, etc.

    -- Institution
    school VARCHAR(255),
    school_id VARCHAR(20),
    department_free_text VARCHAR(255),
    department_broad VARCHAR(100),

    -- Classification
    subject_broad VARCHAR(100),              -- NOT NULL removed for import
    root_dissertation VARCHAR(10),           -- NOT NULL removed for import; 'Yes', 'No'
    category TEXT,                           -- From IsisCB only, read-only
    category_id VARCHAR(20),

    -- Advisors (JSONB array for flexibility)
    advisors JSONB DEFAULT '[]',
    -- Format: [{"name": "...", "id": "...", "role": "Advisor|Committee Member"}, ...]

    -- Metadata
    source_notes TEXT,                       -- NOT NULL removed for import
    description TEXT,
    language_code VARCHAR(10),
    pages VARCHAR(50),
    dataset VARCHAR(100),

    -- Vieth-specific metadata
    vieth_url TEXT,
    vieth_abstract TEXT,
    vieth_place VARCHAR(255),
    vieth_extra TEXT,
    vieth_metadata TEXT,

    -- Record management
    merged_from_ids TEXT,
    change_log JSONB DEFAULT '[]',

    -- Soft delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(50),
    deleted_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(50),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR(50)
);

CREATE INDEX idx_dissertations_author ON dissertations(author_name);
CREATE INDEX idx_dissertations_year ON dissertations(year);
CREATE INDEX idx_dissertations_school ON dissertations(school);
CREATE INDEX idx_dissertations_subject ON dissertations(subject_broad);
CREATE INDEX idx_dissertations_root ON dissertations(root_dissertation);
CREATE INDEX idx_dissertations_deleted ON dissertations(is_deleted);
CREATE INDEX idx_dissertations_advisors ON dissertations USING GIN(advisors);
```

### Table: `authorities_persons`

```sql
CREATE TABLE authorities_persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authority_id VARCHAR(20) UNIQUE NOT NULL,  -- CBA..., AX-001, SPW-001, etc.
    name VARCHAR(255) NOT NULL,
    birth_year INTEGER,
    death_year INTEGER,
    source VARCHAR(50),  -- 'isiscb', 'manual'
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(50)
);

CREATE INDEX idx_persons_name ON authorities_persons(name);
CREATE INDEX idx_persons_authority ON authorities_persons(authority_id);
```

### Table: `authorities_institutions`

```sql
CREATE TABLE authorities_institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authority_id VARCHAR(20) UNIQUE NOT NULL,  -- CBA..., AX-SPW-INST-001, etc.
    name VARCHAR(255) NOT NULL,
    source VARCHAR(50),  -- 'isiscb', 'manual'
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(50)
);

CREATE INDEX idx_institutions_name ON authorities_institutions(name);
CREATE INDEX idx_institutions_authority ON authorities_institutions(authority_id);
```

### Table: `audit_log`

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id VARCHAR(20) NOT NULL,
    action VARCHAR(20) NOT NULL,  -- 'create', 'update', 'delete'
    editor VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    changes JSONB,  -- {field: {old: "...", new: "..."}, ...}
    reason TEXT     -- For deletions
);

CREATE INDEX idx_audit_record ON audit_log(record_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
```

### Table: `authority_sequences`

```sql
CREATE TABLE authority_sequences (
    prefix VARCHAR(20) PRIMARY KEY,  -- 'AX', 'SPW', 'Vieth', 'AX-INST', 'SPW-INST', 'Vieth-INST'
    next_value INTEGER DEFAULT 1000
);

-- Initialize sequences (starting at 1000 to avoid conflicts with existing AX- IDs)
INSERT INTO authority_sequences (prefix, next_value) VALUES
    ('AX', 1000), ('SPW', 1000), ('Vieth', 1000),
    ('AX-INST', 1000), ('SPW-INST', 1000), ('Vieth-INST', 1000);
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/viewer` | Verify access code, return viewer token |
| POST | `/api/auth/login` | Editor login, return editor token |
| POST | `/api/auth/logout` | Invalidate session |
| GET | `/api/auth/me` | Get current user info |

### Dissertations

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/dissertations` | Search/list dissertations | Viewer+ |
| GET | `/api/dissertations/:id` | Get single dissertation | Viewer+ |
| POST | `/api/dissertations` | Create dissertation | Editor |
| PUT | `/api/dissertations/:id` | Update dissertation | Editor |
| DELETE | `/api/dissertations/:id` | Soft delete dissertation | Editor |
| GET | `/api/dissertations/:id/changelog` | Get change log | Editor |

### Query Parameters for GET `/api/dissertations`

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search term |
| `name_scope` | enum | `all`, `authors`, `advisors_committee`, `advisors`, `committee` |
| `department_broad` | string | Filter by department category |
| `subject_broad` | string | Filter by subject |
| `root_dissertation` | enum | `yes`, `no`, `any` |
| `year_from` | integer | Minimum year |
| `year_to` | integer | Maximum year |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Results per page (default: 50) |
| `sort` | string | Sort field |
| `order` | enum | `asc`, `desc` |

### Authorities

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/authorities/persons` | Search persons | Viewer+ |
| POST | `/api/authorities/persons` | Create person authority | Editor |
| GET | `/api/authorities/institutions` | Search institutions | Viewer+ |
| POST | `/api/authorities/institutions` | Create institution authority | Editor |
| GET | `/api/authorities/persons/:id/dissertations` | Get dissertations for person | Viewer+ |

### Export

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/export/csv` | Export all data as CSV | Viewer+ |
| POST | `/api/export/csv` | Export search results as CSV | Viewer+ |

### Explorer (Visualization App)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/explorer/snapshot/meta` | Get snapshot metadata | Viewer+ |
| POST | `/api/explorer/refresh-snapshot` | Regenerate all JSON snapshots | Editor |
| GET | `/api/explorer/schools/compare` | Get time series for selected schools | Viewer+ |

---

## Predefined Values

### Subject Broad (Required)

```javascript
const SUBJECT_BROAD_OPTIONS = [
    'History of Science',
    'History of Medicine',
    'History of Technology',
    'Philosophy',
    'Philosophy of Science',
    'History',
    'Science',
    'Medicine',
    'Engineering',
    'Social Science',
    'Humanities',
    'Librarianship',
    'NONE'
];
```

### Department Broad (Required - Placeholder values)

```javascript
const DEPARTMENT_BROAD_OPTIONS = [
    'History',
    'History of Science',
    'History of Medicine',
    'History and Philosophy of Science (HPS)',
    'Philosophy',
    'Science (general)',
    'Physics',
    'Chemistry',
    'Biology',
    'Medicine',
    'Engineering',
    'Sociology / STS',
    'Library Science',
    'Other',
    'Unknown'
];
```

### Root Dissertation (Required)

```javascript
const ROOT_DISSERTATION_OPTIONS = ['Yes', 'No'];
```

### Degree Type (Default: PhD)

```javascript
const DEGREE_TYPE_OPTIONS = [
    'PhD',
    'MD',
    'MLIS',
    'BPhil',
    'ScD',
    'MA',
    'MS',
    'Other'
];
```

### Advisor Roles

```javascript
const ADVISOR_ROLES = ['Advisor', 'Committee Member'];
```

---

## UI Specification

**Reference:** Follow IsisCB UI Standards from `/Users/alex/.claude/skills/isiscb-ui-standards.md`

### Pages

1. **Login Page** (`/login`)
2. **Main Search/List Page** (`/`)
3. **Add Dissertation Page** (`/add`)
4. **Edit Dissertation Page** (`/edit/:id`)
5. **View Change Log Modal** (overlay)

### Login Page

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│            ━━━━━━━━━━━━                                         │
│            ━━━━━━━━                                             │
│            ━━━━━━━━━━━━━━                                       │
│                                                                 │
│            IsisCB Projects                                      │
│            DISSERTATIONS                                        │
│                                                                 │
│     ┌─────────────────────────────────────────────────────┐    │
│     │                                                     │    │
│     │  Access Code: [________________________]            │    │
│     │                                                     │    │
│     │              [Enter as Viewer]                      │    │
│     │                                                     │    │
│     │  ───────────── or sign in as editor ──────────────  │    │
│     │                                                     │    │
│     │  Username: [________________________]               │    │
│     │  Password: [________________________]               │    │
│     │                                                     │    │
│     │              [Sign In as Editor]                    │    │
│     │                                                     │    │
│     └─────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Main Search/List Page

```
┌─────────────────────────────────────────────────────────────────┐
│ ━━━  IsisCB Projects                              [AX ▼] Logout │
│ ━━   DISSERTATIONS                                              │
│ ━━━━                                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Search: [_______________________] 🔍   Scope: [All Names    ▼]  │
│                                                                 │
│ Filters:                                                        │
│ Department: [Any___________▼]  Subject: [Any___________▼]       │
│ Root Diss:  [Any▼]             Year: [____] to [____]           │
│                                                                 │
│ [+ Add New Dissertation]          [Export CSV ▼] Showing 1-50   │
│                                                of 9,845         │
├─────────────────────────────────────────────────────────────────┤
│ Author          │ Title                    │ Year │ School      │
│─────────────────┼──────────────────────────┼──────┼─────────────│
│ Smith, John     │ A History of Scienti...  │ 1995 │ Harvard     │ [▼]
│─────────────────┴──────────────────────────┴──────┴─────────────┴────
│ │ Full Title: A History of Scientific Instruments in the 18th...   │
│ │ Author: Smith, John (1942-2010) [CBA000012345]                   │
│ │ Year: 1995 | Degree: PhD                                         │
│ │ School: Harvard University [CBA000099999]                         │
│ │ Department: History of Science | Broad: History of Science       │
│ │ Subject: History of Science | Root Dissertation: No              │
│ │ Advisors:                                                        │
│ │   • Guerlac, Henry [CBA000011111] (Advisor)                      │
│ │   • Cohen, I. Bernard [CBA000022222] (Committee Member)          │
│ │                                              [Edit] [Delete]     │
│ └──────────────────────────────────────────────────────────────────┘
│ Jones, Mary     │ Scientific Revoluti...   │ 1987 │ Princeton   │ [▼]
│ Brown, David    │ Chemistry and Alchem...  │ 2001 │ Cambridge   │ [▼]
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                    [< Prev] Page 1 of 197 [Next >]              │
└─────────────────────────────────────────────────────────────────┘
```

**Viewer Mode:** Hide [+ Add New Dissertation], [Edit], [Delete] buttons

### Add/Edit Dissertation Page

```
┌─────────────────────────────────────────────────────────────────┐
│ ━━━  IsisCB Projects                              [AX ▼] Logout │
│ ━━   DISSERTATIONS                                              │
│ ━━━━                                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Add New Dissertation                            [Cancel] [Save] │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ ┌─ Dissertation Information ──────────────────────────────────┐ │
│ │                                                             │ │
│ │ Title *         [____________________________________________]│
│ │                 ☐ Use [unknown]                              │ │
│ │                                                             │ │
│ │ Year *          [____]  (1800-2026)                         │ │
│ │                                                             │ │
│ │ Date Notes      [____________________________]               │ │
│ │ (free text)     For uncertain dates: "1953 or 54", "ca. 1960"│ │
│ │                                                             │ │
│ │ Degree Type     [PhD_____________________________▼]         │ │
│ │                                                             │ │
│ │ School *        [____________________________] 🔍            │ │
│ │                 ☐ Use [unknown]                              │ │
│ │                 Selected: Harvard University [CBA000099999]  │ │
│ │                                                             │ │
│ │ Department      [____________________________]               │ │
│ │ (free text)                                                 │ │
│ │                                                             │ │
│ │ Dept Broad *    [History of Science_______________▼]        │ │
│ │                                                             │ │
│ │ Subject Broad * [History of Science_______________▼]        │ │
│ │                                                             │ │
│ │ Root Diss *     ○ Yes  ○ No                                 │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ Author ────────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │ Name *          [____________________________] 🔍            │ │
│ │                 Search by name or authority ID              │ │
│ │                                                             │ │
│ │                 ┌─ Suggestions ─────────────────────────┐   │ │
│ │                 │ Smith, John (1942-2010)   CBA000012345│   │ │
│ │                 │ Smith, John Henry         CBA000067890│   │ │
│ │                 │ Smith, Jonathan           AX-1001     │   │ │
│ │                 │ ─────────────────────────────────────│   │ │
│ │                 │ ➕ Create new: "Smith, John"         │   │ │
│ │                 └──────────────────────────────────────┘   │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ Advisors & Committee ──────────────────────────────────────┐ │
│ │                                                             │ │
│ │ 1. [____________________________] 🔍  [Advisor    ▼]   [✕] │ │
│ │    ☐ Use [unknown]                                         │ │
│ │                                                             │ │
│ │ 2. [____________________________] 🔍  [Committee  ▼]   [✕] │ │
│ │    ☐ Use [unknown]                                         │ │
│ │                                                             │ │
│ │ [+ Add Another Advisor]                                     │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ Metadata ──────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │ Source Notes *  [____________________________________________]│
│ │                                                             │ │
│ │ Description     [____________________________________________]│
│ │                                                             │ │
│ │ Language        [English_______________________▼]           │ │
│ │                                                             │ │
│ │ Pages           [________]                                  │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                                                 [Cancel] [Save] │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Duplicate Author Warning Modal

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ⚠ Existing Dissertation(s) Found                               │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  "Smith, John (1942-2010)" already has:                         │
│                                                                 │
│  • "A History of Scientific Instruments..." (1995, Harvard)     │
│  • "Studies in Early Modern Philosophy..." (1988, Princeton)    │
│                                                                 │
│  Are you sure you want to add another dissertation              │
│  for this person?                                               │
│                                                                 │
│                              [Cancel]  [Yes, Add Another]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Create New Authority Modal

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Create New Person Authority                                    │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Name:       Smith, John                                        │
│                                                                 │
│  Birth Year: [____] (optional)                                  │
│                                                                 │
│  Death Year: [____] (optional)                                  │
│                                                                 │
│  New ID:     SPW-1042                                           │
│                                                                 │
│                              [Cancel]  [Create Authority]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Delete Confirmation Modal

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Delete Dissertation                                            │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Are you sure you want to delete:                               │
│                                                                 │
│  "A History of Scientific Instruments in the 18th Century"      │
│  by Smith, John (1995)                                          │
│                                                                 │
│  Reason for deletion: *                                         │
│  [__________________________________________________________]   │
│                                                                 │
│  This action can be undone by an administrator.                 │
│                                                                 │
│                              [Cancel]  [Delete]                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Change Log Modal

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Change Log - COMB_001234                                  [✕]  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  2024-12-14 10:32 AM - SPW                                      │
│  ├─ title: "A History of..." → "A Complete History of..."       │
│  └─ year: 1994 → 1995                                           │
│                                                                 │
│  2024-12-10 03:15 PM - AX                                       │
│  └─ Created record                                              │
│                                                                 │
│  2024-12-08 11:20 AM - Vieth                                    │
│  └─ advisors: Added "Cohen, I. Bernard" as Committee Member     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Validation Rules

### Dissertation Fields

| Field | Required | Validation |
|-------|----------|------------|
| author_name | Yes | Non-empty string, or link to authority |
| title | Yes | Non-empty string, or `[unknown]` |
| year | Yes | Integer 1800 to current year +1, warn if outside bounds but allow override |
| date_free_text | No | Any string, for uncertain dates (e.g., "1953 or 54", "ca. 1960") |
| degree_type | No | Must be from predefined list, defaults to 'PhD' |
| school | Yes | Non-empty string or `[unknown]`, should link to authority |
| department_broad | Yes | Must be from predefined list |
| subject_broad | Yes | Must be from predefined list |
| root_dissertation | Yes | Must be 'Yes' or 'No' |
| source_notes | Yes | Non-empty string |
| department_free_text | No | Any string |
| description | No | Any string |
| language_code | No | Valid language code |
| pages | No | Any string |

### Authority Fields

| Field | Required | Validation |
|-------|----------|------------|
| name | Yes | Non-empty string |
| birth_year | No | Integer, reasonable range (1400-2025) |
| death_year | No | Integer, >= birth_year if both present |

---

## Implementation Steps

### Phase 1: Project Setup

1. **Create GitHub repository** `isiscb-dissertations`
2. **Initialize project structure:**
   ```
   isiscb-dissertations/
   ├── api/
   │   ├── src/
   │   │   ├── routes/
   │   │   ├── middleware/
   │   │   ├── services/
   │   │   ├── models/
   │   │   └── utils/
   │   ├── tests/
   │   ├── package.json
   │   └── .env.example
   ├── frontend/
   │   ├── index.html
   │   ├── styles/
   │   │   ├── isiscb-base.css
   │   │   └── app.css
   │   ├── scripts/
   │   │   ├── app.js
   │   │   ├── api.js
   │   │   ├── auth.js
   │   │   ├── search.js
   │   │   ├── editor.js
   │   │   └── components/
   │   └── pages/
   ├── data/
   │   └── migrations/
   ├── render.yaml
   └── README.md
   ```
3. **Set up Supabase project** and create database schema
4. **Configure Render services** (API + static site)

### Phase 2: Database & Data Import

5. **Create database tables** using schema above
6. **Import CBA Persons authorities** from CSV
7. **Import CBA Institutions authorities** from CSV
8. **Import existing dissertations** from CSV
9. **Verify data integrity** and create indexes

### Phase 3: API Development

10. **Implement authentication endpoints**
    - POST /api/auth/viewer
    - POST /api/auth/login
    - POST /api/auth/logout
    - GET /api/auth/me
11. **Implement dissertation CRUD endpoints**
    - GET /api/dissertations (with search/filter)
    - GET /api/dissertations/:id
    - POST /api/dissertations
    - PUT /api/dissertations/:id
    - DELETE /api/dissertations/:id
12. **Implement authority endpoints**
    - GET /api/authorities/persons
    - POST /api/authorities/persons
    - GET /api/authorities/institutions
    - POST /api/authorities/institutions
13. **Implement audit log endpoints**
    - GET /api/dissertations/:id/changelog
14. **Implement export endpoints**
    - GET /api/export/csv
    - POST /api/export/csv

### Phase 4: Frontend Development

15. **Set up base styles** (IsisCB UI standards)
16. **Build login page**
17. **Build main search/list page**
    - Search bar with scope selector
    - Filter controls
    - Results table with pagination
    - Inline expanded view
18. **Build add dissertation page**
    - Form with all field groups
    - Authority autocomplete components
    - Validation and error display
19. **Build edit dissertation page**
    - Pre-populated form
    - Change detection for unsaved warning
20. **Build modals**
    - Duplicate author warning
    - Create authority
    - Delete confirmation
    - Change log viewer

### Phase 5: Testing & Deployment

21. **Write and run unit tests**
22. **Write and run integration tests**
23. **Deploy to Render**
24. **Data validation and UAT**

### Phase 6: Future Enhancements (Placeholder)

25. Bulk import functionality
26. Bulk edit functionality

---

## Unit Tests

### API Tests

#### Authentication (`api/tests/auth.test.js`)

```javascript
describe('Authentication', () => {
    describe('POST /api/auth/viewer', () => {
        it('should accept valid access code', async () => {
            const res = await request(app)
                .post('/api/auth/viewer')
                .send({ accessCode: '1913' });
            expect(res.status).toBe(200);
            expect(res.body.userType).toBe('viewer');
        });

        it('should reject invalid access code', async () => {
            const res = await request(app)
                .post('/api/auth/viewer')
                .send({ accessCode: 'wrong' });
            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/auth/login', () => {
        it('should accept valid editor credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'AX', password: 'Kj#9mPx$vL2nQw8R' });
            expect(res.status).toBe(200);
            expect(res.body.userType).toBe('editor');
            expect(res.body.username).toBe('AX');
        });

        it('should reject invalid password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'AX', password: 'wrongpassword' });
            expect(res.status).toBe(401);
        });

        it('should reject unknown username', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'unknown', password: 'test' });
            expect(res.status).toBe(401);
        });
    });
});
```

#### Dissertations (`api/tests/dissertations.test.js`)

```javascript
describe('Dissertations API', () => {
    describe('GET /api/dissertations', () => {
        it('should return paginated results', async () => {
            const res = await authenticatedRequest('viewer')
                .get('/api/dissertations?page=1&limit=10');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(10);
            expect(res.body.pagination.total).toBeGreaterThan(0);
        });

        it('should filter by name search (all scopes)', async () => {
            const res = await authenticatedRequest('viewer')
                .get('/api/dissertations?q=Smith&name_scope=all');
            expect(res.status).toBe(200);
            // Should find in both authors and advisors
        });

        it('should filter by name search (authors only)', async () => {
            const res = await authenticatedRequest('viewer')
                .get('/api/dissertations?q=Smith&name_scope=authors');
            expect(res.status).toBe(200);
            res.body.data.forEach(d => {
                expect(d.author_name.toLowerCase()).toContain('smith');
            });
        });

        it('should filter by department_broad', async () => {
            const res = await authenticatedRequest('viewer')
                .get('/api/dissertations?department_broad=History of Science');
            expect(res.status).toBe(200);
            res.body.data.forEach(d => {
                expect(d.department_broad).toBe('History of Science');
            });
        });

        it('should filter by root_dissertation', async () => {
            const res = await authenticatedRequest('viewer')
                .get('/api/dissertations?root_dissertation=yes');
            expect(res.status).toBe(200);
            res.body.data.forEach(d => {
                expect(d.root_dissertation).toBe('Yes');
            });
        });

        it('should filter by year range', async () => {
            const res = await authenticatedRequest('viewer')
                .get('/api/dissertations?year_from=1990&year_to=2000');
            expect(res.status).toBe(200);
            res.body.data.forEach(d => {
                expect(d.year).toBeGreaterThanOrEqual(1990);
                expect(d.year).toBeLessThanOrEqual(2000);
            });
        });

        it('should require authentication', async () => {
            const res = await request(app).get('/api/dissertations');
            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/dissertations', () => {
        it('should create dissertation with valid data', async () => {
            const newDiss = {
                author_name: 'Test Author',
                author_id: 'CBA000012345',
                title: 'Test Dissertation Title',
                year: 2020,
                school: 'Test University',
                school_id: 'CBA000099999',
                department_broad: 'History of Science',
                subject_broad: 'History of Science',
                root_dissertation: 'No',
                source_notes: 'Test entry'
            };
            const res = await authenticatedRequest('editor', 'AX')
                .post('/api/dissertations')
                .send(newDiss);
            expect(res.status).toBe(201);
            expect(res.body.record_id).toMatch(/^COMB_/);
        });

        it('should reject missing required fields', async () => {
            const res = await authenticatedRequest('editor', 'AX')
                .post('/api/dissertations')
                .send({ title: 'Incomplete' });
            expect(res.status).toBe(400);
            expect(res.body.errors).toContain('author_name');
        });

        it('should reject viewer attempting to create', async () => {
            const res = await authenticatedRequest('viewer')
                .post('/api/dissertations')
                .send({ title: 'Test' });
            expect(res.status).toBe(403);
        });

        it('should validate year bounds with warning', async () => {
            const res = await authenticatedRequest('editor', 'AX')
                .post('/api/dissertations')
                .send({
                    author_name: 'Test',
                    title: 'Test',
                    year: 1750, // Before 1800
                    school: 'Test U',
                    department_broad: 'History',
                    subject_broad: 'History',
                    root_dissertation: 'No',
                    source_notes: 'Test'
                });
            expect(res.status).toBe(400);
            expect(res.body.warnings).toContain('year');
        });

        it('should allow year override with flag', async () => {
            const res = await authenticatedRequest('editor', 'AX')
                .post('/api/dissertations')
                .send({
                    author_name: 'Test',
                    title: 'Test',
                    year: 1750,
                    year_override: true,
                    school: 'Test U',
                    department_broad: 'History',
                    subject_broad: 'History',
                    root_dissertation: 'No',
                    source_notes: 'Test'
                });
            expect(res.status).toBe(201);
        });

        it('should create audit log entry', async () => {
            const res = await authenticatedRequest('editor', 'AX')
                .post('/api/dissertations')
                .send(validDissertation);

            const auditRes = await authenticatedRequest('editor', 'AX')
                .get(`/api/dissertations/${res.body.record_id}/changelog`);
            expect(auditRes.body[0].action).toBe('create');
            expect(auditRes.body[0].editor).toBe('AX');
        });

        it('should default degree_type to PhD', async () => {
            const res = await authenticatedRequest('editor', 'AX')
                .post('/api/dissertations')
                .send(validDissertationWithoutDegreeType);
            expect(res.status).toBe(201);
            expect(res.body.degree_type).toBe('PhD');
        });

        it('should accept custom degree_type', async () => {
            const res = await authenticatedRequest('editor', 'AX')
                .post('/api/dissertations')
                .send({ ...validDissertation, degree_type: 'MD' });
            expect(res.status).toBe(201);
            expect(res.body.degree_type).toBe('MD');
        });

        it('should accept date_free_text for uncertain dates', async () => {
            const res = await authenticatedRequest('editor', 'AX')
                .post('/api/dissertations')
                .send({ ...validDissertation, date_free_text: '1953 or 54' });
            expect(res.status).toBe(201);
            expect(res.body.date_free_text).toBe('1953 or 54');
        });
    });

    describe('PUT /api/dissertations/:id', () => {
        it('should update dissertation', async () => {
            const res = await authenticatedRequest('editor', 'SPW')
                .put('/api/dissertations/COMB_000001')
                .send({ title: 'Updated Title' });
            expect(res.status).toBe(200);
            expect(res.body.title).toBe('Updated Title');
        });

        it('should log changes to audit trail', async () => {
            await authenticatedRequest('editor', 'SPW')
                .put('/api/dissertations/COMB_000001')
                .send({ title: 'New Title', year: 1999 });

            const auditRes = await authenticatedRequest('editor', 'SPW')
                .get('/api/dissertations/COMB_000001/changelog');

            const lastEntry = auditRes.body[0];
            expect(lastEntry.changes.title.old).toBeDefined();
            expect(lastEntry.changes.title.new).toBe('New Title');
        });

        it('should reject viewer attempting to update', async () => {
            const res = await authenticatedRequest('viewer')
                .put('/api/dissertations/COMB_000001')
                .send({ title: 'Hacked' });
            expect(res.status).toBe(403);
        });
    });

    describe('DELETE /api/dissertations/:id', () => {
        it('should soft delete with reason', async () => {
            const res = await authenticatedRequest('editor', 'Vieth')
                .delete('/api/dissertations/COMB_000002')
                .send({ reason: 'Duplicate entry' });
            expect(res.status).toBe(200);

            // Verify soft deleted
            const getRes = await authenticatedRequest('editor', 'Vieth')
                .get('/api/dissertations/COMB_000002');
            expect(getRes.body.is_deleted).toBe(true);
        });

        it('should require deletion reason', async () => {
            const res = await authenticatedRequest('editor', 'Vieth')
                .delete('/api/dissertations/COMB_000002')
                .send({});
            expect(res.status).toBe(400);
        });

        it('should exclude deleted from default search', async () => {
            await authenticatedRequest('editor', 'AX')
                .delete('/api/dissertations/COMB_000003')
                .send({ reason: 'Test' });

            const searchRes = await authenticatedRequest('viewer')
                .get('/api/dissertations');
            const ids = searchRes.body.data.map(d => d.record_id);
            expect(ids).not.toContain('COMB_000003');
        });
    });
});
```

#### Authorities (`api/tests/authorities.test.js`)

```javascript
describe('Authorities API', () => {
    describe('GET /api/authorities/persons', () => {
        it('should search by name', async () => {
            const res = await authenticatedRequest('viewer')
                .get('/api/authorities/persons?q=Smith');
            expect(res.status).toBe(200);
            expect(res.body.length).toBeGreaterThan(0);
        });

        it('should search by authority ID', async () => {
            const res = await authenticatedRequest('viewer')
                .get('/api/authorities/persons?q=CBA000012345');
            expect(res.status).toBe(200);
            expect(res.body[0].authority_id).toBe('CBA000012345');
        });

        it('should include results from dissertations authors', async () => {
            // Authorities should include people who appear as authors
        });

        it('should include results from dissertations advisors', async () => {
            // Authorities should include people who appear as advisors
        });
    });

    describe('POST /api/authorities/persons', () => {
        it('should create new authority with sequential ID starting at 1000', async () => {
            const res = await authenticatedRequest('editor', 'SPW')
                .post('/api/authorities/persons')
                .send({ name: 'New Person', birth_year: 1950 });
            expect(res.status).toBe(201);
            expect(res.body.authority_id).toMatch(/^SPW-\d{4}$/);  // 4 digits, starting at 1000
        });

        it('should increment sequence per editor', async () => {
            const res1 = await authenticatedRequest('editor', 'AX')
                .post('/api/authorities/persons')
                .send({ name: 'Person 1' });
            const res2 = await authenticatedRequest('editor', 'AX')
                .post('/api/authorities/persons')
                .send({ name: 'Person 2' });

            const id1 = parseInt(res1.body.authority_id.split('-')[1]);
            const id2 = parseInt(res2.body.authority_id.split('-')[1]);
            expect(id2).toBe(id1 + 1);
        });
    });

    describe('GET /api/authorities/persons/:id/dissertations', () => {
        it('should return dissertations for person as author', async () => {
            const res = await authenticatedRequest('viewer')
                .get('/api/authorities/persons/CBA000012345/dissertations');
            expect(res.status).toBe(200);
            expect(res.body.as_author.length).toBeGreaterThanOrEqual(0);
        });

        it('should return dissertations for person as advisor', async () => {
            const res = await authenticatedRequest('viewer')
                .get('/api/authorities/persons/CBA000012345/dissertations');
            expect(res.body.as_advisor.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('POST /api/authorities/institutions', () => {
        it('should create institution authority with INST suffix starting at 1000', async () => {
            const res = await authenticatedRequest('editor', 'Vieth')
                .post('/api/authorities/institutions')
                .send({ name: 'New University' });
            expect(res.status).toBe(201);
            expect(res.body.authority_id).toMatch(/^Vieth-INST-\d{4}$/);  // 4 digits, starting at 1000
        });
    });
});
```

#### Export (`api/tests/export.test.js`)

```javascript
describe('Export API', () => {
    describe('GET /api/export/csv', () => {
        it('should export all data as CSV', async () => {
            const res = await authenticatedRequest('viewer')
                .get('/api/export/csv');
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('text/csv');
            expect(res.headers['content-disposition']).toContain('attachment');
        });

        it('should include all columns', async () => {
            const res = await authenticatedRequest('viewer')
                .get('/api/export/csv');
            const headers = res.text.split('\n')[0];
            expect(headers).toContain('ID');
            expect(headers).toContain('Author_Name');
            expect(headers).toContain('Title');
            // ... all expected columns
        });
    });

    describe('POST /api/export/csv', () => {
        it('should export filtered results', async () => {
            const res = await authenticatedRequest('viewer')
                .post('/api/export/csv')
                .send({
                    filters: {
                        year_from: 1990,
                        year_to: 2000
                    }
                });
            expect(res.status).toBe(200);
            // Verify only filtered records in export
        });
    });
});
```

### Frontend Tests

#### Authentication (`frontend/tests/auth.test.js`)

```javascript
describe('Authentication UI', () => {
    it('should show login page when not authenticated', () => {
        // Test redirect to login
    });

    it('should display viewer UI after access code login', () => {
        // Test viewer mode - no edit buttons
    });

    it('should display editor UI after editor login', () => {
        // Test editor mode - edit buttons visible
    });

    it('should show username in header for editors', () => {
        // Test header displays "AX", "SPW", or "Vieth"
    });

    it('should logout and redirect to login page', () => {
        // Test logout flow
    });
});
```

#### Search (`frontend/tests/search.test.js`)

```javascript
describe('Search UI', () => {
    it('should search by name with default scope', () => {
        // Test name search
    });

    it('should filter by name scope selection', () => {
        // Test scope dropdown
    });

    it('should filter by department broad', () => {
        // Test department filter
    });

    it('should filter by root dissertation', () => {
        // Test Yes/No/Any filter
    });

    it('should expand row to show extended view', () => {
        // Test inline expansion
    });

    it('should paginate results', () => {
        // Test pagination controls
    });
});
```

#### Editor Form (`frontend/tests/editor.test.js`)

```javascript
describe('Editor Form', () => {
    it('should validate required fields before submit', () => {
        // Test client-side validation
    });

    it('should show autocomplete suggestions for author', () => {
        // Test authority search
    });

    it('should show duplicate warning modal', () => {
        // Test modal when author has existing dissertations
    });

    it('should create new authority inline', () => {
        // Test new authority creation flow
    });

    it('should add additional advisor fields', () => {
        // Test "Add Another Advisor" button
    });

    it('should default first advisor to Advisor role', () => {
        // Test role defaults
    });

    it('should default subsequent advisors to Committee role', () => {
        // Test role defaults
    });

    it('should warn on unsaved changes', () => {
        // Test beforeunload warning
    });

    it('should show year warning for out-of-bounds values', () => {
        // Test year validation UI
    });

    it('should allow [unknown] checkbox for title', () => {
        // Test unknown checkbox
    });
});
```

#### Delete Flow (`frontend/tests/delete.test.js`)

```javascript
describe('Delete Flow', () => {
    it('should show confirmation modal', () => {
        // Test modal appears
    });

    it('should require reason before delete', () => {
        // Test reason field validation
    });

    it('should remove record from list after delete', () => {
        // Test UI update
    });
});
```

---

## File References

- **IsisCB UI Standards:** `/Users/alex/.claude/skills/isiscb-ui-standards.md`
- **Dissertation Data Schema:** `/Users/alex/.claude/skills/dissertations-data/SKILL.md`

---

## Environment Variables

### API (.env)

```
# Database
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_KEY=xxxxx

# Authentication
JWT_SECRET=xxxxx
VIEWER_ACCESS_CODE_HASH=xxxxx  # bcrypt hash of "1913"
EDITOR_AX_PASSWORD_HASH=xxxxx
EDITOR_SPW_PASSWORD_HASH=xxxxx
EDITOR_VIETH_PASSWORD_HASH=xxxxx

# App
NODE_ENV=production
PORT=3000
```

### Frontend

```javascript
// config.js
const CONFIG = {
    API_URL: 'https://isiscb-dissertations-api.onrender.com',
    // or for local dev: 'http://localhost:3000'
};
```

---

## Render Configuration

### render.yaml

```yaml
services:
  # API Service
  - type: web
    name: isiscb-dissertations-api
    env: node
    buildCommand: cd api && npm install
    startCommand: cd api && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: VIEWER_ACCESS_CODE_HASH
        sync: false
      - key: EDITOR_AX_PASSWORD_HASH
        sync: false
      - key: EDITOR_SPW_PASSWORD_HASH
        sync: false
      - key: EDITOR_VIETH_PASSWORD_HASH
        sync: false

  # Editor Static Site
  - type: web
    name: isiscb-dissertations
    env: static
    staticPublishPath: ./frontend
    headers:
      - path: /*
        name: Cache-Control
        value: public, max-age=3600
    routes:
      - type: rewrite
        source: /*
        destination: /index.html

  # Explorer Static Site (Visualizations)
  - type: web
    name: isiscb-dissertations-explorer
    env: static
    staticPublishPath: ./explorer
    headers:
      - path: /*
        name: Cache-Control
        value: public, max-age=3600
      - path: /data/*
        name: Cache-Control
        value: no-cache
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```
