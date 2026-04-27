'use server'

import { ApifyClient } from 'apify-client'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import platformsConfig from '@/platforms.json'

// ── Output schema ─────────────────────────────────────────────────────────────

const EventSchema = z.object({
  events: z
    .array(
      z.object({
        eventTitle: z.string().describe('Full name of the event'),
        date: z.string().describe('Human-readable date and time, e.g. "May 15 · 6:00 PM"'),
        link: z.string().describe('Direct URL to the event page'),
        platform: z.string().describe('Platform name this event came from, e.g. "Lu.ma", "Eventbrite", "Meetup"'),
        matchScore: z
          .number()
          .min(0)
          .max(100)
          .describe(
            'ROI score 0-100. 100 = "Golden Path" — the host/attendee profile is the exact career catalyst for the user\'s next move. Host Credibility 30% + Intent Match 30% + Professional Relevance 40%.',
          ),
        networkInsight: z
          .string()
          .describe(
            'Exactly 1-2 sentences. Sentence 1: name a specific host title, company, or guest credential pulled from the scraped data. Sentence 2: connect that signal directly to the user\'s stated career goal.',
          ),
      }),
    )
    .max(5),
})

export type EventRecommendation = z.infer<typeof EventSchema>['events'][number]
export type RecommendResult = { events: EventRecommendation[] } | { error: string }

// ── Career-strategist system prompt ──────────────────────────────────────────

const SYSTEM_PROMPT = `You are a Career Strategist AI. Your sole metric is "Efficiency of Time" — every recommendation must justify itself as the highest-ROI use of the user's limited networking hours.

━━ STEP 1 · INTENT CLASSIFICATION ━━
From userContext, extract:
• Career Stage: IC | Senior IC | Manager/Director | Founder | Executive
• Primary Goal (pick exactly one):
    "Industry Switch"   — moving to a new domain or tech stack
    "Lead Generation"   — BD, sales, or partnership building
    "Hiring"            — sourcing engineers or operators
    "Venture Funding"   — raising capital or scouting investments
    "Peer Networking"   — lateral thought-leadership, community
• Target Industry / Role

━━ STEP 2 · EVENT ROI SCORING (0-100) ━━
Score each event object across all platforms:

  Host Credibility         (max 30 pts)
    hosts[].linkedInUrl present + FAANG / Tier-1 VC / unicorn → 25-30
    Mid-tier known brand                                        → 15-24
    Unknown host                                                → 0-10

  Intent Match             (max 30 pts)
    "Industry Switch":  featuredGuests present → 28-30; Workshop → 22-27; Happy Hour → 2-5
    "Venture Funding":  host has VC/investor background → 28-30
    "Hiring":           hackathon / high-eng-density event → 25-28
    Perfect keyword overlap in description                      → +5 bonus

  Professional Relevance   (max 40 pts)
    Topic directly maps to user's target industry/role → 35-40
    Partial alignment                                  → 15-34
    Tangential                                         → 0-14

  matchScore = sum of all three categories.

━━ STEP 3 · SCORE TIERS ━━
  90-100  "Golden Path"  — host/attendee is the exact career catalyst
  70-89   "High Signal"  — strong alignment, high networking value
  50-69   "Moderate"     — relevant but indirect
  <50     "Low Priority" — skip

━━ STEP 4 · INTENT WEIGHTING RULES ━━
• "Industry Switch"   → Penalise pure happy hours (cap score at 45). Boost events with named featuredGuests.
• "Venture Funding"   → If host company is a VC firm or accelerator, add 15 pts.
• "Hiring"            → Boost hackathons, university events, and open-source community meetups.

━━ OUTPUT RULES ━━
• Return ONLY the top 5 events sorted by matchScore descending. Pick the best events across ALL platforms — do not limit to one source.
• networkInsight must reference a SPECIFIC host title, company name, or guest credential from the raw data — never generic statements.
• Extract the event URL from the scraped data. Use whatever URL field is present in the raw event object.
• The platform field must match the <platform name="..."> tag the event came from.
• Do NOT hallucinate events not present in the raw data.`

// ── Per-platform scraping ─────────────────────────────────────────────────────

type Platform = (typeof platformsConfig.platforms)[number]

function buildActorInput(platform: Platform, location: string): Record<string, unknown> {
  switch (platform.apify_actor) {
    case 'matyascimbulka/luma-event-scraper':
      return { slugs: ['tech', 'ai', 'crypto'], cities: [location], maxEventsPerCity: 40 }
    case 'apify/website-content-crawler':
      return { startUrls: [{ url: platform.url }], maxCrawledPages: 3 }
    default:
      return { startUrls: [{ url: platform.url }] }
  }
}

async function scrapePlatform(
  apify: ApifyClient,
  platform: Platform,
  location: string,
): Promise<{ platform: string; events: unknown[] }> {
  const input = buildActorInput(platform, location)
  const run = await apify.actor(platform.apify_actor).call(input)
  const { items } = await apify.dataset(run.defaultDatasetId).listItems()
  return { platform: platform.name, events: items }
}

// ── Server Action ─────────────────────────────────────────────────────────────

export async function getEventRecommendations(
  userContext: string,
  location: string,
): Promise<RecommendResult> {
  const apifyToken = process.env.APIFY_TOKEN
  const openaiKey  = process.env.OPENAI_API_KEY

  if (!apifyToken) return { error: 'APIFY_TOKEN is not configured.' }
  if (!openaiKey)  return { error: 'OPENAI_API_KEY is not configured.' }

  const apify = new ApifyClient({ token: apifyToken })
  const { platforms } = platformsConfig

  // ── Step 1: Scrape all platforms in parallel ──────────────────────────────
  const settled = await Promise.allSettled(
    platforms.map((p) => scrapePlatform(apify, p, location)),
  )

  const platformResults: Array<{ platform: string; events: unknown[] }> = []
  const scrapeErrors: string[] = []

  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      platformResults.push(result.value)
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason)
      scrapeErrors.push(`${platforms[i].name}: ${msg}`)
    }
  })

  const totalEvents = platformResults.reduce((sum, p) => sum + p.events.length, 0)

  if (totalEvents === 0) {
    const detail = scrapeErrors.length > 0 ? ` Scrape errors: ${scrapeErrors.join('; ')}` : ''
    return { error: `No events found for "${location}" across any platform.${detail}` }
  }

  // ── Step 2: Career-strategist ranking via Gemini ──────────────────────────
  try {
    const eventsPayload = platformResults
      .filter((p) => p.events.length > 0)
      .map(
        ({ platform, events }) =>
          `<platform name="${platform}" count="${events.length}">\n${JSON.stringify(events, null, 2)}\n</platform>`,
      )
      .join('\n\n')

    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: EventSchema,
      system: SYSTEM_PROMPT,
      prompt: `<user_context>
${userContext}
</user_context>

<events location="${location}" total="${totalEvents}">
${eventsPayload}
</events>

Execute all four steps. Return the top 5 High-Signal Matches with matchScore, networkInsight, and the correct platform name for each event.`,
    })

    return { events: [...object.events].sort((a, b) => b.matchScore - a.matchScore) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: `AI ranking error: ${msg}` }
  }
}
