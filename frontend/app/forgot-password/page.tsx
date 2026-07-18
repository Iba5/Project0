import type { Metadata } from "next"

import { ForgotPasswordPage } from "@/components/pages/forgot-password-page"

export const metadata: Metadata = {
  title: "Forgot Password",
}

// Renders the password recovery route with a secure request flow.
export default function Page() {
  return <ForgotPasswordPage />
}
