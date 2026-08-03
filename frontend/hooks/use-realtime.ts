'use client'

import { useRef, useCallback } from 'react'
import { Socket } from 'socket.io-client'
import { useRealtimeSocket } from '@/components/providers/realtime-provider'

export interface VoteUpdateData {
  participantId: string
  votes: number
  participantName: string
  timestamp: number
}

/** Payload broadcast to every client on each vote. */
export interface VoteGlobalData {
  participantId: string
  participantName: string
  category: string
  votesDelta: number
  totalVotes: number
  timestamp: number
}

/** Payload broadcast when a participant crosses a vote threshold. */
export interface VoteMilestoneData {
  participantId: string
  participantName: string
  totalVotes: number
  milestone: number
}

/** Replay payload sent to a client once, immediately after connect. */
export type VoteRecentData = VoteGlobalData[]

/**
 * Consumes the single shared Socket.IO connection created by
 * <RealtimeProvider> (mounted once in app/layout.tsx). Multiple components
 * can call this hook simultaneously without opening extra connections.
 */
export function useRealtime() {
  const socket = useRealtimeSocket()
  const socketRef = useRef<Socket | null>(socket)
  socketRef.current = socket

  const joinParticipant = useCallback((participantId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join:participant', participantId)
    } else {
      // Wait for connection then join
      socketRef.current?.once('connect', () => {
        socketRef.current?.emit('join:participant', participantId)
      })
    }
  }, [socket])

  const leaveParticipant = useCallback((participantId: string) => {
    socketRef.current?.emit('leave:participant', participantId)
  }, [socket])

  const onVoteUpdate = useCallback(
    (callback: (data: VoteUpdateData) => void) => {
      socketRef.current?.on('vote:update', callback)
      return () => {
        socketRef.current?.off('vote:update', callback)
      }
    },
    [socket],
  )

  const onLeaderboardUpdate = useCallback(
    (callback: (data: VoteUpdateData) => void) => {
      socketRef.current?.on('leaderboard:update', callback)
      return () => {
        socketRef.current?.off('leaderboard:update', callback)
      }
    },
    [socket],
  )

  /** Listen for global vote events. Fired on every vote. */
  const onVoteGlobal = useCallback(
    (callback: (data: VoteGlobalData) => void) => {
      socketRef.current?.on('vote:global', callback)
      return () => {
        socketRef.current?.off('vote:global', callback)
      }
    },
    [socket],
  )

  /** Listen for milestone events. Fired when a participant crosses
   * a 500/1000/2500/5000/10000 vote boundary. */
  const onVoteMilestone = useCallback(
    (callback: (data: VoteMilestoneData) => void) => {
      socketRef.current?.on('vote:milestone', callback)
      return () => {
        socketRef.current?.off('vote:milestone', callback)
      }
    },
    [socket],
  )

  /** Listen for the recent-votes replay. Fired once on connect. */
  const onVoteRecent = useCallback(
    (callback: (data: VoteRecentData) => void) => {
      socketRef.current?.on('vote:recent', callback)
      return () => {
        socketRef.current?.off('vote:recent', callback)
      }
    },
    [socket],
  )

  return {
    joinParticipant,
    leaveParticipant,
    onVoteUpdate,
    onLeaderboardUpdate,
    onVoteGlobal,
    onVoteMilestone,
    onVoteRecent,
  }
}