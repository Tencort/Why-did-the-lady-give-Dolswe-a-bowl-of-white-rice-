/**
 * Role: 프로젝트 전체에서 사용하는 TypeScript 타입 및 인터페이스 정의
 * Key Features: Restaurant 타입, RecommendState 상태 관리, 대화 메시지 타입, 소거법 타입
 * Dependencies: 없음 (순수 타입 정의 파일)
 */

export interface ReviewItem {
  nickname: string
  text: string
  rating: number  // 1~5
}

export interface Restaurant {
  id: string
  name: string
  category: string
  distance: number
  lat: number
  lng: number
  address: string
  phone?: string
  naverUrl?: string
  reviews?: ReviewItem[]
}

/** 추천 모드 — elimination: 소거법 질문 플로우 */
export type RecommendMode = 'dialogue' | 'map' | 'accepted' | 'forcePick' | 'elimination'

export type RejectionLevel = 0 | 1 | 2 | 3 | 4

export type ManimEmotion = 'normal' | 'sad' | 'angry' | 'furious'

export interface DialogueMessage {
  speaker: 'manim' | 'dolsoe'
  text: string
  emotion: ManimEmotion
}

/** 소거법 단계별 질문 타입 */
export type EliminationStepType = 'category' | 'distance' | 'history' | 'remaining' | 'done'

export interface RecommendState {
  mode: RecommendMode
  rejectionCount: RejectionLevel
  currentRestaurant: Restaurant | null
  rejectedIds: string[]
  restaurants: Restaurant[]
  dialogues: DialogueMessage[]
  headcount: number
  categories: string[]
  totalAvailable: number
  // 소거법 필터 상태
  eliminationStep: number        // 1~5, 0 = 비활성
  excludedCategories: string[]   // 소거된 카테고리
  maxWalkMin: number | null      // 최대 도보 분, null = 제한 없음
  rePickCount: number            // "다른 것도" 누른 횟수 — 3회 초과 시 강제 선택
}

export interface SearchCondition {
  lat: number
  lng: number
  headcount: number
  categories: string[]
}
