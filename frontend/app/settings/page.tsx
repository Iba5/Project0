import type { Metadata } from "next"

import { SettingsPage } from "@/components/pages/settings-page"

export const metadata: Metadata = {
  title: "Settings",
}

// Renders the account and notification settings route.
export default function Page() {
  return <SettingsPage />
}
