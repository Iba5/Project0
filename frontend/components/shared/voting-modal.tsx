'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Vote, CheckCircle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface VotingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  participantName: string
  participantCategory: string
  currentVotes: number
  onVote: () => Promise<void>
}

export function VotingModal({
  open,
  onOpenChange,
  participantName,
  participantCategory,
  currentVotes,
  onVote,
}: VotingModalProps) {
  const [voting, setVoting] = useState(false)
  const [voted, setVoted] = useState(false)

  const handleVote = async () => {
    setVoting(true)
    try {
      await onVote()
      setVoted(true)
      // Auto close after showing success
      setTimeout(() => {
        setVoted(false)
        onOpenChange(false)
      }, 2000)
    } catch {
      // Error handling is done by the parent
    } finally {
      setVoting(false)
    }
  }

  const handleClose = () => {
    if (!voting) {
      setVoted(false)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-md"
        style={{
          background: '#121824',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          color: '#F8FAFC',
        }}
      >
        <AnimatePresence mode="wait">
          {voted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex flex-col items-center justify-center py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
                style={{ background: 'rgba(16,185,129,0.15)' }}
              >
                <CheckCircle className="w-10 h-10" style={{ color: '#10B981' }} />
              </motion.div>
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl font-bold mb-2"
                style={{ color: '#F8FAFC' }}
              >
                Vote Submitted!
              </motion.h3>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-sm text-center"
                style={{ color: '#94A3B8' }}
              >
                Your vote for {participantName} has been recorded.
              </motion.p>
              {/* Confetti particles */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: 0,
                    scale: 1,
                    x: (Math.random() - 0.5) * 200,
                    y: (Math.random() - 0.5) * 200,
                  }}
                  transition={{ duration: 1, delay: 0.2 + i * 0.05 }}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    background: i % 2 === 0 ? '#F59E0B' : '#10B981',
                    top: '50%',
                    left: '50%',
                  }}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="vote"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DialogHeader>
                <DialogTitle style={{ color: '#F8FAFC' }}>
                  Vote for {participantName}
                </DialogTitle>
                <DialogDescription style={{ color: '#94A3B8' }}>
                  Confirm your vote to support this performer
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Participant Info Card */}
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-sm" style={{ color: '#F8FAFC' }}>
                        {participantName}
                      </h4>
                      <Badge
                        className="mt-1.5 text-xs"
                        style={{
                          background: 'rgba(245,158,11,0.15)',
                          color: '#F59E0B',
                          borderColor: 'rgba(245,158,11,0.3)',
                        }}
                      >
                        {participantCategory}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5">
                        <Vote className="w-4 h-4" style={{ color: '#F59E0B' }} />
                        <span className="text-lg font-bold" style={{ color: '#F59E0B' }}>
                          {currentVotes.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: '#64748B' }}>current votes</p>
                    </div>
                  </div>
                </div>

                {/* Vote Info */}
                <div
                  className="rounded-xl p-3 flex items-center justify-between"
                  style={{
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.15)',
                  }}
                >
                  <span className="text-sm" style={{ color: '#94A3B8' }}>
                    Your vote will be added
                  </span>
                  <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>
                    +1 vote
                  </span>
                </div>

                {/* Vote Button */}
                <Button
                  onClick={handleVote}
                  disabled={voting}
                  className="w-full h-12 rounded-full font-semibold text-base gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    color: '#0B0F17',
                  }}
                >
                  {voting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting Vote...
                    </>
                  ) : (
                    <>
                      <Vote className="w-4 h-4" />
                      Vote for {participantName}
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
