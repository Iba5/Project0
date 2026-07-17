import type { Metadata } from "next"

import { AuthLoginPage } from "@/components/pages/auth-login-page"

export const metadata: Metadata = {
  title: "Login",
}

// Renders the login route with backend-connected auth controls.
export default function Page() {
  return <AuthLoginPage />
}
