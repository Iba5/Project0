import type { Metadata } from "next"

import { SocialRouterPage } from "@/components/pages/social-router-page"

export const metadata: Metadata = {
  title: "Social Router",
}

// Renders the social synchronization status route.
export default function Page() {
  return <SocialRouterPage />
}
