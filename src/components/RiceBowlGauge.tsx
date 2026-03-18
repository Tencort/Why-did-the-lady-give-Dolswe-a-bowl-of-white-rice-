/**
 * Role: 쌀밥 잔여량 시각화 — 거절 횟수에 따라 🍚 감소
 * Key Features: pill 형태, 라이트 테마
 * Dependencies: @/types
 */
'use client'

import { RejectionLevel } from '@/types'

interface Props { rejectionCount: RejectionLevel }

export default function RiceBowlGauge({ rejectionCount }: Props) {
  const remaining = 4 - rejectionCount
  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white shadow-sm"
      style={{ border: '1px solid #e5e8eb' }}>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <span key={i} className={`text-base transition-all duration-500 ${i < remaining ? 'opacity-100' : 'opacity-20 scale-75'}`}>
            🍚
          </span>
        ))}
      </div>
      {rejectionCount >= 4 && (
        <span className="text-[11px] font-bold text-sg-danger animate-pulse">박탈!</span>
      )}
    </div>
  )
}
