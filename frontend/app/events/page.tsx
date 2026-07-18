import type { Metadata } from "next"

import { EventsPage } from "@/components/pages/events-page"

export const metadata: Metadata = {
  title: "Events",
}

// Renders the event management route.
export default function Page() {
  return <EventsPage />
}
