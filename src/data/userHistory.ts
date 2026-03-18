/**
 * Role: 사용자 맛집 선택 이력 관리 + 행동 패턴 감지
 * Key Features: localStorage 저장, 패턴 분석(거리/카테고리/수락습관), 더미 데이터 초기화
 * Dependencies: 없음 (순수 유틸리티)
 */

const HISTORY_KEY = 'manim_user_history'
const MAX_HISTORY = 40

export interface SelectionRecord {
  restaurantName: string
  category: string
  distance: number          // 미터 단위
  action: 'accepted' | 'rejected'
  rejectionCount: number    // 이 음식점을 수락하기 전 총 거절 횟수
  timestamp: number
}

export interface UserHistory {
  selections: SelectionRecord[]
  initialized: boolean      // 더미 데이터 삽입 여부
}

// 감지 가능한 행동 패턴
export type BehaviorPattern =
  | 'always_close'       // 항상 300m 이내만 수락
  | 'always_far'         // 600m 이상만 수락
  | 'category_obsessed'  // 특정 카테고리 70% 이상 수락
  | 'first_acceptor'     // 거절 없이 첫 추천 바로 수락 80% 이상
  | 'hard_to_please'     // 항상 2회 이상 거절 후 수락
  | 'rejecter'           // 거절 비율 70% 이상
  | null

// ─── 더미 데이터 ──────────────────────────────────────────────────
// "항상 가까운 한식만 수락"하는 패턴을 심어둔 기본 이력
const DUMMY_HISTORY: SelectionRecord[] = [
  { restaurantName: '문정동 해장국', category: '한식', distance: 120, action: 'accepted', rejectionCount: 0, timestamp: Date.now() - 86400000 * 10 },
  { restaurantName: '순대국밥집', category: '한식', distance: 85, action: 'accepted', rejectionCount: 0, timestamp: Date.now() - 86400000 * 9 },
  { restaurantName: '이탈리아 레스토랑', category: '양식', distance: 550, action: 'rejected', rejectionCount: 1, timestamp: Date.now() - 86400000 * 9 },
  { restaurantName: '문정 칼국수', category: '한식', distance: 200, action: 'accepted', rejectionCount: 1, timestamp: Date.now() - 86400000 * 8 },
  { restaurantName: '중화반점', category: '중식', distance: 480, action: 'rejected', rejectionCount: 1, timestamp: Date.now() - 86400000 * 7 },
  { restaurantName: '설렁탕 전문점', category: '한식', distance: 95, action: 'accepted', rejectionCount: 0, timestamp: Date.now() - 86400000 * 6 },
  { restaurantName: '일식당 스시코', category: '일식', distance: 720, action: 'rejected', rejectionCount: 1, timestamp: Date.now() - 86400000 * 6 },
  { restaurantName: '된장찌개 마을', category: '한식', distance: 160, action: 'accepted', rejectionCount: 0, timestamp: Date.now() - 86400000 * 5 },
  { restaurantName: '제육볶음 달인', category: '한식', distance: 230, action: 'accepted', rejectionCount: 0, timestamp: Date.now() - 86400000 * 4 },
  { restaurantName: '피자나라', category: '양식', distance: 610, action: 'rejected', rejectionCount: 1, timestamp: Date.now() - 86400000 * 3 },
  { restaurantName: '순두부 전문점', category: '한식', distance: 175, action: 'accepted', rejectionCount: 1, timestamp: Date.now() - 86400000 * 2 },
  { restaurantName: '냉면 한그릇', category: '한식', distance: 140, action: 'accepted', rejectionCount: 0, timestamp: Date.now() - 86400000 * 1 },
]

// ─── localStorage 헬퍼 ────────────────────────────────────────────

export function loadHistory(): UserHistory {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { selections: [], initialized: false }
}

export function saveHistory(history: UserHistory) {
  try {
    // 최대 개수 초과 시 오래된 것부터 제거
    const trimmed = history.selections.slice(-MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify({ ...history, selections: trimmed }))
  } catch {}
}

/** 더미 데이터로 초기화 (최초 방문 시 1회) */
export function initDummyHistoryIfNeeded() {
  const history = loadHistory()
  if (history.initialized) return
  saveHistory({ selections: DUMMY_HISTORY, initialized: true })
}

/** 이력에 새 레코드 추가 */
export function addToHistory(record: Omit<SelectionRecord, 'timestamp'>) {
  const history = loadHistory()
  history.selections.push({ ...record, timestamp: Date.now() })
  saveHistory(history)
}

// ─── 패턴 감지 ────────────────────────────────────────────────────

/** 최근 N건의 수락 이력만 분석 */
function getRecentAccepted(selections: SelectionRecord[], n = 10): SelectionRecord[] {
  return selections.filter(s => s.action === 'accepted').slice(-n)
}

/**
 * 행동 패턴 감지 — 최근 이력 기준
 * 데이터 부족(< 5건)이면 null 반환
 */
export function detectPattern(selections: SelectionRecord[]): {
  pattern: BehaviorPattern
  dominantCategory?: string
} {
  const accepted = getRecentAccepted(selections, 10)
  if (accepted.length < 5) return { pattern: null }

  // 항상 가까운 곳 (300m 이내 수락 70%+)
  const closeCount = accepted.filter(s => s.distance <= 300).length
  if (closeCount / accepted.length >= 0.7) return { pattern: 'always_close' }

  // 항상 먼 곳 (600m 이상 수락 50%+)
  const farCount = accepted.filter(s => s.distance >= 600).length
  if (farCount / accepted.length >= 0.5) return { pattern: 'always_far' }

  // 카테고리 집착 (특정 카테고리 70%+)
  const catCount: Record<string, number> = {}
  accepted.forEach(s => { catCount[s.category] = (catCount[s.category] || 0) + 1 })
  const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]
  if (topCat && topCat[1] / accepted.length >= 0.7) {
    return { pattern: 'category_obsessed', dominantCategory: topCat[0] }
  }

  // 첫 번째 수락 습관 (거절 0회 수락 80%+)
  const firstAcceptCount = accepted.filter(s => s.rejectionCount === 0).length
  if (firstAcceptCount / accepted.length >= 0.8) return { pattern: 'first_acceptor' }

  // 까다로운 성격 (2회 이상 거절 후 수락 60%+)
  const hardCount = accepted.filter(s => s.rejectionCount >= 2).length
  if (hardCount / accepted.length >= 0.6) return { pattern: 'hard_to_please' }

  // 전체 거절 비율 (거절이 수락의 2배 이상)
  const allRejected = selections.filter(s => s.action === 'rejected').slice(-15)
  if (allRejected.length >= accepted.length * 2) return { pattern: 'rejecter' }

  return { pattern: null }
}
