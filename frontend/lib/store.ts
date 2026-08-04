import { create } from 'zustand'

export type ViewName =
  | 'landing'
  | 'contestants'
  | 'contestant-detail'
  | 'leaderboard'
  | 'events'
  | 'payment'
  | 'compare'
  | 'admin-login'
  | 'admin-dashboard'
  | 'admin-events'
  | 'admin-participants'
  | 'admin-payments'
  | 'admin-payment-methods'
  | 'admin-settings'
  | 'admin-admins'
  | 'admin-audit'
  | 'admin-forgot-password'
  | 'notifications'

/**
 * Maps a legacy ViewName to its real Next.js route path.
 * Used while migrating away from Zustand-based view switching to real routing.
 */
export function viewToPath(view: ViewName): string {
  if (view === 'landing') return '/'
  if (view === 'admin-login') return '/admin/login'
  if (view === 'admin-forgot-password') return '/reset-password'
  if (view.startsWith('admin-')) return `/admin/${view.replace('admin-', '')}`
  return `/${view}`
}

export type AdminUser = {
  id: string
  name: string
  email: string
  role: string
}

type AppStore = {
  selectedParticipantId: string | null
  setSelectedParticipantId: (id: string | null) => void

  selectedEventId: string | null
  setSelectedEventId: (id: string | null) => void

  selectedPaymentMethod: string | null
  setSelectedPaymentMethod: (id: string | null) => void

  categoryFilter: string
  setCategoryFilter: (cat: string) => void

  eventFilter: string
  setEventFilter: (filter: string) => void

  adminUser: AdminUser | null
  setAdminUser: (user: AppStore['adminUser']) => void

  // Auth loading state
  authLoading: boolean
  setAuthLoading: (loading: boolean) => void

  paymentParticipantId: string | null
  setPaymentParticipantId: (id: string | null) => void

  compareIds: string[]
  setCompareIds: (ids: string[]) => void

  // Global search state (Task 11-C)
  searchQuery: string
  setSearchQuery: (q: string) => void
  isSearchOpen: boolean
  setSearchOpen: (open: boolean) => void
}

export const useAppStore = create<AppStore>((set, _get) => ({
  selectedParticipantId: null,
  setSelectedParticipantId: (id) => set({ selectedParticipantId: id }),

  selectedEventId: null,
  setSelectedEventId: (id) => set({ selectedEventId: id }),

  selectedPaymentMethod: null,
  setSelectedPaymentMethod: (id) => set({ selectedPaymentMethod: id }),

  categoryFilter: 'All',
  setCategoryFilter: (cat) => set({ categoryFilter: cat }),

  eventFilter: 'All',
  setEventFilter: (filter) => set({ eventFilter: filter }),

  adminUser: null, // No longer loading from localStorage - backend is source of truth
  setAdminUser: (user) => {
    console.log('[Store] Setting admin user from backend:', user)
    set({ adminUser: user })
  },

  authLoading: true, // Start in loading state
  setAuthLoading: (loading) => set({ authLoading: loading }),

  paymentParticipantId: null,
  setPaymentParticipantId: (id) => set({ paymentParticipantId: id }),

  compareIds: [],
  setCompareIds: (ids) => set({ compareIds: ids }),

  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  isSearchOpen: false,
  setSearchOpen: (open) => set({ isSearchOpen: open }),
}))
