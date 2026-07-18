import type { Metadata } from "next"

import { ParticipantsPage } from "@/components/pages/participants-page"

export const metadata: Metadata = {
  title: "Participants",
}

// Renders the participant listing and filtering route.
export default function Page() {
  return <ParticipantsPage />
}
