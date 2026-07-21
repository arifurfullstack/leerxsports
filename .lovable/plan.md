# Public Browse Experience

A single public route `/browse` with four tabs — **Trainers**, **Classes**, **Posts**, **Community** — each with server-side text search, filters, and pagination. All state lives in the URL (shareable & SSR-friendly) and every card surfaces the seeded demo relationships (trainer↔posts, threads↔replies, etc.).

## What ships

### 1. Server functions (`src/lib/browse-functions.ts`)
Public, publishable-key Supabase client (no auth needed, respects RLS anon reads that already exist).

- `browseTrainers({ q, country, specialty, verifiedOnly, sort, page })`
  - Text search on `username`, `display_name`, `bio` (ilike).
  - Facet filters: `country`, `specialty`, `verifiedOnly`.
  - Sort: `top` (subscriber count desc), `new`, `price_low`, `price_high`.
  - Returns `{ items, total, page, pageSize }` — each item enriched with `post_count` and `subscriber_count` (grouped counts scoped to demo/live trainers).
- `browseClasses({ q, category, level, sort, page })` — search title/instructor, filters by category/level, sort by price/new.
- `browsePosts({ q, kind, country, specialty, verifiedOnly, sort, page })` — search caption, includes trainer summary + `comment_count`/`respect_count` so posts visibly link back to their trainer.
- `browseCommunity({ q, kind, trainerAnswered, sort, page })` — search title/body/hashtags, filter Q&A vs FLEX, "trainer answered" toggle, sort new/top/trending. Each item carries `reply_count` and top-reply preview to show thread↔reply linkage.
- `getBrowseFacets()` — returns countries, specialties, class categories, class levels (deduped, sorted). Cached with `staleTime: 5 min` in the loader.

Pagination: fixed `pageSize = 24`. Uses Postgres `.range()` + `count: "exact"` head query for totals. Every `.select(...)` string is passed through a `sel(s: string): string` helper and results pinned with `.returns<Row[]>()` to keep tsc fast.

### 2. Route `/browse` (`src/routes/browse.tsx`)
- `validateSearch` with zod-adapter `fallback()` covering `tab`, `q`, `page`, and per-tab filter keys.
- Loader primes `getBrowseFacets()` + the active tab's first-page query via `context.queryClient.ensureQueryData`.
- Component uses `useSuspenseQuery` for facets + active tab list.
- Tabs are `<Link>` with `search: { tab: "..." }`; switching a tab resets `page` to 1 but keeps `q`.
- Debounced search input (250ms) that calls `navigate({ search: prev => ({ ...prev, q, page: 1 }) })`.
- Filter chips (country, specialty, verifiedOnly, etc.) update search params identically.
- Pagination footer: Prev / Next + "Page X of Y · N results"; buttons disabled at bounds.
- `errorComponent` + `notFoundComponent` per template rules; unique `head()` metadata (title, description, og:*).

### 3. Card components (co-located in the route file)
Each card renders relations from the seed:

```text
Trainer card       → avatar, verified badge, country, specialties, post_count, subscriber_count, price/mo → /trainers/$username
Class card         → cover, category badge, instructor name, level, spots left, price → /classes/$classId
Post card (grid)   → media/thumbnail, premium lock, trainer avatar+name, respect/comment counts → /trainers/$username
Community card     → kind badge, title, author, reply_count, "Trainer answered" badge, top reply snippet
```

### 4. Navigation wiring
- Add a "Browse" link to `src/components/navbar.tsx` (public, no auth required) pointing at `/browse`.
- Existing `/trainers`, `/classes`, `/community`, `/explore` routes stay as-is; the new page is an additive unified surface.

### 5. Sitemap
Add `/browse` to `src/routes/sitemap[.]xml.ts`.

### 6. Verification
- `bun test:demo-integrity` still passes (no schema change).
- Manual smoke: hit `/browse?tab=trainers&q=yoga&page=2`, `/browse?tab=community&trainerAnswered=1`, etc., confirm results, counts, and pagination reflect the demo data.

## Technical notes

- All queries use a **publishable-key** server-side Supabase client (no session). Reads rely on existing RLS anon-read policies for `profiles`, `trainer_profiles`, `posts`, `sports_classes`, `community_posts`, `community_comments`. If any policy is missing anon SELECT, we add a narrow `TO anon` policy in the same change (checked first via `supabase--read_query` on `pg_policies`).
- Related counts (`post_count`, `subscriber_count`, `reply_count`) are computed with grouped `count` queries batched by ids, not per-row N+1.
- URL is the single source of truth for filter/search/page state (no `useState` for filters) — enables shareable links and back/forward.
- `pageSize` fixed at 24 to keep counts predictable; can be tuned later.

## Non-goals

- No schema changes, no auth changes, no edits to `/trainers`, `/classes`, `/community`, `/explore` beyond adding a nav link.
- No infinite scroll — classic prev/next pagination per user's request wording ("pagination").
