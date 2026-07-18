import type { Metadata } from "next"

import { AuthSignupPage } from "@/components/pages/auth-signup-page"

export const metadata: Metadata = {
  title: "Sign Up",
}

// Renders the account creation route for new admins.
export default function Page() {
  return <AuthSignupPage />
}
