'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  MapPin,
  Sparkles,
  ExternalLink,
  Calendar,
  Zap,
  AlertCircle,
  PlayCircle,
  Users,
  Brain,
  TrendingUp,
  Award,
  Check,
  Network,
  Globe,
} from 'lucide-react'
import { getEventRecommendations, type EventRecommendation } from '@/app/actions'
import { cn } from '@/lib/utils'

const PRESET_CITIES = ['San Francisco', 'New York', 'Los Angeles', 'Austin', 'London', 'Berlin']

const LOADING_STEPS = [
  { icon: PlayCircle,   label: 'Launching scrapers across all platforms...' },
  { icon: Globe,        label: 'Collecting events from Lu.ma, Eventbrite, Meetup & more...' },
  { icon: Users,        label: 'Collecting host profiles & featured guests...' },
  { icon: Brain,        label: 'Classifying your career intent...' },
  { icon: TrendingUp,   label: 'Calculating networking ROI score...' },
  { icon: Award,        label: 'Selecting High-Signal Matches...' },
]

export default function EventForm() {
  const [userContext, setUserContext] = useState('')
  const [location, setLocation] = useState('San Francisco')
  const [customLocation, setCustomLocation] = useState('')
  const [events, setEvents] = useState<EventRecommendation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const activeLocation = customLocation.trim() || location

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEvents(null)

    startTransition(async () => {
      const result = await getEventRecommendations(userContext, activeLocation)
      if ('error' in result) {
        setError(result.error)
      } else {
        setEvents(result.events)
      }
    })
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      {/* Nav */}
      <header className="border-b border-white/10 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold">EventMatch</span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-white/40">
            <Zap className="w-3 h-3 text-yellow-400" />
            Gemini 2.0 Flash · Apify
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-16 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">
            Your Instant{' '}
            <span className="text-indigo-400">Event Concierge</span>
          </h1>
          <p className="text-lg text-white/55 max-w-xl mx-auto">
            AI ranks events across Lu.ma, Eventbrite, Meetup, and more by networking ROI —
            host credibility, career intent, and social proof — not just keywords.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 space-y-6"
        >
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/80">
              Professional Context or LinkedIn URL
            </label>
            <textarea
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              placeholder={`Describe your role and what you're trying to accomplish.\n\nExample: "Senior ML Engineer at a Series B fintech. I'm looking to switch into AI infrastructure and meet founders who are actively hiring senior engineers in that space."`}
              rows={5}
              required
              className="w-full rounded-xl bg-white/10 border border-white/20 placeholder:text-white/30 text-sm px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition"
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-1.5 text-sm font-medium text-white/80">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              Geographic Focus
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_CITIES.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => { setLocation(city); setCustomLocation('') }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    location === city && !customLocation
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white',
                  )}
                >
                  {city}
                </button>
              ))}
            </div>
            <input
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              placeholder="Or type a custom city..."
              className="w-full rounded-xl bg-white/10 border border-white/20 placeholder:text-white/30 text-sm px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || !userContext.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm transition-all"
          >
            <Sparkles className="w-4 h-4" />
            {isPending ? 'Analyzing…' : 'Find High-Signal Events'}
          </button>
        </form>

        {/* AI thought-process breakdown — visible while loading */}
        {isPending && <MatchingProgress />}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Results */}
        {events && events.length > 0 && (
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">High-Signal Matches</h2>
              <LiveBadge />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((event, i) => (
                <EventCard key={i} event={event} rank={i + 1} />
              ))}
            </div>
          </section>
        )}

        {events && events.length === 0 && (
          <p className="text-center text-white/40 text-sm py-8">
            No high-signal events found. Try expanding your profile description or switching to a larger city.
          </p>
        )}
      </div>
    </main>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MatchingProgress() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (step >= LOADING_STEPS.length - 1) return
    const id = setTimeout(() => setStep((s) => s + 1), 2400)
    return () => clearTimeout(id)
  }, [step])

  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
        AI Thought Process
      </p>
      <ul className="space-y-3">
        {LOADING_STEPS.map(({ icon: Icon, label }, i) => {
          const isDone    = i < step
          const isCurrent = i === step
          const isAhead   = i > step
          return (
            <li
              key={i}
              className={cn(
                'flex items-center gap-3 text-sm transition-all duration-500',
                isDone    && 'text-white/30',
                isCurrent && 'text-white',
                isAhead   && 'text-white/20',
              )}
            >
              <span
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all',
                  isDone    && 'bg-white/10',
                  isCurrent && 'bg-indigo-500 shadow-lg shadow-indigo-500/40',
                  isAhead   && 'bg-white/5',
                )}
              >
                {isDone ? (
                  <Check className="w-3 h-3 text-white/40" />
                ) : (
                  <Icon
                    className={cn(
                      'w-3 h-3',
                      isCurrent && 'text-white animate-pulse',
                      isAhead   && 'text-white/20',
                    )}
                  />
                )}
              </span>
              <span>{label}</span>
              {isCurrent && (
                <span className="ml-auto flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce"
                      style={{ animationDelay: `${d * 150}ms` }}
                    />
                  ))}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function LiveBadge() {
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      Live · 5 Platforms
    </span>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const rounded = Math.round(score)
  const { ring, label } =
    score >= 90 ? { ring: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',  label: 'Golden Path'  } :
    score >= 70 ? { ring: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: 'High Signal' } :
    score >= 50 ? { ring: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',  label: 'Moderate'     } :
                  { ring: 'bg-slate-500/15  text-slate-400  border-slate-500/30',   label: 'Low Priority' }

  return (
    <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold', ring)}>
      <span className="tabular-nums">{rounded}</span>
      <span className="font-normal opacity-70">{label}</span>
    </span>
  )
}

function EventCard({ event, rank }: { event: EventRecommendation; rank: number }) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-indigo-500/40 hover:bg-white/[0.07] transition-all">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white/30">#{rank}</span>
          <span className="text-xs text-white/30 bg-white/5 border border-white/10 rounded-md px-1.5 py-0.5">
            {event.platform}
          </span>
        </div>
        <ScoreBadge score={event.matchScore} />
      </div>

      {event.date && (
        <span className="flex items-center gap-1.5 text-xs text-white/40">
          <Calendar className="w-3 h-3" />
          {event.date}
        </span>
      )}

      <h3 className="font-semibold leading-snug text-white">{event.eventTitle}</h3>

      {/* Network Insight */}
      <div className="flex items-start gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
        <Network className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed text-white/60">{event.networkInsight}</p>
      </div>

      <a
        href={event.link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-indigo-500/40 py-2.5 text-xs font-medium text-indigo-400 hover:bg-indigo-500 hover:text-white hover:border-transparent transition-all"
      >
        View Event <ExternalLink className="w-3 h-3" />
      </a>
    </article>
  )
}
