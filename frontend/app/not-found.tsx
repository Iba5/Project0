import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-6xl font-extrabold tracking-tight text-foreground">404</h1>
      <p className="mt-3 text-lg text-muted-foreground">Page not found</p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-foreground px-6 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
      >
        Back to Home
      </Link>
    </div>
  )
}