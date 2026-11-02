# Full Spectrum Audit: meets.lv (repo girtspolis1-sudo/meets-2)

**Date**: 2026-11-02
**Mode**: Repo Health
**Source**: `main` @ 80b7e04 (after PR #73 theme and PR #74 admin access) + live Supabase project "MEETS 2"
**Lenses Run**: 8/10
**Lenses Skipped**: Backend Engineer (lens targets Rust/Tauri; there is none — server routes and Supabase are covered by Structural and Production Readiness), DX Engineer (lens targets developer tools; meets.lv is a consumer site)

---

## Master Verdict: APPROVE WITH CHANGES — except the database history, which NEEDS REWORK

The application itself is in good shape: a clear public data boundary, cached catalogue, solid test coverage of `lib/`, decent accessibility and a now-consistent visual theme. The one structural risk that overrides the rest is that the live database cannot be rebuilt from the repository (97 recorded migrations vs 19 local files, 13 of which were never recorded). After that, the biggest user-facing wins are a lighter catalogue payload, account deletion, a deliberate decision on search-engine indexing, and timeouts on server-side calls.

## Verdict by Lens

| # | Lens | Verdict | Critical | Recommendations |
|---|------|---------|----------|-----------------|
| 1 | Design Engineer | APPROVE WITH CHANGES | 2 | 6 |
| 2 | UX Engineer | APPROVE WITH CHANGES | 2 | 4 |
| 3 | Frontend Engineer | APPROVE WITH CHANGES | 1 | 5 |
| 4 | Backend Engineer | Skipped | — | — |
| 5 | Structural Engineer | NEEDS REWORK (DB history) | 2 | 4 |
| 6 | Repo Maintainer | APPROVE WITH CHANGES | 2 | 6 |
| 7 | Production Readiness | APPROVE WITH CHANGES | 2 | 6 |
| 8 | DX Engineer | Skipped | — | — |
| 9 | Performance Engineer | APPROVE WITH CHANGES | 1 | 4 |
| 10 | Accessibility Engineer | APPROVE WITH CHANGES | 1 | 6 |

## All Critical Issues (Must Fix)

| # | Issue | Lens(es) | File(s) | Impact | Fix |
|---|-------|----------|---------|--------|-----|
| 1 | Database schema not reproducible from git: live DB records 97 migrations, repo has 19; 13 repo files were applied as raw SQL and never recorded; two files share version `20261101090000`. | Structural (S1, S2), Production (P1) | supabase/migrations/, database/ | No rebuild, no staging, no reviewable schema history; `db push` would re-run 13 files. | `supabase db pull` as new baseline, `migration repair --status applied` for the 13, rename the duplicate, apply all future changes only via `supabase/migrations`; confirm backups/PITR. |
| 2 | Every visitor downloads the whole catalogue (2 050 events, ~3.3 MB JSON incl. descriptions), parses it on the main thread and stores it in localStorage. | Frontend (F1), Performance (PE1) | lib/catalog.js, lib/use-events.js, app/api/events/route.js | Slow loads on phones; localStorage quota will silently break the return-visit cache as sources grow. | Light list projection for /api/events; details on demand per event. |
| 3 | Whole site is `noindex, nofollow`; no robots.txt / sitemap. | UX (U1), Production (P6) | app/layout.jsx | meets.lv is invisible to search engines. Fine pre-launch only if deliberate. | Env flag; index public routes; add app/robots.js + app/sitemap.js. |
| 4 | Users cannot delete their account. | UX (U2) | app/api/account/route.js, /konta-iestatijumi | EU right to erasure; no self-service path. | "Dzēst kontu" with specific confirmation + server-side deletion. |
| 5 | 25 of 29 server-side `fetch` calls have no timeout (all of /api/account, uploads, organizer, registries, admin/session). | Production (P2) | app/api/**/route.js | Slow Supabase → hanging sign-in/save until the function limit. | Shared fetch helper with `AbortSignal.timeout(10000)` and a clear 503. |
| 6 | Home search input has no visible focus. | Design (D1), Accessibility (A1) | app/discovery-design.css:42-43 | WCAG 2.4.7 failure on the home page's first input. | `.meets-hero-search:focus-within` outline. |
| 7 | Six `:root` token blocks in four files; effective palette depends on CSS import order. | Design (D2) | globals.css, discovery-design.css, ux-enhancements.css, meets-theme.css | Reordering or adding a stylesheet silently recolors the site. | Single tokens file; delete older `:root` blocks. |
| 8 | No linter/formatter; several files written as single 500+ character lines (globals.css line 1 is a whole stylesheet). | Repo (R1, R2) | repo root, CI, globals.css, 6 JSX files | Nothing catches hooks mistakes; diffs unreadable. | ESLint (next + react-hooks) + Prettier, one formatting commit, lint in CI. |

## Cross-Cutting Concerns

| Concern | Flagged By | Root Cause | Unified Fix |
|---------|-----------|------------|-------------|
| Schema history drift | Structural, Production, Repo | DB changes applied directly in Supabase (SQL editor / MCP) and only sometimes saved as files | One rule, written in CLAUDE.md: schema changes only via `supabase/migrations` + `supabase db push`; baseline now |
| Catalogue payload size | Frontend, Performance, Production | One "catalogue" shape used for list, map and detail | Two shapes: list (light) and detail (full) |
| Session handling outside the store | Structural (S3), Repo (R6), Production (failure table), Frontend | 8 local `sessionRead()` helpers that never refresh the token — the same class of bug as today's admin lock-out | Use `lib/account-store.js` everywhere |
| CSS layering | Design (D2–D8), Structural (S6), Repo (R2) | Each redesign added a new global stylesheet on top instead of replacing | Tokens file first; absorb and delete old layers area by area |
| Focus visibility on home search | Design (D1), Accessibility (A1) | `outline:0` without replacement | `:focus-within` |
| Indexing switch | UX (U1), Production (P6) | Pre-launch default left in code | Env flag + robots/sitemap |
| Outdated docs | UX (U4), Repo (R3, R7) | README describes removed admin flow; no CLAUDE.md | Rewrite admin section; add CLAUDE.md |

## All Recommendations

| # | Recommendation | Lens | File(s) | Fix |
|---|---------------|------|---------|-----|
| 1 | Replace literal colors with tokens as files are touched; stylelint rule | Design D3 | app/*.css | `color-no-hex` outside tokens |
| 2 | Remove leftover indigo/pink gradients (hero search button) | Design D4 | discovery-design.css:44 | Flat `var(--karmins)` |
| 3 | Minimum 12 px for meta text | Design D5, A11y A5 | app/*.css | Raise 9–11 px rules |
| 4 | Radius scale tokens | Design D6 | app/*.css | `--radius-s/m/l/pill` |
| 5 | Plain hero headline, no accent word / caps eyebrow | Design D7 | app/page.jsx | Copy + style |
| 6 | Remove `!important` as layers go | Design D8 | app/*.css | — |
| 7 | Helpful 404 for ended/removed events | UX U3 | app/not-found.jsx, /pasakumi/[id] | Link to list/venue |
| 8 | Rewrite README admin section | UX U4, Repo R3 | README.md | Account + allowlist flow |
| 9 | One search component (home → /pasakumi?q=) | UX U5 | app/page.jsx | Reuse catalogue search |
| 10 | Delete header-role-badge.jsx | UX U6, Repo R5, Frontend F7 | app/header-role-badge.jsx | Delete |
| 11 | Stable keys for removable lists | Frontend F2 | organizators/page.jsx:44, event-catalog.jsx:298 | ids / `chip.key` |
| 12 | Split the 900–1 000-line components | Frontend F3 | admin-dashboard.jsx, osm-event-map.jsx | Reducer + route segments |
| 13 | Push `'use client'` down from pages | Frontend F4 | (mans-meets), organizators, registre-* | Server shell + client island |
| 14 | One `useRigaClock()` | Frontend F5, Perf PE3 | 3 files | Shared hook, scoped re-render |
| 15 | `// @ts-check` + JSDoc types for event/session | Frontend F6 | lib/ | — |
| 16 | Session via account-store only | Structural S3, Repo R6 | 8 files | `useAccountSession` / `freshSession` |
| 17 | Clean up `database/` | Structural S4 | database/ | Docs to docs/, delete dead scripts |
| 18 | Document public-route vs admin-RPC rule | Structural S5 | CLAUDE.md | — |
| 19 | Retire old global stylesheets | Structural S6 | app/layout.jsx imports | — |
| 20 | Glob test files in `npm test` | Repo R4 | package.json | `tests/*.test.{js,mjs}` |
| 21 | Add CLAUDE.md | Repo R7 | repo root | Stack, rules, commands |
| 22 | JSON log helper | Repo R8 | app/api | `log(event, fields)` |
| 23 | Enable leaked-password protection | Production P3 | Supabase Auth | Toggle |
| 24 | Cheap health check | Production P4, Perf PE4 | app/api/health/route.js | `select 1` + 3 s timeout |
| 25 | Revoke anon EXECUTE on `meets_share_disable` | Production P5 | Supabase | `revoke execute … from anon` |
| 26 | Site-wide CSP | Production P7 | next.config.mjs | — |
| 27 | Branch protection with required checks | Production P8 | GitHub | — |
| 28 | `useDeferredValue` for search | Perf PE2 | event-catalog.jsx, osm-event-map.jsx | — |
| 29 | Run DB performance advisor after baseline | Perf PE5 | Supabase | — |
| 30 | Announce map result count | A11y A2 | nearby-list.jsx | sr-only `aria-live` |
| 31 | Filters panel: disclosure or real dialog + Escape | A11y A3 | osm-event-map.jsx:805 | — |
| 32 | `<h1>` on /karte | A11y A4 | app/karte/page.jsx | sr-only heading |
| 33 | Native `<dialog>` in admin register | A11y A6 | admin-event-register.jsx | — |
| 34 | Label map region, list as alternative | A11y A7 | osm-event-map.jsx | — |

---

# Lens Reports

---

## 1. Design Engineer

**Verdict**: APPROVE WITH CHANGES

### Summary
The site has a clear new direction (meets-theme.css: Sniegs/Tinte/Karmīns/Priede/Dzintars/Migla, Unbounded + Manrope), but it sits on top of eight older stylesheets that still carry their own palettes, radii and type scales. The new theme wins by load order, not by structure, so every new screen risks picking up an old look.

### Files Reviewed
| File | Visual Role | Risk |
|------|-------------|------|
| app/meets-theme.css | Current tokens, fonts, overrides (loaded last) | Low — the intended system |
| app/globals.css (2 418 lines) | Base + two older themes (green start theme, purple brand theme) | High — two `:root` blocks, minified one-line rules |
| app/discovery-design.css | Card/hero system with its own `:root` (indigo era) | High — gradients, hero search |
| app/ux-enhancements.css | Map markers, filters, own `:root` | Medium |
| app/design-refresh.css | Card + catalogue refresh | Medium |
| app/personal-collections.css, profile-dashboard.css, organizer-workspace.css, quick-flow.css | Area-specific styles | Medium — hardcoded colors |
| app/layout.jsx | Import order defines the cascade | Medium |
| app/page.jsx, app/global-error.jsx, app/vietas/[id]/page.jsx, app/iegult-vietu/[id]/page.jsx | Inline style objects | Low |

### Critical Issues (Must Fix)
| # | Issue | File(s) | Impact | Fix |
|---|-------|---------|--------|-----|
| D1 | Home search field has no visible keyboard focus: `.meets-hero-search input{outline:0}` + `input:focus{outline:none}`, and the wrapper has no `:focus-within` style. | app/discovery-design.css:42-43 | Keyboard users cannot see where they are on the first interactive element of the home page. | Add `.meets-hero-search:focus-within{outline:2px solid var(--karmins);outline-offset:2px}` in meets-theme.css. |
| D2 | Six `:root` token blocks across four files (globals ×2, discovery-design, ux-enhancements, meets-theme) redefine the same names (`--bg`, `--accent`, `--border`…). The effective value depends only on import order in layout.jsx. | app/globals.css:1,50; app/discovery-design.css:5; app/ux-enhancements.css; app/meets-theme.css | Reordering an import or adding a CSS file silently changes the whole site's colors. | Keep tokens only in meets-theme.css (or move it to a `tokens.css` imported first) and delete the older `:root` blocks. |

### Recommendations
| # | Issue | File(s) | Why | Fix |
|---|-------|---------|-----|-----|
| D3 | 930 distinct hex values in CSS vs. 276 `var(--…)` uses. Today's recolor mapped them mechanically, so they look consistent, but they are still literals. | app/*.css | Any future palette change needs another bulk rewrite. | Replace the most frequent literals with tokens file by file when a screen is touched; add a lint rule (stylelint `color-no-hex` outside tokens file). |
| D4 | Leftover gradients from the indigo era: hero search button `linear-gradient(135deg,#537aff,#d36973)`, card skeleton, some `.meets-card-*` backgrounds. | app/discovery-design.css:44 and others | Off-palette blue-pink gradient on the home page contradicts the flat carmine system. | Override in meets-theme.css: flat `var(--karmins)` button. |
| D5 | Type scale: 224 rules at 9–11px (`font-size:9px` ×24, `10px` ×67, `11px` ×133). | app/*.css | Below comfortable reading size on phones; Manrope at 9–10px is hard to read. | Floor body/meta text at 12px; 11px only for badges. |
| D6 | Border radius has 12+ different values (8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 999…). | app/*.css | Cards, inputs and buttons next to each other have visibly different rounding. | Define `--radius-s:8px; --radius-m:12px; --radius-l:18px; --radius-pill:999px` and migrate. |
| D7 | Home hero copy keeps the "accent one word" treatment (`<em>kas iedvesmo.</em>`) and an all-caps eyebrow (`LATVIJAS PASĀKUMI VIENUVIET`). | app/page.jsx | Generic template look; conflicts with the new restrained type. | Plain headline in Unbounded; drop or sentence-case the eyebrow. |
| D8 | 80 `!important` declarations. | app/*.css | Symptom of the layer fight; makes overrides unpredictable. | Remove as the old layers are deleted. |

### Nice-to-Haves
| # | Suggestion | Rationale |
|---|------------|-----------|
| D9 | Apple touch icon is still the purple PNG (`/meets-logo-purple.png`). | Brand mismatch when saved to an iPhone home screen. |
| D10 | Inline style objects in public pages (venue page, embed page, global-error). | Move to classes so they follow tokens. |
| D11 | Dark mode does not exist (no `prefers-color-scheme` anywhere). | Not required, but a token-only palette would make it cheap to add later. |

### Design System Compliance
The new palette and fonts are applied globally and the visual result is consistent (verified in the static preview and on production). Compliance is enforced by override rather than by source: tokens live in one file, but most rules still carry literals and the older `:root` blocks still exist. Visual fragmentation risk is high for any new component written against the older class families.

### Visual State Coverage
| Component/Element | Hover | Focus | Active | Disabled | Loading | Empty | Error | Dark Mode |
|-------------------|-------|-------|--------|----------|---------|-------|-------|-----------|
| Header nav links | ✓ | ✓ (global outline) | ✓ (ink pill) | n/a | n/a | n/a | n/a | ✗ |
| Primary / secondary buttons | ✓ | ✓ | ✗ (no pressed style) | partial | partial | n/a | n/a | ✗ |
| Home hero search | ✓ | ✗ (D1) | ✗ | n/a | n/a | n/a | n/a | ✗ |
| Filter chips (map, catalogue) | ✓ | ✓ | ✓ (aria-pressed) | n/a | n/a | n/a | n/a | ✗ |
| Event card | ✓ | ✓ (`:has(:focus-visible)`) | n/a | n/a | ✓ skeleton | ✓ catalog-empty | ✓ | ✗ |
| Map list row | ✓ | ✓ | ✓ highlighted | n/a | ✓ "Ielādē…" | ✓ | partial | ✗ |
| Admin dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |

### Verdict Details
- Design Token Fidelity: CONCERNS (D2, D3)
- Visual State Coverage: CONCERNS (D1)
- Dark Mode Parity: N/A — no dark theme exists (D11)
- Animation Quality: PASS — few transitions, all ≤200ms, reduced-motion handled where animations exist
- Visual Consistency: CONCERNS (D4–D6)

---

## 2. UX Engineer

**Verdict**: APPROVE WITH CHANGES

### Summary
The core visitor journey (home → map or list → event → save / add to calendar) is complete and gives good feedback: loading text, empty states with a way out, "Notiek tagad / Drīz sāksies", error boundary with retry. The gaps are at the account edges: a signed-in user cannot delete their account, and the whole site tells search engines not to index it.

### User Journey Map
**Visitor finds an event**
1. Trigger: search engine or shared link → **FAIL** — `robots: {index:false, follow:false}` in app/layout.jsx; no robots.txt / sitemap.
2. Home page → categories, hero search, "Atvērt karti" → OK
3. Map `/karte`: location prompt, radius and period chips, day-grouped list → OK (location prompt explains why before asking)
4. List `/pasakumi`: search, period chips, filters on demand, day headings with counts → OK
5. Empty result → "Šādu pasākumu nav" + "Rādīt visus datumus" / "Notīrīt filtrus" → OK
6. Event detail `/pasakumi/[id]`: facts, venue, calendar, share → OK
7. Load error → error.jsx "Kaut kas nogāja greizi" + "Mēģināt vēlreiz", reported to /api/client-error → OK

**Visitor saves / follows**
1. Heart or follow on a card while signed out → sign-in prompt → OK
2. Register → e-mail confirmation → sign in → OK; rate-limit message is specific → OK
3. Forgot password → /atjaunot-paroli → OK
4. Leave the service → **FAIL** — no "delete account" action anywhere (api/account has 17 actions, none deletes).

**Organizer adds an event**
1. "Pievienot pasākumu" → /registre-pasakumu/vienkarsi → OK
2. Draft kept in localStorage per organization, "Notīrīt" asks for confirmation → OK
3. Organizer profile: unsaved-changes guard (`beforeunload` + confirm on switch) → OK
4. After submit: moderation queue, e-mail on review → OK

**Admin**
1. Signs in as a normal account via Mans profils → nav shows "Admin", footer "Pārslēgties uz admin paneli" → OK (since PR #74)
2. Expired session → re-sign-in → admin re-checked → OK (PR #74 fixed the cached "no")
3. Visitor opening /admin → neutral "Šī lapa nav pieejama" → OK

### Critical Issues (Must Fix)
| # | Issue | Step in Journey | Impact on User | Fix |
|---|-------|----------------|----------------|-----|
| U1 | The whole public site is `noindex, nofollow`. | Visitor step 1 | Nobody finds meets.lv events through Google; shared links get no rich preview benefit from indexing. If this is deliberate for the pre-launch phase, it must be a conscious switch, not a default left in code. | Make it an env flag (`NEXT_PUBLIC_ALLOW_INDEXING`), index public routes (/, /karte, /pasakumi, /pasakumi/[id], /vietas/[id], /organizatori/[id]), keep /admin, /profils, /mani-* noindex; add app/robots.js and app/sitemap.js. |
| U2 | No way for a user to delete their account and data. | Save/follow step 4 | Users in the EU have a right to erasure; today they must e-mail someone, and the site does not even say whom. | Add "Dzēst kontu" to /konta-iestatijumi with a specific confirmation ("Tiks dzēsts konts, saglabātie pasākumi un sekošana"), backed by a server action that calls the Supabase admin API. |

### Recommendations
| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| U3 | Not-found page has only "Uz sākumlapu". | Someone following an old event link ends at a dead end. | For `/pasakumi/[id]` misses, say the event has ended or been removed and link to the list filtered to that venue/category. |
| U4 | README still documents the old single-admin password + recovery-code flow. | New collaborators (and you in six months) follow instructions for a flow that no longer exists. | Rewrite the "Admin authentication" section for account-based admin (allowlist + admin_users). |
| U5 | Home hero search and the list search are two different components with different behavior. | Users learn one search, meet another. | Make the hero search submit to `/pasakumi?q=` and reuse the same field. |
| U6 | "Izstrādes versija" badge component exists but is unused (header-role-badge.jsx). | None today; dead UI that could reappear by accident. | Delete it. |

### Nice-to-Haves
| # | Suggestion | Rationale |
|---|------------|-----------|
| U7 | Remember the last map location and radius across visits. | Returning users re-enter the same thing every time. |
| U8 | Undo toast after removing a saved event. | Mis-taps on the heart on mobile are common. |

### Interaction Consistency Check
Period chips, category chips and filters behave the same on /karte and /pasakumi (aria-pressed, one active). Destructive actions use `window.confirm` with specific text — consistent, if plain. The map list and catalogue now share the same day-group voice. One deviation: the home search behaves unlike the list search (U5).

### Verdict Details
- Discoverability: CONCERNS (U1)
- Flow Completeness: CONCERNS (U2)
- Error Recovery: PASS
- Feedback & Status: PASS
- Consistency: PASS with U5

---

## 3. Frontend Engineer

**Verdict**: APPROVE WITH CHANGES

### Summary
Next.js 16 App Router + React 19, plain JavaScript (no TypeScript, no state library). 48 of 65 JSX files are client components. Hooks are generally disciplined: every `addEventListener` has a matching `removeEventListener` (11/11), intervals are cleared, fetches use `AbortController`. The weak points are four very large client components and the fact that every visitor downloads and parses the entire three-month catalogue in the browser.

### Files Reviewed
| File | Frontend Role | Risk |
|------|--------------|------|
| app/admin/admin-dashboard.jsx (1 029 lines, 42 useState, 10 useEffect) | Admin SPA in one component | High |
| app/karte/osm-event-map.jsx (937 lines, 31 useState, 14 useEffect) | Map, filters, list, sheet | High |
| app/pasakumi/event-catalog.jsx (446 lines, 17 useState) | Catalogue list | Medium |
| app/organizators/page.jsx (419 lines, 20 useState) | Organizer workspace, client page | Medium |
| lib/use-events.js | Client catalogue fetch + memory + localStorage cache | High (payload) |
| lib/account-store.js, app/use-admin-session.js | Session store (useSyncExternalStore), admin check | Low (fixed in #74) |
| app/layout.jsx | Root layout, fonts, nav | Low |

### Critical Issues (Must Fix)
| # | Issue | File(s) | Why It Breaks | Code Fix |
|---|-------|---------|---------------|----------|
| F1 | Every visitor fetches the whole public catalogue (2 050 events, ~3.3 MB JSON before projection, descriptions included) and parses it on the main thread; it is also written to localStorage (`meets_catalog_v1`). | lib/use-events.js, app/api/events/route.js, lib/catalog.js | Slow first load on phones (download + JSON.parse of MBs); localStorage quota is ~5 MB per origin, so as the catalogue grows the write silently fails (it is caught) and the "instant return visit" cache stops working without anyone noticing. | Split the payload: a light list/map projection (id, title, dates, times, venue, coords, category, price, sport fields) for `/api/events`, and descriptions/terms fetched per event on the detail page. Store only the light list. Longer term: query by viewport/period server-side. |

### Recommendations
| # | Issue | File(s) | Why | Fix |
|---|-------|---------|-----|-----|
| F2 | `key={i}` on an editable list whose rows can be removed (organizer contacts). | app/organizators/page.jsx:44 | Removing a middle row makes React reuse the wrong DOM nodes; controlled inputs mostly survive, but focus and any uncontrolled state jump to the wrong row. | Give each contact a stable `id` (crypto.randomUUID()) when created. Also `key={i}` on removable active-filter chips (event-catalog.jsx:298) → use `chip.key`. |
| F3 | Giant components with dozens of `useState` and many effects. | admin-dashboard.jsx, osm-event-map.jsx | Any state change re-renders the whole map shell or admin table; effects interact in non-obvious order; hard to test. | Extract filter state into a `useMapFilters` reducer; split admin into route segments (/admin/pasakumi, /admin/vietas, …) each with its own component. |
| F4 | Most pages are client components, including account and organizer pages (`'use client'` at page level). | app/(mans-meets)/*/page.jsx, organizators, registre-* | Bigger JS bundles; no server-rendered content for those routes. Acceptable for signed-in areas, but the page shell could be a server component with a client island. | Move `'use client'` down to the interactive child. |
| F5 | Two copies of the same 30-second clock (`setInterval(...,30000)`) in admin map and public map, 60-second in catalogue. | admin-event-map.jsx:155, osm-event-map.jsx:254, event-catalog.jsx:63 | Duplicate logic, three different cadences for "Notiek tagad". | One `useRigaClock()` hook. |
| F6 | No type checking at all (no TypeScript, no JSDoc `// @ts-check`). | whole app | The public field allowlist, RPC payloads and session shapes are untyped; a renamed column fails only at runtime. | Add `// @ts-check` + JSDoc typedefs for the event and session shapes, or migrate lib/ to TS first. |

### Nice-to-Haves
| # | Suggestion | Rationale |
|---|------------|-----------|
| F7 | Dead component app/header-role-badge.jsx. | Delete. |
| F8 | `lib/excel.js` is already lazy-imported (good); do the same for admin-only modules like `admin-event-map`. | Keeps admin code out of shared chunks. |

### Render Path Analysis
- **Root layout** renders SiteNav, MobileBottomNav and AdminFooterControl; all three call `useAdminSession` → `useAccountSession` (useSyncExternalStore on localStorage). A session change re-renders all three, which is cheap.
- **/karte**: `OsmEventMap` owns 31 state values. Changing radius, period or category re-renders the whole map shell, NearbyList and MobileEventSheet; Leaflet layers are updated in effects. The clock tick every 30 s also re-renders the whole tree to refresh "Notiek tagad" badges.
- **/pasakumi**: `EventCatalog` filters and sorts the full in-memory catalogue on each filter change; `listed.current` keeps the sorted list, paging (`shown`) limits rendered cards. Fine at 2 000 events, will degrade linearly.
- **useEvents**: one fetch per tab, refreshed every 5 minutes while visible; memory cache shared across client navigation → no refetch between /karte and /pasakumi. Good.
- **Admin**: one 1 029-line component; any table edit re-renders filters, map and queues together.

### Type Safety Assessment
None. The project is plain JS. Server-side boundaries are protected by explicit allowlists (`PUBLIC_FIELDS`, `projectPublicEvent`), which is the right instinct, but nothing checks that the client code uses only those fields or that RPC results have the expected shape beyond `Array.isArray(result.events)`.

### Verdict Details
- Component Architecture: CONCERNS (F3, F4)
- State Management: PASS (session store is clean; filter state could be a reducer)
- Type Safety: CONCERNS (F6)
- Rendering Performance: CONCERNS (F1, F3)
- Bundle Impact: CONCERNS (F1 payload, F4)

---

## 4. Backend Engineer

**Skipped** — the lens audits Rust/Tauri code; this project has none. Server routes, Supabase RPCs and edge functions are covered under Structural (5) and Production Readiness (7).

---

## 5. Structural Engineer

**Verdict**: NEEDS REWORK (database history only; app structure is APPROVE WITH CHANGES)

### Summary
The application layering is sound: browser → Next.js route handlers / server components → Supabase RPCs, with public data passing through an explicit allowlist (`meets_public_catalog()` + `PUBLIC_FIELDS`). The structural problem is the database: the repository is not the source of truth for the schema. And on the client, session handling is re-implemented in eight places instead of going through the one store.

### Files Reviewed
| File | Structural Role | Layer | Risk |
|------|----------------|-------|------|
| supabase/migrations/ (19 files) | Schema history (CLI format) | Database | High |
| database/ (14 SQL + 3 MD, 1 nested `migrations/`) | Ad-hoc scripts and docs | Database | High |
| Live project `MEETS 2` (97 recorded migrations) | Actual schema | Database | — |
| lib/account-store.js | Single session store with refresh | Client lib | Low |
| 8 files with their own `sessionRead()` | Session access | Client | Medium |
| lib/catalog.js, lib/events-server.js, app/api/events/route.js | Public data boundary | Server | Low |
| supabase/functions/* | Import workers (Deno) | Edge | Medium |

### Critical Issues (Must Fix)
| # | Issue | Files Involved | Structural Impact | Fix |
|---|-------|---------------|-------------------|-----|
| S1 | Schema history in the repo does not match the database. The live project records 97 migrations; the repo has 19, and 13 of those (e.g. `20261030120000_admin_login_with_meets_account`, `20261031150000_calendar_feeds`) are not in the recorded history at all, although their objects exist — they were applied as raw SQL. About 80 recorded migrations (initial schema, admin, organizer, municipality sync…) exist only in the database. | supabase/migrations/, database/, live DB | The database cannot be rebuilt from git (no staging, no disaster recovery from code, no reviewable diff of schema changes). Any `supabase db push` would try to re-run the 13 unrecorded files. | Run `supabase db pull` (or `supabase migration fetch`) to bring the remote history into the repo as the new baseline, mark the 13 local files as applied with `supabase migration repair --status applied <version>`, and from now on apply changes only through `supabase/migrations`. |
| S2 | Two files share the version `20261101090000` (`faster_admin_catalog` and `fix_lff_venue_scorer_tables`). | supabase/migrations/ | Supabase CLI rejects duplicate versions; ordering between them is undefined. | Rename one to `20261101090100_…`. |

### Recommendations
| # | Issue | Why | Fix |
|---|-------|-----|-----|
| S3 | Session is read straight from localStorage in 8 places (`sessionRead`, `readSession`, `session()`) instead of via `lib/account-store.js`. | Those copies never refresh an expired token — the same class of bug as the admin lock-out fixed in #74. Changing the storage key or shape needs 9 edits. | Use `useAccountSession()` / `freshSession()` everywhere; delete the local helpers. |
| S4 | `database/` mixes one-off scripts (dry runs, "temp" probes), reference docs and a nested `migrations/` folder. | Unclear which files are history, which are runnable, which are dead. | Move docs to `docs/`, delete scripts already captured as migrations, keep `database/` for read-only audit queries only. |
| S5 | Admin pages call Supabase RPCs directly from the browser (admin-dashboard, calendar-feeds, user-submissions) while public pages go through Next.js routes. | Two patterns for the same backend; admin RPC names and the publishable key are exposed to the client (acceptable because the DB checks `is_meets_admin()`, but the pattern is inconsistent). | Keep as is for now (DB-enforced), but document the rule: public → route handler, admin → RPC with account token. |
| S6 | CSS architecture: nine global stylesheets imported in layout.jsx, layered by import order. | Change propagation: a single color change touched 14 files today. | Tokens file first, then component/area CSS modules; retire `ux-enhancements` / `design-refresh` / `discovery-design` as their rules are absorbed. |

### Nice-to-Haves
| # | Suggestion | Rationale |
|---|------------|-----------|
| S7 | A `lib/supabase-rest.js` helper for `fetch(url+'/rest/v1/rpc/…')` | The same fetch-with-apikey code appears in route handlers and lib/admin-auth.js. |
| S8 | Generate types from the DB (`supabase gen types`) even in a JS project, via JSDoc. | Gives RPC shapes a contract. |

### Dependency Map
```
Browser (client components)
  ├─ lib/use-events ──────────► /api/events ──► lib/events-server ──► RPC meets_public_catalog()
  ├─ lib/account-store ───────► /api/account ─► Supabase Auth + REST (user-scoped)
  │    ▲
  │    └─ 8 local sessionRead() copies bypass the store  ⚠ (S3)
  ├─ admin/* ─────────────────► Supabase REST /rpc/meets_admin_* (account token) ─► is_meets_admin()
  └─ /api/admin/session ──────► RPC meets_admin_session_valid

Supabase
  ├─ pg_cron ─► edge functions sync-* ─► import tables ─► publish ─► catalog
  └─ schema history: live DB (97)  ≠  repo supabase/migrations (19)  ⚠ (S1)
```
No cycles between `lib/` and `app/` (lib never imports from app). Dependency direction is correct.

### Boundary Crossing Analysis
| Crossing | From -> To | Clean? | Notes |
|----------|-----------|--------|-------|
| Public catalogue | Browser → /api/events → RPC | Yes | Allowlisted fields, CDN cache 60 s |
| Account actions | Browser → /api/account → Supabase | Yes | One route, action switch (17 actions) — large but contained |
| Admin data | Browser → Supabase RPC | Acceptable | Enforced by DB function; differs from public pattern (S5) |
| Session | Components → localStorage | No | Bypasses the store in 8 places (S3) |
| Schema | Repo → DB | No | Not reproducible (S1, S2) |
| Imports | pg_cron → edge functions | Yes | Health digest + retries exist |

### Verdict Details
- Dependency Direction: PASS
- Module Coupling: CONCERNS (S3, S6)
- Cohesion: CONCERNS (S4; /api/account with 17 actions)
- Layer Boundaries: PASS with S5 noted
- Change Propagation: CONCERNS (S1, S6)

---

## 6. Repo Maintainer

**Verdict**: APPROVE WITH CHANGES

### Summary
The repository is small (200 tracked files) and clearly organised by route under `app/`, with pure logic in `lib/` and good unit-test coverage of that logic (19 test files, 74 tests). What is missing is the tooling that keeps it that way: no linter or formatter, no CLAUDE.md, a README that describes an admin flow that no longer exists, and several files written as one-line "minified" source.

### Files Reviewed
| File | Convention Status | Risk |
|------|------------------|------|
| package.json | Test list maintained by hand | Low |
| README.md | Outdated admin section | Medium |
| app/globals.css | 7 lines over 500 chars (line 1 is a whole stylesheet) | High |
| lib/catalog.js | 4 lines over 500 chars | Medium |
| app/(mans-meets)/sekosana/page.jsx, app/organizators/page.jsx, app/organizatori/[id]/page.jsx, app/mani-registri/page.jsx, app/components/account-auth-flow.jsx | One-line JSX blocks >500 chars | Medium |
| app/header-role-badge.jsx | Unused (0 imports) | Low |
| 8 files with local `sessionRead()` | Duplicates lib/account-store.js | Medium |
| supabase/migrations/ + database/ | Two schema locations, duplicate version | High (see S1/S2) |

### Critical Issues (Must Fix)
| # | Issue | File(s) | Convention Violated | Fix |
|---|-------|---------|-------------------|-----|
| R1 | No lint or format tooling at all (no ESLint, Prettier, stylelint config; CI runs only tests + build). | repo root, .github/workflows/ci.yml | Automated quality gate | Add `eslint` with `eslint-config-next` + `react-hooks` rules and `prettier`; add `npm run lint` to CI. The hooks rules alone would catch dependency-array mistakes in the 900-line components. |
| R2 | Source files written as single very long lines (globals.css line 1 holds an entire stylesheet; several JSX files have >500-char lines). | app/globals.css, lib/catalog.js, 6 JSX files | Readable, diffable source | Run Prettier once over the repo in its own commit (pure formatting), then enforce it. Without this, every diff to globals.css is one changed line. |

### Recommendations
| # | Issue | Why | Fix |
|---|-------|-----|-----|
| R3 | README "Admin authentication" describes single-admin password + recovery code; the real flow is account + allowlist + `admin_users`. | Misleads anyone setting up or debugging admin access (it nearly did today). | Rewrite that section; mention `meets_private.admin_email_allowlist`. |
| R4 | Test files are listed one by one in `npm test`. | A new test file is silently skipped unless someone edits package.json. | `node --conditions=react-server --test tests/*.test.{js,mjs}`. |
| R5 | Dead code: `app/header-role-badge.jsx` (0 imports). | Noise. | Delete. |
| R6 | Session helper duplicated 8× (`sessionRead`, `readSession`, `session`). | Reuse exists in `lib/account-store.js`. | Replace with the store (see S3). |
| R7 | No CLAUDE.md / CONTRIBUTING. | Agents and collaborators re-derive conventions (Latvian UI copy, comment style, migration rule) each time. | Add a short CLAUDE.md: stack, folder rules, "schema changes only via supabase/migrations", test/build commands, UI copy in Latvian. |
| R8 | 20 `console.error` / 3 `console.warn` with mixed formats (some JSON.stringify'd objects, some plain). | Harder to search in Vercel logs. | One tiny `log(event, fields)` helper that always emits JSON (already the pattern in api/admin/session). |

### Nice-to-Haves
| # | Suggestion | Rationale |
|---|------------|-----------|
| R9 | `.nvmrc` with `24`. | package.json engines says 24.x; local tooling defaults differ. |
| R10 | Group CSS by area under `app/styles/`. | Nine global stylesheets at the app root. |

### Convention Compliance Checklist
| Convention | Status | Notes |
|-----------|--------|-------|
| File placement | ✓ | Route folders + lib/ + components/; one stray `database/migrations/` |
| Naming conventions | ✓ | kebab-case files, Latvian route names consistently |
| Barrel exports | n/a | Project imports files directly; consistent |
| Import ordering | ~ | No tool enforces it; mostly external → local |
| Type imports separated | n/a | Plain JS |
| Path aliases used | ✗ | Relative `../../../lib/...` paths; no `@/` alias in jsconfig |
| No dead code left | ~ | header-role-badge.jsx; legacy CSS layers |
| Structured logging | ~ | Mixed (R8) |
| No lint suppressions | ✓ | None — but also no linter |
| CLAUDE.md present | ✗ | R7 |

### Reuse Opportunities
- `lib/account-store.js` (`useAccountSession`, `freshSession`) replaces all 8 local session readers.
- `app/components/event-facts.jsx` already unifies "when / where / price" — the venue page and embed page still format these by hand with inline styles.
- `meets-theme.css` tokens should replace literal colors as files are touched.

### Verdict Details
- File Organization: PASS
- Naming Consistency: PASS
- Import Hygiene: CONCERNS (no alias, no tool)
- Code Reuse: CONCERNS (R6)
- Lint Compliance: CONCERNS (R1 — nothing to comply with)

---

## 7. Production Readiness

**Verdict**: APPROVE WITH CHANGES

### Summary
Production basics are in place: Vercel deploys from `main` after CI (tests + build, both green on the last eight `main` commits except one cancelled run), a `/api/health` endpoint, client error reporting (`/api/client-error`), CDN caching of the catalogue with stale-while-revalidate, import health digest and retries in the database. The risks are the schema that cannot be rebuilt from git (see S1), outbound calls without timeouts in most API routes, and a few Supabase Auth/security settings.

### Files Reviewed
| File | Production Role | Risk |
|------|----------------|------|
| .github/workflows/ci.yml | Test + build gate; mobile smoke on PRs | Low |
| vercel.json, next.config.mjs | Build, security headers | Low |
| app/api/events/route.js, lib/events-server.js | Public catalogue, CDN cache, 20 s timeout | Low |
| app/api/health/route.js | Health check | Medium |
| app/api/account/route.js (14 fetch calls) | All user account actions | Medium |
| app/api/event-image, organization-logo, organizer, registries, admin/session | Upload and organizer routes | Medium |
| supabase/functions/sync-* | Scheduled imports | Medium |
| Supabase project MEETS 2 (security advisors) | Auth + RLS | Medium |

### Critical Issues (Must Fix)
| # | Issue | File(s) | Production Failure Mode | Fix |
|---|-------|---------|------------------------|-----|
| P1 | The database schema cannot be reproduced from the repository (97 recorded migrations vs 19 local files, 13 local files unrecorded, one duplicate version). | supabase/migrations/, database/ | If the project is lost, corrupted by a bad migration, or needs a staging copy, there is no way to rebuild it from code; rollback of a schema change is manual. | See S1: pull remote history into the repo, repair the 13 versions, apply all future changes via `supabase/migrations`. Confirm Supabase daily backups / PITR are enabled for the project. |
| P2 | 25 of 29 outbound `fetch` calls in API routes have no timeout (all of /api/account, event-image, organization-logo, organizer, registries, admin/session). | app/api/**/route.js | If Supabase Auth or REST is slow, sign-in, saving and uploads hang until the Vercel function limit, holding a function instance each; the user sees an endless spinner. | Add `signal:AbortSignal.timeout(10000)` to every server-side fetch (one shared helper, see S7) and map the abort to a clear 503 message. |

### Recommendations
| # | Issue | Why | Fix |
|---|-------|-----|-----|
| P3 | Leaked-password protection is off in Supabase Auth (security advisor WARN). | Users can register with passwords known from breaches. | Enable in Auth → Password security. |
| P4 | `/api/health` performs a full, uncached catalogue read (2 050 events) on every call. | An uptime monitor pinging every minute reads ~3 MB from the DB 1 440 times a day, and a slow DB makes health slow rather than "degraded" quickly. | Health should run `select 1` (or a tiny RPC) with a 3 s timeout; keep the full read for /api/events. |
| P5 | 8 SECURITY DEFINER functions are executable by `anon`, including `meets_share_disable()`. | The public ones (`meets_public_*`, `meets_shared_event_ids`) are intended; `meets_share_disable` acts on the caller's share and should require a signed-in user. | Revoke `anon` EXECUTE on `meets_share_disable`; add a comment on each intentionally public function so the advisor findings are documented. |
| P6 | Robots `noindex` hard-coded in the root layout. | A production launch requires a code change; easy to forget (see U1). | Env flag. |
| P7 | No CSP for the main site (only `frame-ancestors` for embed routes). | Third-party scripts or injected HTML would run unrestricted. | Add a CSP for `/:path*` that allows Google Fonts (now self-hosted by next/font, so only `'self'`), OpenFreeMap tiles and Supabase. |
| P8 | Mobile UX smoke runs only on PRs and is skipped on pushes to `main`. | Direct pushes to `main` (two merges today were API merges of PRs, which is fine) bypass it. | Protect `main` with required checks. |

### Nice-to-Haves
| # | Suggestion | Rationale |
|---|------------|-----------|
| P9 | Vercel log drain or Sentry for `client_render_error` and API errors. | `/api/client-error` only writes to Vercel logs, which are retained briefly. |
| P10 | Uptime alert on `/api/health` and on the weekly import digest. | You learn about outages from users today. |

### Failure Mode Analysis
| Scenario | What Fails | User Impact | Recovery | Plan Handles It? |
|----------|-----------|-------------|----------|-------------------|
| Supabase REST slow / down | /api/events (20 s timeout) | Map shows cached catalogue from localStorage/CDN (up to 6 h), then error with retry | Automatic when DB returns | ✓ |
| Supabase Auth slow | /api/account (no timeout) | Sign-in, save, follow hang | Manual reload | ✗ (P2) |
| Expired session | Client token refresh fails | Previously: admin locked out until reload | Re-sign-in now re-checks admin | ✓ (fixed #74); 8 local readers still don't refresh (S3) |
| Import source changes format | sync-* edge function | Fewer events | Retries + health digest e-mail | ✓ |
| Bad migration applied | Schema | Possible outage | Manual SQL; no migration history to revert | ✗ (P1) |
| Catalogue grows past localStorage quota | Return-visit cache | Slower return visits, silently | — | ✗ (F1) |
| Vercel deploy breaks build | — | None, previous deployment stays live | Fix and redeploy | ✓ (CI build gate) |

### Environment Checklist
| Concern | Dev | Prod | Gap? |
|---------|-----|------|------|
| File paths | none used | none used | No |
| Network | Supabase URL from env | same | No (CI uses https://ci.invalid) |
| Permissions | publishable key only on server/client | same; DB enforces admin via `is_meets_admin()` | No |
| Config | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (documented in .env.example) | set in Vercel | No |
| Build output | `next build` | Vercel `npm ci && npm run build`, Node 24 | Local Node 22 in some environments (R9) |
| Indexing | noindex | noindex | Yes — decide (U1/P6) |

### Verdict Details
- E2E Flow: PASS
- Error Recovery: CONCERNS (P2)
- Data Integrity: CONCERNS (P1)
- Environment Parity: PASS
- Observability: CONCERNS (P9, P10)

---

## 8. DX Engineer

**Skipped** — the lens audits developer tools (CLI, config, tool output); meets.lv is a consumer website. Developer-facing gaps (no linter, outdated README, no CLAUDE.md) are covered under Repo Maintainer (6).

---

## 9. Performance Engineer

**Verdict**: APPROVE WITH CHANGES

### Summary
For a public web app (not a long-running desktop session) the hot paths are: first load of /karte and /pasakumi, filtering on every keystroke/chip, and the per-minute clock tick. The server side is well cached (CDN 60 s + in-process stale-while-revalidate in `readEventsCached`). The dominant cost is the size of the catalogue that every browser downloads, parses and stores.

### Files Reviewed
| File | Performance Role | Risk |
|------|-----------------|------|
| lib/events-server.js | In-process cache (FRESH_MS) + single-flight refresh | Low |
| app/api/events/route.js | CDN `s-maxage=60, stale-while-revalidate=300` | Low |
| lib/use-events.js | Client fetch every 5 min while visible, memory + localStorage cache | High (payload) |
| lib/catalog.js | 45-field public projection incl. `description`, `terms` | High (payload) |
| app/karte/osm-event-map.jsx, lib/map-cluster.js | Leaflet + MapLibre, clustering | Medium |
| app/pasakumi/event-catalog.jsx | In-memory filter/sort of all events, paging | Medium |
| app/api/health/route.js | Full catalogue read per call | Medium |

### Critical Issues (Must Fix)
| # | Issue | File(s) | Impact | Fix |
|---|-------|---------|--------|-----|
| PE1 | Catalogue payload: 2 050 events, ~3.3 MB JSON from the RPC, projected to 45 fields including full descriptions and terms, sent to every visitor of /karte and /pasakumi, `JSON.parse`d on the main thread, then `JSON.stringify`'d into localStorage. | lib/catalog.js, lib/use-events.js | On a mid-range phone: hundreds of ms of main-thread parse + stringify on each load and each 5-minute refresh; mobile data cost; localStorage quota (~5 MB) will be exceeded as sources are added, silently disabling the return-visit cache. | Light list projection (~12 fields, no description/terms) for /api/events; fetch full details per event on demand (/pasakumi/[id] already renders server-side). Expect ~70–85 % smaller payload. |

### Recommendations
| # | Issue | File(s) | Why | Fix |
|---|-------|---------|-----|-----|
| PE2 | Text search filters all events on every keystroke without `useDeferredValue` or debounce. | app/pasakumi/event-catalog.jsx, osm-event-map.jsx | Fine at 2 000 events; grows linearly and competes with typing on slow phones. | Wrap the query in `useDeferredValue`. |
| PE3 | The 30-second clock re-renders the whole map shell, list and sheet to refresh "Notiek tagad". | osm-event-map.jsx:254 | Periodic full-tree render while the tab is open. | Keep the clock in a small context consumed only by the badge component, or compute live state once per minute in NearbyList only. |
| PE4 | `/api/health` reads the full catalogue uncached. | app/api/health/route.js | Expensive health check (see P4). | Use a trivial query. |
| PE5 | Database performance advisors not reviewed here in detail; the security advisor lists 26 RLS tables without policies (expected for private tables) — run the performance advisor after the migration baseline (S1). | Supabase | Unused / missing indexes accumulate unnoticed. | Run `get_advisors performance` monthly. |

### Nice-to-Haves
| # | Suggestion | Rationale |
|---|------------|-----------|
| PE6 | Preload the catalogue request from the /karte server component (`<link rel="preload" as="fetch">`). | Starts the download before hydration. |
| PE7 | Hero image `meets-hero-concert-full.webp` (137 KB) — serve via `next/image` with sizes. | Smaller on phones. |
| PE8 | Fonts are now self-hosted by next/font with `display:swap` (Poppins @import removed in #73). | Already improved: one less render-blocking third-party request. |

### Resource Budget
| Resource | Current | After Plan | Concern? |
|----------|---------|-----------|----------|
| Network per map visit | ~1 catalogue fetch (MBs, gzip by CDN) + tiles | With PE1: ~15–30 % of today | Yes (PE1) |
| Refresh cadence | every 5 min while visible | same | No |
| Event listeners added | 11 add / 11 remove | — | No |
| Intervals | 3 (30 s, 30 s, 60 s), all cleared | 1 shared hook (F5) | Minor |
| Memory growth per hour | Flat (catalogue replaced, not appended; `checks` map bounded by accounts) | — | No |
| localStorage | ~catalogue size | light list only | Yes (PE1) |
| Startup | Leaflet + MapLibre loaded at runtime on /karte only; Excel lazy | — | No |
| Bundle | 48 client components; no heavy libs in shared chunk | — | Minor (F4) |

### Hot Path Analysis
- **Load /karte**: HTML → hydrate → read localStorage catalogue (JSON.parse, MBs) → render list → load Leaflet/MapLibre → fetch /api/events (CDN) → parse again → write localStorage (stringify). Two full parses and one stringify on a cold-ish return visit — PE1 is the bottleneck.
- **Filter change**: in-memory filter + sort of 2 050 items, group by day, render first page; cluster recompute for the map. Acceptable today.
- **Clock tick**: full map-tree render every 30 s (PE3).
- **Server**: /api/events served from CDN for 60 s, then from the in-process cache with single-flight refresh; DB sees roughly one catalogue read per minute per region. Good.

### Verdict Details
- Memory Management: PASS
- IPC Efficiency (network): CONCERNS (PE1)
- I/O Patterns: CONCERNS (localStorage write of MBs; PE4)
- Startup Impact: CONCERNS (PE1 parse on load)
- Long-Session Stability: PASS

---

## 10. Accessibility Engineer

**Verdict**: APPROVE WITH CHANGES

### Summary
Accessibility is better than average for a project this size: skip link, `lang="lv"`, native `<dialog>` with `showModal()` for modals, a focus-trapped mobile sheet, labelled icon buttons on the map, `aria-pressed` filter chips, `aria-expanded` on toggles, a polite live region for the catalogue result count, and only one click-on-div (a decorative backdrop with `aria-hidden`). The gaps: an invisible focus state on the home search, the map page's result count is not announced, a non-modal "dialog" without Escape, and a lot of very small text.

### Files Reviewed
| File | A11y Role | Risk |
|------|----------|------|
| app/layout.jsx | Skip link, landmarks, lang | Low |
| app/discovery-design.css | Home hero search styles | High (focus) |
| app/karte/osm-event-map.jsx | Map controls, filters panel | Medium |
| app/karte/nearby-list.jsx | Result list + draggable sheet (has a button alternative) | Low |
| app/karte/mobile-event-sheet.jsx | Modal sheet with focus trap | Low |
| app/components/event-venue-dialog.jsx, app/organizators/venue-location-picker.jsx, app/admin/admin-dashboard.jsx | Native `<dialog>` | Low |
| app/pasakumi/event-catalog.jsx | `aria-live` result count | Low |
| app/admin/admin-event-register.jsx | `<form role="dialog" aria-modal>` | Medium |
| app/*.css | 224 rules at 9–11 px | Medium |

### Critical Issues (Must Fix)
| # | Issue | WCAG Criterion | File(s) | Impact | Fix |
|---|-------|---------------|---------|--------|-----|
| A1 | Home hero search input removes its outline (`outline:0`, `:focus{outline:none}`) and the wrapper has no `:focus-within` style. | 2.4.7 Focus Visible (AA) | app/discovery-design.css:42-43 | Keyboard users lose track of focus on the first input of the home page. | `.meets-hero-search:focus-within{outline:2px solid var(--karmins);outline-offset:2px}` (same as D1). |

### Recommendations
| # | Issue | WCAG Criterion | Fix |
|---|-------|---------------|-----|
| A2 | Map result count (`<h2 id="nearby-title">`, e.g. "42 pasākumi") changes when filters change but is not in a live region; the catalogue page does announce it. | 4.1.3 Status Messages | Add a visually hidden `<p aria-live="polite">` mirroring the count/summary in NearbyList. |
| A3 | "Vairāk filtru" panel is `role="dialog"` but not modal, has no Escape handler and doesn't move focus. | 2.1.2 / 2.4.3 Focus Order | Either drop `role="dialog"` (it is a disclosure: keep `aria-expanded` + `aria-controls` on the button) or make it a real `<dialog>`. Add Escape to close and return focus to the button. |
| A4 | /karte has no `<h1>`; the first heading is the list `<h2>`. | 1.3.1 Info and Relationships / 2.4.6 | Visually hidden `<h1>Pasākumu karte</h1>`. |
| A5 | 224 CSS rules set text at 9–11 px (e.g. category tile subtitles were 9 px before #73). | 1.4.4 Resize Text (supports), best practice | Minimum 12 px for meta text; 11 px only for badges. |
| A6 | `admin-event-register.jsx` uses `<form role="dialog" aria-modal="true">` without a native dialog. | 2.4.3 | Use `<dialog>` + `showModal()` like the other admin dialogs, so focus is trapped and Escape works. |
| A7 | Map markers are keyboard-focusable only when active (`keyboard:isActive`), which is good, but there is no "list" equivalent announced as the alternative to the map. | 1.1.1 / 2.1.1 | The NearbyList already is the alternative — label the map region `aria-label="Karte (saraksts zemāk)"` and keep the list first in DOM order on mobile. |

### Nice-to-Haves
| # | Suggestion | Rationale |
|---|------------|-----------|
| A8 | Visible "Pāriet uz sarakstu" link at the top of /karte. | Lets keyboard users skip the map controls. |
| A9 | `img` in admin submissions without `alt`. | Admin-only, but cheap to fix. |

### Keyboard Navigation Walkthrough
| Step | Action | Expected Focus | Expected Announcement | Plan Handles? |
|------|--------|---------------|----------------------|---------------|
| 1 | Tab on any page | "Pāriet uz saturu" skip link | link | ✓ |
| 2 | Enter on skip link | `<main id="saturs">` | main landmark | ✓ |
| 3 | Tab to header | wordmark link "meets.lv sākumlapa", nav links | link, current page | ✓ |
| 4 | Home: Tab into hero search | search input | "edit text" | ✗ no visible focus (A1) |
| 5 | Home: Tab to category chips / tiles | links with icon + title | link name = title (icon aria-hidden) | ✓ |
| 6 | /karte: Tab to location, search, filters | labelled buttons | "Mana atrašanās vieta", "Meklēt" | ✓ |
| 7 | Toggle a period chip | chip | "pressed" | ✓ (aria-pressed) |
| 8 | After filter change | — | new result count | ✗ on map (A2), ✓ on /pasakumi |
| 9 | Open "Vairāk filtru" | stays on button | "expanded" | ~ no Escape (A3) |
| 10 | Mobile: open place sheet | first control in sheet | dialog "Pasākumi vietā …" | ✓ focus trap |
| 11 | Escape in sheet / native dialogs | trigger | — | ✓ |
| 12 | Event card | card title link (covers card) | link with title | ✓ focus ring via `:has(:focus-visible)` |

### ARIA Checklist
| Element | Role | Label | States | Keyboard | Notes |
|---------|------|-------|--------|----------|-------|
| Skip link | link | "Pāriet uz saturu" | — | ✓ | |
| Header wordmark | link | "meets.lv sākumlapa" | — | ✓ | aria-label overrides visible text "meets.lv" — fine |
| Period / category chips | button (group) | text | aria-pressed | ✓ | |
| Filters toggle | button | text | aria-expanded | ✓ | A3 |
| Map locate / search | button | aria-label | disabled while searching | ✓ | |
| Sheet handle | button | "Paplašināt / Samazināt sarakstu" | — | ✓ | Drag has a button alternative |
| Mobile event sheet | dialog | "Pasākumi vietā …" | aria-modal | ✓ trap | |
| Native dialogs | dialog | aria-label | — | ✓ Escape | |
| Catalogue result count | — | — | aria-live polite | — | ✓ |
| Map result count | heading | — | — | — | A2 |
| Category icons | svg | — | aria-hidden, focusable=false | — | ✓ |
| Day heading big number | span | — | aria-hidden; sr-only date text | — | ✓ (#73) |

### Verdict Details
- Screen Reader Compatibility: PASS with A2, A4
- Keyboard Navigation: CONCERNS (A1, A3)
- Focus Management: PASS (native dialogs, sheet trap) with A3/A6
- Color Contrast: PASS — new palette text pairs ≥ 7:1 (Tinte on Sniegs 15.1:1, Teksts-2 on Sniegs 7.3:1, Tinte on Dzintars 7.1:1, white on Karmīns 7.2:1); some pre-existing grey meta text on white sits around 3.4–4:1 (e.g. #838a9e on white = 3.4:1) and should be darkened
- Motion Sensitivity: PASS — few animations, skeleton shimmer disabled under reduced motion
