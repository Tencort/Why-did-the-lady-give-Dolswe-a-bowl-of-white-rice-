/**
 * Role: RPG 턴제 대화창 — 마님/돌쇠 대사 + 캐릭터 이미지 + 수락/거절 버튼
 * Key Features: 대화 로그, 감정별 이미지, 이모지 fallback, 음식점 정보 카드
 * Dependencies: next/image, @/types
 */
'use client'

import Image from 'next/image'
import { DialogueMessage, Restaurant, ManimEmotion } from '@/types'

interface Props {
  dialogues: DialogueMessage[]
  currentRestaurant: Restaurant | null
  onAccept: () => void
  onReject: () => void
  isMapMode: boolean
}

/** 감정별 마님 캐릭터 이미지 경로 */
const MANIM_IMAGE: Record<ManimEmotion, string> = {
  normal: '/characters/manim-normal.png',
  sad: '/characters/manim-normal.png',
  angry: '/characters/manim-angry.png',
  furious: '/characters/manim-furious.png',
}

/** RPG 턴제 대화창 — 마님/돌쇠 대사 표시 + 수락/거절 버튼 */
export default function DialogueBox({
  dialogues, currentRestaurant, onAccept, onReject, isMapMode,
}: Props) {
  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      {/* 대화 로그 */}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {dialogues.map((msg, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 p-3 rounded-lg ${
              msg.speaker === 'manim'
                ? 'bg-sageuk-card border-l-4 border-sageuk-gold'
                : 'bg-sageuk-card border-r-4 border-gray-500 flex-row-reverse text-right'
            }`}
          >
            {/* 캐릭터 이미지 */}
            <div className="w-10 h-10 rounded-full bg-sageuk-bg flex items-center justify-center flex-shrink-0 overflow-hidden">
              <Image
                src={msg.speaker === 'manim' ? MANIM_IMAGE[msg.emotion] : '/characters/dolsoe-normal.png'}
                alt={msg.speaker === 'manim' ? '마님' : '돌쇠'}
                width={40}
                height={40}
                className="object-cover"
                onError={(e) => {
                  // 이미지 로드 실패 시 이모지 fallback — parentElement null 안전 처리
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  if (target.parentElement) {
                    target.parentElement.textContent = msg.speaker === 'manim' ? '👴' : '🧑'
                  }
                }}
              />
            </div>
            <div className="flex-1">
              <div className={`text-xs mb-1 ${
                msg.speaker === 'manim' ? 'text-sageuk-gold' : 'text-gray-400'
              }`}>
                {msg.speaker === 'manim' ? '마님' : '돌쇠'}
              </div>
              <div className="text-sm">{msg.text}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 음식점 정보 */}
      {currentRestaurant && !isMapMode && (
        <div className="bg-sageuk-card border border-sageuk-gold rounded-lg p-3">
          <div className="font-bold text-sageuk-gold">{currentRestaurant.name}</div>
          <div className="text-xs text-gray-400 mt-1">
            {currentRestaurant.category} · 도보 {Math.ceil(currentRestaurant.distance / 80)}분 ({currentRestaurant.distance}m)
          </div>
          {currentRestaurant.address && (
            <div className="text-xs text-gray-500 mt-1">{currentRestaurant.address}</div>
          )}
        </div>
      )}

      {/* 수락/거절 버튼 */}
      {currentRestaurant && !isMapMode && (
        <div className="flex gap-3">
          <button
            onClick={onAccept}
            className="flex-1 bg-sageuk-accept hover:bg-green-700 text-white py-3 rounded-lg font-bold transition-colors"
          >
            감사히 받겠습니다
          </button>
          <button
            onClick={onReject}
            className="flex-1 bg-sageuk-reject hover:bg-red-800 text-white py-3 rounded-lg font-bold transition-colors"
          >
            사양하겠습니다
          </button>
        </div>
      )}
    </div>
  )
}
