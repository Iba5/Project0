import { redirect } from "next/navigation"

// Sends the root path into the dashboard so the admin area opens immediately.
export default function Home() {
  redirect("/dashboard")
}
