import { create } from 'zustand'

type AppStore = {
  selectedParticipant: {
    id: string; name: string; category: string; platform: string
    videoUrl: string; status: string; votes: number
    bio?: string | null; imageUrl?: string | null; eventId?: string | null
  } | null
  selectParticipant: (p: AppStore['selectedParticipant']) => void

  selectedEvent: {
    id: string; name: string; description: string | null; banner: string | null
    startDate: string; endDate: string; status: string; votePrice: number
    votesPerPayment: number; currency: string; votingOpens: string | null
    votingCloses: string | null; publicLeaderboard: boolean
    allowedCategories: string; allowedPlatforms: string
  } | null
  selectEvent: (e: AppStore['selectedEvent']) => void

  isVotingUnlocked: boolean
  unlockVoting: () => void

  selectedPaymentMethod: string | null
  setSelectedPaymentMethod: (id: string | null) => void

  categoryFilter: string
  setCategoryFilter: (cat: string) => void
}

export const useAppStore = create<AppStore>((set) => ({
  selectedParticipant: null,
  selectParticipant: (p) => set({ selectedParticipant: p }),
  selectedEvent: null,
  selectEvent: (e) => set({ selectedEvent: e }),
  isVotingUnlocked: false,
  unlockVoting: () => set({ isVotingUnlocked: true }),
  selectedPaymentMethod: null,
  setSelectedPaymentMethod: (id) => set({ selectedPaymentMethod: id }),
  categoryFilter: 'All',
  setCategoryFilter: (cat) => set({ categoryFilter: cat }),
}))