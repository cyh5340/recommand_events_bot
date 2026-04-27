// Route segment config — gives Vercel up to 60 s for scrape + AI inference.
export const maxDuration = 60

import EventForm from '@/app/_components/EventForm'

export default function Page() {
  return <EventForm />
}
