import { PublicHeader } from '@/components/public/public-header'
import { PublicFooter } from '@/components/public/public-footer'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="layout-sticky-footer" style={{ background: '#0B0F17' }}>
      <PublicHeader />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <PublicFooter />
    </div>
  )
}
