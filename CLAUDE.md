# CLAUDE.md — recommand_events

## Project overview

**EventMatch** — AI-powered multi-platform event recommender. Users paste their professional context, pick a city, and receive 5 ranked event matches scraped live from Lu.ma, Eventbrite, Meetup, Partiful, and SwarmTix (all platforms defined in `platforms.json`).

No database. No auth. Single server action. Fully stateless and Vercel-compatible.

---

## Tech stack

| Layer | Library/Tool | Version |
|---|---|---|
| Framework | Next.js (App Router) | ^15 |
| Language | TypeScript (strict) | ^5 |
| UI | React | ^19 |
| Styling | Tailwind CSS | ^3.4 |
| Icons | Lucide React | ^0.400 |
| LLM | Google Gemini 2.0 Flash via Vercel AI SDK | `@ai-sdk/google ^1` |
| Scraping | Apify | `apify-client ^2` |
| Validation | Zod | ^3.22 |
| Class utils | clsx + tailwind-merge | — |

Package manager: **npm**

---

## File map

```
app/
  page.tsx               — Root page, sets maxDuration: 60 (Vercel)
  layout.tsx             — Root layout, metadata, dark mode
  globals.css            — Global Tailwind base
  actions.ts             — THE core: getEventRecommendations() server action
  _components/
    EventForm.tsx        — Entire UI: form, loading, results

lib/
  utils.ts               — cn() helper (clsx + twMerge)

platforms.json           — Platform registry: name, URL, Apify actor, priority, signal
.env.local               — Secrets (gitignored)
.env.local.example       — Template with both required keys
next.config.ts           — serverActions.bodySizeLimit: "4mb"
tailwind.config.ts       — custom pulse-slow animation
```

---

## Environment variables

Both are required; the app hard-errors if either is missing.

```
APIFY_TOKEN=...
GOOGLE_GENERATIVE_AI_API_KEY=...
```

---

## Platform registry (`platforms.json`)

All scraped platforms are declared here. Each entry has:

```json
{
  "name": "Lu.ma",
  "url": "https://lu.ma/discover",
  "type": "Community & Hacker",
  "priority": 1,
  "apify_actor": "matyascimbulka/luma-event-scraper",
  "signal": "High for AI, Founders, and Crypto."
}
```

Adding a new platform = adding an entry here. No code changes needed unless the actor requires non-standard input.

**Actor input mapping** (in `buildActorInput`, `app/actions.ts`):
- `matyascimbulka/luma-event-scraper` → `{ slugs: ['tech','ai','crypto'], cities: [location], maxEventsPerCity: 40 }`
- `apify/website-content-crawler` → `{ startUrls: [{ url }], maxCrawledPages: 3 }`

---

## Data flow

```
User fills EventForm (client)
  → calls getEventRecommendations(userContext, location) [server action]
    → All platforms in platforms.json scraped in parallel via Promise.allSettled
    → Events from successful platforms aggregated with platform tags
    → Gemini 2.0 Flash receives all events + userContext
    → Returns structured JSON validated by EventSchema (Zod)
  → EventForm renders up to 5 EventCard components (each showing source platform)
```

Partial failures are tolerated: if some platforms fail to scrape, the action continues with whatever data was collected.

---

## Core types

```ts
// app/actions.ts
const EventSchema = z.object({
  events: z.array(z.object({
    eventTitle: z.string(),
    date: z.string(),
    link: z.string(),
    platform: z.string(),       // e.g. "Lu.ma", "Eventbrite"
    matchScore: z.number().min(0).max(100),
    networkInsight: z.string(), // exactly 1-2 sentences
  })).max(5),
});

type EventRecommendation = z.infer<typeof EventSchema>['events'][number];
type RecommendResult = { events: EventRecommendation[] } | { error: string };
```

---

## Server action: `getEventRecommendations`

Location: `app/actions.ts`

Steps:
1. Validate API keys exist — return `{ error }` if missing
2. Run all platform Apify scrapers in parallel via `Promise.allSettled`
3. Aggregate events; tag each with its source platform name
4. Gemini prompt does 4-step analysis:
   - **Step 1** — Classify user intent (career stage, primary goal, target industry)
   - **Step 2** — Score each event: Host Credibility (30%) + Intent Match (30%) + Professional Relevance (40%)
   - **Step 3** — Apply score tiers (Golden Path / High Signal / Moderate / Low Priority)
   - **Step 4** — Apply intent-specific weighting rules
5. Returns top 5 events sorted descending by `matchScore`, validated via Zod

---

## UI components (`app/_components/EventForm.tsx`)

All client-side (`"use client"`).

| Component | Purpose |
|---|---|
| `EventForm` | Root: manages all state, calls server action |
| `MatchingProgress` | 6-step animated loading indicator |
| `LiveBadge` | "Live · 5 Platforms" pill |
| `ScoreBadge` | Color-coded score: ≥90 gold, ≥70 green, ≥50 indigo, else gray |
| `EventCard` | Single event: rank, platform badge, score, title, date, insight, CTA link |

**State in EventForm:**
- `userContext: string` — textarea value
- `location: string` — selected city or custom input
- `events: EventRecommendation[]` — results array
- `error: string` — error message
- `isPending: boolean` — via `useTransition`

**Preset cities:** San Francisco, New York, Los Angeles, Austin, London, Berlin

---

## Scripts

```bash
npm run dev      # localhost:3000
npm run build    # production build
npm run start    # serve production build
npm run lint     # ESLint
```

No test runner configured.

---

## Constraints & gotchas

- **No REST routes** — everything goes through the single `getEventRecommendations` server action
- **60-second Vercel timeout** — set via `export const maxDuration = 60` in `page.tsx`; scraping 5 platforms + Gemini can be slow; consider reducing `maxEvents` per platform if timeouts occur
- **Body size limit** — `next.config.ts` sets 4 MB for server actions (aggregated scrape data can be large)
- **Stateless** — no persistence; each request is fully independent
- **Gemini model** — currently `gemini-2.0-flash`; check `actions.ts` for the exact model string before changing
- **Location coverage** — Lu.ma passes the city via `cities: [location]`; Partiful and SwarmTix use their hardcoded `url` from `platforms.json` and do not reflect custom city selections
- **Partial failure tolerance** — `Promise.allSettled` means the action succeeds as long as at least one platform returns data; individual scraper errors are surfaced only if all platforms fail
- **Zod strict** — EventSchema validates response; AI hallucinating extra fields will be stripped, wrong types will throw
