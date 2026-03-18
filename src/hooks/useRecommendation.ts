/**
 * Role: 추천 플로우 전체 상태 관리 훅 — 대화형 턴제 + 소거법 + 지도 모드 전환
 * Key Features: stale closure 방지(ref), 소거법 질문 플로우, 행동 패턴 첨언, 강제 선택
 * Dependencies: react, @/types, @/data/dialogues, @/data/userHistory
 */
'use client'

import { useState, useCallback, useRef } from 'react'
import { RecommendState, Restaurant, DialogueMessage, RejectionLevel } from '@/types'
import {
  API_ERROR, MANIM_BEHAVIOR_COMMENT,
  ELIMINATION_INTRO, ELIMINATION_FILTERED, ELIMINATION_DISTANCE_Q,
  ELIMINATION_HISTORY_Q, ELIMINATION_REMAINING_Q, ELIMINATION_FORCE,
  ELIMINATION_SUGGESTION, ELIMINATION_REPICK,
} from '@/data/dialogues'
import { loadHistory, addToHistory, detectPattern } from '@/data/userHistory'

const initialState: RecommendState = {
  mode: 'dialogue',
  rejectionCount: 0,
  currentRestaurant: null,
  rejectedIds: [],
  restaurants: [],
  dialogues: [],
  headcount: 1,
  categories: [],
  totalAvailable: 0,
  eliminationStep: 0,
  excludedCategories: [],
  maxWalkMin: null,
  rePickCount: 0,
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** 소거 필터 적용 — 제외 카테고리 + 최대 도보 시간 */
function applyEliminationFilter(
  restaurants: Restaurant[],
  excludedCategories: string[],
  maxWalkMin: number | null
): Restaurant[] {
  return restaurants.filter(r => {
    if (excludedCategories.includes(r.category)) return false
    if (maxWalkMin !== null && Math.ceil(r.distance / 80) > maxWalkMin) return false
    return true
  })
}

export function useRecommendation() {
  const [state, setState] = useState<RecommendState>(initialState)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state

  const fetchDialogue = async (body: Record<string, any>): Promise<DialogueMessage> => {
    const res = await fetch('/api/dialogue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  // 음식점 추천 요청
  const fetchRecommendation = useCallback(async (
    lat: number, lng: number, categories: string[], headcount: number,
    rejectedIds: string[] = [], locationName = ''
  ) => {
    setLoading(true)
    setApiError(false)
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, categories, rejectedIds, locationName }),
      })
      const data = await res.json()

      if (data.error) {
        const errorText = pickRandom(API_ERROR)
        setState(prev => ({
          ...prev,
          headcount,
          categories,
          dialogues: [...prev.dialogues, { speaker: 'manim', text: errorText, emotion: 'sad' }],
        }))
        setApiError(true)
        return
      }

      if (!data.picked) {
        const dialogue = await fetchDialogue({ type: 'noResult' })
        setState(prev => ({
          ...prev,
          headcount,
          categories,
          dialogues: [...prev.dialogues, dialogue],
        }))
        return
      }

      const msgs: DialogueMessage[] = []
      if (rejectedIds.length === 0) {
        msgs.push(await fetchDialogue({ type: 'headcount', headcount }))
      }

      if (data.totalAvailable < 3 && rejectedIds.length === 0) {
        msgs.push({
          speaker: 'manim',
          text: `이 근방에 먹을 곳이 ${data.totalAvailable}곳밖에 없구나...`,
          emotion: 'sad',
        })
      }

      msgs.push(await fetchDialogue({
        type: 'recommend',
        restaurantName: data.picked.name,
        category: data.picked.category,
        distance: data.picked.distance,
        walkMin: Math.ceil(data.picked.distance / 80),
      }))

      setState(prev => ({
        ...prev,
        headcount,
        categories,
        currentRestaurant: data.picked,
        restaurants: data.restaurants,
        totalAvailable: data.totalAvailable,
        dialogues: [...prev.dialogues, ...msgs],
        // 소거 필터 초기화
        eliminationStep: 0,
        excludedCategories: [],
        maxWalkMin: null,
      }))
    } catch {
      const errorText = pickRandom(API_ERROR)
      setState(prev => ({
        ...prev,
        dialogues: [...prev.dialogues, { speaker: 'manim', text: errorText, emotion: 'sad' }],
      }))
      setApiError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 뷰포트 이동/줌 시 음식점 목록만 재검색 — 대화/모드/currentRestaurant는 변경하지 않음
   */
  const refreshRestaurants = useCallback(async (
    lat: number, lng: number, radius: number, categories: string[]
  ) => {
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, categories, rejectedIds: [], locationName: '', radius }),
      })
      const data = await res.json()
      if (data.error || !data.restaurants) return
      setState(prev => {
        // 기존 목록 + 신규 결과 병합 — 중복 제거 후 거리순 정렬 (확대 시 핀 사라짐 방지)
        const existingIds = new Set(prev.restaurants.map(r => r.id))
        const merged = [
          ...prev.restaurants,
          ...data.restaurants.filter((r: Restaurant) => !existingIds.has(r.id)),
        ].sort((a, b) => a.distance - b.distance)
        return {
          ...prev,
          restaurants: merged,
          totalAvailable: merged.length,
        }
      })
    } catch {
      // 리프레시 실패는 조용히 무시 — 기존 목록 유지
    }
  }, [])

  // ─── 소거법 플로우 ─────────────────────────────────────────────

  /** 소거법 시작 — mode를 'elimination'으로, step 1, 이전 선택 기록 초기화 */
  const startElimination = useCallback(() => {
    const introText = pickRandom(ELIMINATION_INTRO)
    setState(prev => ({
      ...prev,
      mode: 'elimination',
      eliminationStep: 1,
      excludedCategories: [],
      maxWalkMin: null,
      currentRestaurant: null,
      rePickCount: 0,
      dialogues: [{ speaker: 'manim', text: introText, emotion: 'normal' }],
    }))
  }, [])

  /**
   * 소거법 답변 처리
   * step 1: 카테고리 제외
   * step 2: 최대 도보 시간
   * step 3: 이력 기반 카테고리 추가 제외
   * step 4: 남은 카테고리 중 추가 제외
   * step 5: 강제 선택
   */
  const eliminationAnswer = useCallback((opts: {
    excludeCategories?: string[]
    maxWalkMin?: number | null
  }) => {
    const current = stateRef.current
    const newExcluded = [
      ...current.excludedCategories,
      ...(opts.excludeCategories || []),
    ]
    const newMaxWalkMin = opts.maxWalkMin !== undefined ? opts.maxWalkMin : current.maxWalkMin
    const nextStep = current.eliminationStep + 1

    const filtered = applyEliminationFilter(current.restaurants, newExcluded, newMaxWalkMin)

    // 5단계 도달 또는 남은 음식점이 1개 이하 → 강제 선택
    if (nextStep > 5 || filtered.length <= 1) {
      const pool = filtered.length > 0 ? filtered : current.restaurants
      const picked = pool[Math.floor(Math.random() * pool.length)]
      const forceText = nextStep > 5
        ? pickRandom(ELIMINATION_FORCE)
        : `${filtered.length > 0 ? filtered.length + '곳밖에' : '더 이상'} 안 남았구나! 내가 정해주겠다!`

      setState(prev => ({
        ...prev,
        excludedCategories: newExcluded,
        maxWalkMin: newMaxWalkMin,
        currentRestaurant: picked,
        mode: 'forcePick',
        dialogues: [{ speaker: 'manim', text: forceText, emotion: 'furious' }],
      }))
      return
    }

    // 필터 후 응답 대사 생성
    const excludedLabel = (opts.excludeCategories || []).join(', ')
    let responseText: string
    if (opts.excludeCategories && opts.excludeCategories.length > 0) {
      responseText = pickRandom(ELIMINATION_FILTERED)
        .replace('{excluded}', excludedLabel)
        .replace('{count}', String(filtered.length))
    } else if (opts.maxWalkMin !== undefined) {
      responseText = `걸어서 ${newMaxWalkMin}분 초과는 빼겠다. ${filtered.length}곳이 남는구나.`
    } else {
      responseText = `${filtered.length}곳이 남았느니라.`
    }

    // 다음 질문 대사
    let nextQuestionText: string
    if (nextStep === 2) nextQuestionText = pickRandom(ELIMINATION_DISTANCE_Q)
    else if (nextStep === 3) nextQuestionText = pickRandom(ELIMINATION_HISTORY_Q)
    else if (nextStep === 4) nextQuestionText = pickRandom(ELIMINATION_REMAINING_Q)
    else nextQuestionText = "마지막 기회다. 이래도 모르겠느냐?"

    // 필터된 풀에서 현재 추천 음식점 갱신
    const picked = filtered[Math.floor(Math.random() * filtered.length)]

    setState(prev => ({
      ...prev,
      eliminationStep: nextStep,
      excludedCategories: newExcluded,
      maxWalkMin: newMaxWalkMin,
      currentRestaurant: picked,
      dialogues: [
        { speaker: 'manim', text: responseText, emotion: 'normal' },
        { speaker: 'manim', text: pickRandom(ELIMINATION_SUGGESTION), emotion: 'normal' },
        { speaker: 'manim', text: nextQuestionText, emotion: 'normal' },
      ],
    }))
  }, [])

  /** 소거법 중 "다른 것도 있사옵니까" — 3회 초과 시 강제 쌀밥 지급 */
  const rePickElimination = useCallback(() => {
    const current = stateRef.current
    const newRePickCount = current.rePickCount + 1

    const filtered = applyEliminationFilter(current.restaurants, current.excludedCategories, current.maxWalkMin)
    const pool = filtered.filter(r => r.id !== current.currentRestaurant?.id)

    // 3회 초과 또는 더 이상 선택지 없음 → 쌀밥 강제
    if (newRePickCount > 3 || pool.length === 0) {
      const forcePicked = pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : (filtered[0] ?? current.restaurants[0])
      const forceText = newRePickCount > 3
        ? pickRandom(ELIMINATION_FORCE)
        : '더 이상 다른 곳이 없구나... 이놈이 정말 배부른 것이냐!'
      setState(prev => ({
        ...prev,
        currentRestaurant: forcePicked,
        mode: 'forcePick',
        rePickCount: newRePickCount,
        dialogues: [{ speaker: 'manim', text: forceText, emotion: 'furious' }],
      }))
      return
    }

    const picked = pool[Math.floor(Math.random() * pool.length)]
    setState(prev => ({
      ...prev,
      currentRestaurant: picked,
      rePickCount: newRePickCount,
      dialogues: [...prev.dialogues, { speaker: 'manim', text: pickRandom(ELIMINATION_REPICK), emotion: 'normal' }],
    }))
  }, [])

  // ─── 기존 플로우 ───────────────────────────────────────────────

  const accept = useCallback(() => {
    const current = stateRef.current
    const restaurant = current.currentRestaurant
    if (!restaurant) return

    addToHistory({
      restaurantName: restaurant.name,
      category: restaurant.category,
      distance: restaurant.distance,
      action: 'accepted',
      rejectionCount: current.rejectionCount,
    })

    const history = loadHistory()
    const { pattern, dominantCategory } = detectPattern(history.selections)
    const commentPool = pattern ? MANIM_BEHAVIOR_COMMENT[pattern] : null
    const behaviorMsg: DialogueMessage | null = commentPool
      ? {
          speaker: 'manim',
          text: pickRandom(commentPool).replace('{category}', dominantCategory || restaurant.category),
          emotion: pattern === 'always_close' || pattern === 'category_obsessed' ? 'angry' : 'sad',
        }
      : null

    setState(prev => ({
      ...prev,
      mode: 'accepted',
      dialogues: behaviorMsg ? [...prev.dialogues, behaviorMsg] : prev.dialogues,
    }))
  }, [])

  const forcePick = useCallback(async (lat: number, lng: number) => {
    const current = stateRef.current
    const randomRestaurant = current.restaurants[Math.floor(Math.random() * current.restaurants.length)]
    if (!randomRestaurant) return

    const forceText = pickRandom([
      "에잇, 이 불쌍한 놈! 내가 정해주마. 쌀밥이다!",
      "결정도 못하느냐... 가엾구나. 내가 골라주겠다!",
      "보다 못해 나서마. 이리 오너라, 쌀밥을 주겠다!",
    ])

    setState(prev => ({
      ...prev,
      currentRestaurant: randomRestaurant,
      mode: 'forcePick',
      dialogues: [...prev.dialogues, { speaker: 'manim', text: forceText, emotion: 'normal' }],
    }))
  }, [])

  const reject = useCallback(async (lat: number, lng: number, locationName = '') => {
    const current = stateRef.current
    const newCount = Math.min(current.rejectionCount + 1, 4) as RejectionLevel
    const newRejectedIds = [...current.rejectedIds, current.currentRestaurant!.id]

    if (current.currentRestaurant) {
      addToHistory({
        restaurantName: current.currentRestaurant.name,
        category: current.currentRestaurant.category,
        distance: current.currentRestaurant.distance,
        action: 'rejected',
        rejectionCount: newCount,
      })
    }

    const [excuse, reaction] = await Promise.all([
      fetchDialogue({ type: 'excuse' }),
      fetchDialogue({ type: 'rejection', rejectionLevel: Math.min(newCount, 4) as RejectionLevel }),
    ])

    const remainingCount = current.totalAvailable - newRejectedIds.length

    // 4번 거절 → 쌀밥 강제 지급 후 퇴장
    if (newCount >= 4) {
      const pool = current.restaurants.filter(r => !newRejectedIds.includes(r.id))
      const forceRestaurant = pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : current.restaurants[0]
      setState(prev => ({
        ...prev,
        rejectionCount: newCount,
        rejectedIds: newRejectedIds,
        currentRestaurant: forceRestaurant,
        mode: 'forcePick',
        dialogues: [...prev.dialogues, excuse, reaction],
      }))
      return
    }

    // 남은 음식점 없으면 지도 모드
    if (remainingCount <= 0) {
      setState(prev => ({
        ...prev,
        rejectionCount: newCount,
        mode: 'map',
        rejectedIds: newRejectedIds,
        currentRestaurant: null,
        dialogues: [...prev.dialogues, excuse, reaction],
      }))
      return
    }

    // 계속 추천
    setState(prev => ({
      ...prev,
      rejectionCount: newCount,
      rejectedIds: newRejectedIds,
      dialogues: [...prev.dialogues, excuse, reaction],
    }))
    await fetchRecommendation(lat, lng, current.categories, current.headcount, newRejectedIds, locationName)
  }, [fetchRecommendation])

  const selectOnMap = useCallback(async (restaurant: Restaurant) => {
    const current = stateRef.current
    const comment = await fetchDialogue({
      type: 'mapComment',
      distance: restaurant.distance,
      category: restaurant.category,
      recommendedCategory: current.categories[0] || '',
    })
    setState(prev => ({
      ...prev,
      currentRestaurant: restaurant,
      dialogues: [comment],
    }))
  }, [])

  const reset = useCallback(() => {
    setState(initialState)
    setApiError(false)
  }, [])

  return {
    state, loading, apiError,
    fetchRecommendation, refreshRestaurants, accept, reject, selectOnMap, forcePick, reset,
    startElimination, eliminationAnswer, rePickElimination,
  }
}
