/**
 * Role: 맛집 추천 메인 페이지 — GPS 자동 위치 기반 즉시 시작
 * Key Features: 마운트 시 GPS 획득, 좌측 뷰포트 맛집 리스트, 우측 풀스크린 지도, 바텀시트 대화 모달
 * Dependencies: useRecommendation, MapView, RiceBowlGauge, framer-motion
 */
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useAnimate, stagger } from 'framer-motion'
import { useRecommendation } from '@/hooks/useRecommendation'
import MapView, { MapBounds } from '@/components/MapView'
import RiceBowlGauge from '@/components/RiceBowlGauge'
import { LetterSwapForward } from '@/components/LetterSwap'
import { ManimEmotion, DialogueMessage, Restaurant } from '@/types'
import { initDummyHistoryIfNeeded, loadHistory } from '@/data/userHistory'

// 문정·장지역 중간 좌표 — GPS 미지원 또는 결과 없을 때 폴백
const DEFAULT_LOCATION = { lat: 37.4838, lng: 127.1257, name: '문정·장지역' }
const DEFAULT_CATEGORIES = ['한식', '중식', '일식', '양식', '분식', '카페', '치킨', '피자', '패스트푸드', '고기', '해산물', '술집', '베이커리', '아시안', '브런치', '뷔페']
const SAVED_LOCATION_KEY = 'manim_saved_location'

// 포인트 블루 (Toss Feed 스타일)
const BLUE = '#3182f6'
const BLUE_LIGHT = '#ebf3fe'
const BLUE_BORDER = '#c9dffe'

/** localStorage에서 저장된 위치 불러오기 */
function loadSavedLocation(): { lat: number; lng: number; name: string } | null {
  try {
    const raw = localStorage.getItem(SAVED_LOCATION_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

/** 위치를 localStorage에 저장 */
function saveLocation(lat: number, lng: number, name: string) {
  try { localStorage.setItem(SAVED_LOCATION_KEY, JSON.stringify({ lat, lng, name })) } catch {}
}

const MANIM_STICKER: Record<ManimEmotion, string> = {
  normal: '/characters/manim_sticker_normal.png',
  sad: '/characters/manim_sticker_normal.png',
  angry: '/characters/manim_sticker_angry.png',
  furious: '/characters/manim_sticker_angry.png',
}

/** 쌀밥 찰싹! — forcePick 진입 시 자동 재생되는 레터스왑 타이틀 */
function RiceSlapTitle() {
  const [scope, animate] = useAnimate()
  const text = '쌀밥 찰싹!'

  useEffect(() => {
    animate('.rs-letter', { y: ['0%', '100%'] }, {
      type: 'spring' as const, duration: 0.55,
      delay: stagger(0.04, { from: 'first' }),
    }).then(() => animate('.rs-letter', { y: '0%' }, { duration: 0 }))

    animate('.rs-letter-ghost', { top: ['100%', '0%'] }, {
      type: 'spring' as const, duration: 0.55,
      delay: stagger(0.04, { from: 'first' }),
    }).then(() => animate('.rs-letter-ghost', { top: '-100%' }, { duration: 0 }))
  }, [animate])

  return (
    <motion.div
      className="flex flex-col items-center gap-1 py-4"
      initial={{ opacity: 0, scale: 0.75, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', damping: 14, stiffness: 260 }}
    >
      <span ref={scope} className="flex items-center justify-center overflow-hidden"
        style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.02em', color: BLUE }}>
        <span className="sr-only">{text}</span>
        {text.split('').map((ch, i) => (
          <span key={i} className="whitespace-pre relative flex">
            <motion.span className="rs-letter relative" style={{ top: 0 }}>{ch}</motion.span>
            <motion.span className="rs-letter-ghost absolute" aria-hidden style={{ top: '-100%' }}>{ch}</motion.span>
          </span>
        ))}
      </span>
      <span className="text-[13px] font-semibold" style={{ color: BLUE, opacity: 0.6 }}>
        마님께서 쌀밥을 내리셨습니다
      </span>
    </motion.div>
  )
}

/** 스플래시 */
function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2600)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white px-6"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center flex-wrap justify-center">
        <motion.span
          animate={{ filter: [`drop-shadow(0 0 0px ${BLUE})`, `drop-shadow(0 0 10px ${BLUE}99)`, `drop-shadow(0 0 0px ${BLUE})`] }}
          transition={{ delay: 1.0, duration: 1.4, repeat: Infinity, repeatDelay: 0.6 }}
        >
          <LetterSwapForward label="마님" className="text-[22px] md:text-[32px] font-bold tracking-tight text-sg-blue" staggerDuration={0.04} staggerFrom="first" />
        </motion.span>
        <LetterSwapForward label="은 왜 돌쇠에게 쌀밥을 줬을까?" className="text-[22px] md:text-[32px] font-bold text-tf-text tracking-tight" staggerDuration={0.04} staggerFrom="first" />
      </div>
    </motion.div>
  )
}

/** 채팅 말풍선 */
function ChatBubble({ msg }: { msg: DialogueMessage }) {
  const isManim = msg.speaker === 'manim'
  return (
    <div className={`flex items-start gap-3 ${isManim ? '' : 'flex-row-reverse'}`}>
      <div className="w-9 h-9 rounded-full bg-white overflow-hidden border border-tf-border flex-shrink-0 flex items-center justify-center">
        {isManim ? (
          <img src="/characters/event_tempting.png" alt="마님" className="w-[130%] h-[130%] object-cover pt-1.5 ml-0.5" style={{ mixBlendMode: 'multiply' }} />
        ) : (
          <img src="/characters/profile_dolsoe.png" alt="돌쇠" className="w-full h-full object-contain" />
        )}
      </div>
      <div className="px-4 py-3 max-w-[78%] text-[14px] leading-[1.6]"
        style={{
          background: isManim ? BLUE_LIGHT : '#f7f8fa',
          borderRadius: isManim ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
          border: isManim ? `1px solid ${BLUE_BORDER}` : '1px solid #e5e8eb',
          color: '#191f28',
        }}>
        <div className="text-[11px] font-bold mb-1" style={{ color: isManim ? BLUE : '#b0b8c1' }}>
          {isManim ? '마님' : '돌쇠'}
        </div>
        {msg.text}
      </div>
    </div>
  )
}

/** 맛집 카드 */
function RestaurantCard({ restaurant: r, isActive, onClick }: { restaurant: Restaurant; isActive: boolean; onClick: () => void }) {
  return (
    <div
      className="px-4 py-4 cursor-pointer transition-colors active:scale-[0.98]"
      style={{
        borderBottom: '1px solid #f0f0f0',
        background: isActive ? BLUE_LIGHT : 'white',
        borderLeft: isActive ? `3px solid ${BLUE}` : '3px solid transparent',
      }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold text-[14px] text-tf-text leading-tight">{r.name}</div>
        {isActive && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: BLUE, color: '#fff' }}>추천</span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: '#f7f8fa', color: '#6b7684', border: '1px solid #e5e8eb' }}>{r.category}</span>
        <span className="text-[12px] text-tf-text-hint">도보 {Math.ceil(r.distance / 80)}분 · {r.distance}m</span>
      </div>
      {r.address && <div className="text-[12px] text-tf-text-hint mt-1 truncate">{r.address}</div>}
      {r.reviews && r.reviews.length > 0 && (
        <div className="mt-2 text-[11px] text-tf-text-hint italic truncate">
          &ldquo;{r.reviews[0].text}&rdquo;
        </div>
      )}
      {r.naverUrl && (
        <a href={r.naverUrl} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="inline-block mt-2 text-[12px] font-semibold"
          style={{ color: '#03c75a' }}>
          네이버 리뷰 →
        </a>
      )}
    </div>
  )
}

const ALL_CATEGORIES = ['한식', '중식', '일식', '양식', '분식', '카페', '치킨', '피자', '패스트푸드', '고기', '해산물', '술집', '베이커리', '아시안', '브런치', '뷔페']
const WALK_OPTIONS = [
  { label: '5분 이내', value: 5 },
  { label: '10분 이내', value: 10 },
  { label: '상관없음', value: null },
]

/** 소거법 질문 패널 — 단계별 "싫은 것" 선택 UI */
function EliminationPanel({
  step, restaurants, excludedCategories, maxWalkMin, onAnswer, onSkip,
}: {
  step: number
  restaurants: Restaurant[]
  excludedCategories: string[]
  maxWalkMin: number | null
  onAnswer: (opts: { excludeCategories?: string[]; maxWalkMin?: number | null }) => void
  onSkip: () => void
}) {
  const [selected, setSelected] = useState<string[]>([])

  // 단계 변경 시 선택 초기화
  useEffect(() => { setSelected([]) }, [step])

  // 이 단계에서 선택 가능한 카테고리 — 아직 제외되지 않은 것
  const availableCategories = ALL_CATEGORIES.filter(c => !excludedCategories.includes(c))

  // step 3용: 최근 이력에서 많이 먹은 카테고리 (아직 제외 안 된 것)
  const historyCats = (() => {
    try {
      const h = loadHistory()
      const catCount: Record<string, number> = {}
      h.selections.filter(s => s.action === 'accepted').slice(-8).forEach(s => {
        catCount[s.category] = (catCount[s.category] || 0) + 1
      })
      return Object.entries(catCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat)
        .filter(c => !excludedCategories.includes(c))
    } catch { return [] }
  })()

  // 남은 음식점에서 등장하는 카테고리 (step 4용)
  const remainingCats = [...new Set(
    restaurants
      .filter(r => !excludedCategories.includes(r.category))
      .map(r => r.category)
  )]

  const toggle = (cat: string) =>
    setSelected(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])

  const chipStyle = (active: boolean) => ({
    background: active ? BLUE : '#f7f8fa',
    color: active ? '#fff' : '#6b7684',
    border: active ? `1.5px solid ${BLUE}` : '1.5px solid #e5e8eb',
  })

  // step 1, 3, 4: 카테고리 선택
  if (step === 1 || step === 3 || step === 4) {
    const cats = step === 3 ? historyCats : step === 4 ? remainingCats : availableCategories
    if (cats.length === 0) {
      // 선택지 없으면 건너뜀
      onAnswer({})
      return null
    }
    return (
      <div className="px-5 pt-4 pb-2" style={{ borderTop: '1px solid #f0f0f0' }}>
        <p className="text-[12px] text-tf-text-hint mb-3">
          {step === 3 ? '최근 자주 먹어서 질린 종류' : '먹기 싫은 종류 선택'}
          <span className="ml-1 text-[11px]">(복수 선택 가능)</span>
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {cats.map(cat => (
            <button key={cat} onClick={() => toggle(cat)}
              className="px-3 py-1.5 rounded-full text-[13px] font-semibold active:scale-95 transition-all"
              style={chipStyle(selected.includes(cat))}>
              {cat}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onAnswer({ excludeCategories: selected })}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white active:scale-95 transition-all"
            style={{ background: BLUE }}>
            {selected.length > 0 ? `${selected.join(', ')} 빼고 찾아주세요` : '딱히 없습니다'}
          </button>
        </div>
      </div>
    )
  }

  // step 2: 거리 선택
  if (step === 2) {
    return (
      <div className="px-5 pt-4 pb-2" style={{ borderTop: '1px solid #f0f0f0' }}>
        <p className="text-[12px] text-tf-text-hint mb-3">걷기 싫은 거리 기준</p>
        <div className="flex gap-2 flex-wrap">
          {WALK_OPTIONS.map(opt => (
            <button key={opt.label}
              onClick={() => onAnswer({ maxWalkMin: opt.value })}
              className="px-4 py-2.5 rounded-xl text-[13px] font-semibold active:scale-95 transition-all"
              style={chipStyle(maxWalkMin === opt.value)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return null
}

export default function Home() {
  const { state, loading, apiError, fetchRecommendation, refreshRestaurants, accept, reject, selectOnMap, forcePick, reset, startElimination, eliminationAnswer, rePickElimination } = useRecommendation()

  const [showSplash, setShowSplash] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locationName, setLocationName] = useState('')
  const [locating, setLocating] = useState(true)
  const [gpsError, setGpsError] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [showLocationEdit, setShowLocationEdit] = useState(false)
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  // 뷰포트 기반 debounce 리프레시용 타이머 ref
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // 초기 fetchRecommendation 직후 mapBounds 변경으로 인한 중복 호출 방지
  const isFirstLoadRef = useRef(true)
  // fetch가 한 번이라도 시작됐는지 — 폴백 조기 실행 방지용
  const fetchEverStartedRef = useRef(false)

  // 마운트 시 더미 이력 초기화 (최초 방문 1회만 실행)
  useEffect(() => { initDummyHistoryIfNeeded() }, [])

  // 마운트 시: 저장된 위치 우선 → GPS 시도 → 폴백(문정역)
  useEffect(() => {
    const saved = loadSavedLocation()
    if (saved) {
      setCoords({ lat: saved.lat, lng: saved.lng })
      setLocationName(saved.name)
      setLocating(false)
      fetchRecommendation(saved.lat, saved.lng, DEFAULT_CATEGORIES, 1, [], saved.name)
      return
    }

    const fallback = () => {
      const { lat, lng, name } = DEFAULT_LOCATION
      setCoords({ lat, lng })
      setLocationName(name)
      setLocating(false)
      fetchRecommendation(lat, lng, DEFAULT_CATEGORIES, 1, [], name)
    }

    if (!navigator.geolocation) { fallback(); return }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setCoords({ lat, lng })
        setLocating(false)
        // GPS 좌표 → 가장 가까운 지하철역명 조회 → 검색어 품질 향상
        try {
          const res = await fetch('/api/nearby-station', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng }),
          })
          const { stationName } = await res.json()
          const name = stationName || '현재 위치'
          setLocationName(name)
          saveLocation(lat, lng, name)
          fetchRecommendation(lat, lng, DEFAULT_CATEGORIES, 1, [], name)
        } catch {
          setLocationName('현재 위치')
          fetchRecommendation(lat, lng, DEFAULT_CATEGORIES, 1, [], '')
        }
      },
      fallback,
      { timeout: 8000 }
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // fetch 시작 여부 추적 — loading이 true가 된 순간부터 기록
  useEffect(() => {
    if (loading) fetchEverStartedRef.current = true
  }, [loading])

  // GPS 위치 기준 검색 결과가 비어있으면 문정·장지역 기본값으로 자동 전환
  // fetchEverStartedRef가 true일 때만 실행 — GPS→fetch 사이 타이밍에 조기 실행 방지
  useEffect(() => {
    if (!fetchEverStartedRef.current) return
    if (loading) return
    if (state.restaurants.length > 0) return
    if (!coords) return
    // 이미 기본 위치면 중복 재시도 방지
    const isDefault =
      Math.abs(coords.lat - DEFAULT_LOCATION.lat) < 0.001 &&
      Math.abs(coords.lng - DEFAULT_LOCATION.lng) < 0.001
    if (isDefault) return

    const { lat, lng, name } = DEFAULT_LOCATION
    setCoords({ lat, lng })
    setLocationName(name)
    fetchRecommendation(lat, lng, DEFAULT_CATEGORIES, 1, [], name)
  }, [loading, state.restaurants.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.dialogues, loading])

  const handleBoundsChange = useCallback((bounds: MapBounds) => setMapBounds(bounds), [])

  // mapBounds 변경 시 debounce(900ms)로 음식점 목록 재검색
  // 초기 로드(isFirstLoadRef)와 coords 미설정 상태에서는 실행하지 않음
  useEffect(() => {
    if (!mapBounds || !coords) return
    if (isFirstLoadRef.current) {
      // 초기 로드 직후 첫 bounds 이벤트는 건너뛰고 플래그 해제
      isFirstLoadRef.current = false
      return
    }
    clearTimeout(fetchTimerRef.current)
    const centerLat = (mapBounds.north + mapBounds.south) / 2
    const centerLng = (mapBounds.east + mapBounds.west) / 2
    fetchTimerRef.current = setTimeout(() => {
      // 확대 시에도 최소 1500m 반경 보장 — 줄어들면 기존 핀이 사라지는 문제 방지
      const radius = Math.max(mapBounds.radiusM, 1500)
      refreshRestaurants(centerLat, centerLng, radius, state.categories.length > 0 ? state.categories : DEFAULT_CATEGORIES)
    }, 900)
    return () => clearTimeout(fetchTimerRef.current)
  }, [mapBounds]) // eslint-disable-line react-hooks/exhaustive-deps

  // 뷰포트 내 식당 필터
  const visibleRestaurants = mapBounds
    ? state.restaurants.filter(r =>
        r.lat <= mapBounds.north && r.lat >= mapBounds.south &&
        r.lng <= mapBounds.east && r.lng >= mapBounds.west
      )
    : state.restaurants

  // 수동 위치 검색
  const handleManualSearch = async () => {
    if (!searchInput.trim() || geocoding) return
    setGeocoding(true)
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchInput.trim() }),
      })
      const data = await res.json()
      if (data.lat && data.lng) {
        const name = searchInput.trim()
        setCoords({ lat: data.lat, lng: data.lng })
        setLocationName(name)
        setGpsError(false)
        setShowLocationEdit(false)
        saveLocation(data.lat, data.lng, name)
        fetchRecommendation(data.lat, data.lng, DEFAULT_CATEGORIES, 1, [], name)
      }
    } finally {
      setGeocoding(false)
    }
  }

  const handleRestart = () => {
    reset()
    setCoords(null)
    setLocationName('')
    setShowModal(false)
    setMapBounds(null)
    setLocating(true)
    setGpsError(false)
    setSearchInput('')
    navigator.geolocation?.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setCoords({ lat, lng })
        setLocating(false)
        try {
          const res = await fetch('/api/nearby-station', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng }),
          })
          const { stationName } = await res.json()
          const name = stationName || '현재 위치'
          setLocationName(name)
          fetchRecommendation(lat, lng, DEFAULT_CATEGORIES, 1, [], name)
        } catch {
          setLocationName('현재 위치')
          fetchRecommendation(lat, lng, DEFAULT_CATEGORIES, 1, [], '')
        }
      },
      () => {
        const { lat, lng, name } = DEFAULT_LOCATION
        setCoords({ lat, lng })
        setLocationName(name)
        setLocating(false)
        fetchRecommendation(lat, lng, DEFAULT_CATEGORIES, 1, [], name)
      },
      { timeout: 8000 }
    )
  }

  const handleReject = () => { if (coords) reject(coords.lat, coords.lng, locationName) }
  const handleRetry = () => { if (coords) fetchRecommendation(coords.lat, coords.lng, state.categories, state.headcount, state.rejectedIds, locationName) }

  /** GPS 허용 버튼 — 저장 위치나 기본값으로 시작했을 때 현위치로 갱신 */
  const handleGpsRequest = async () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setCoords({ lat, lng })
        setLocating(false)
        try {
          const res = await fetch('/api/nearby-station', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng }),
          })
          const { stationName } = await res.json()
          const name = stationName || '현재 위치'
          setLocationName(name)
          saveLocation(lat, lng, name)
          fetchRecommendation(lat, lng, DEFAULT_CATEGORIES, 1, [], name)
        } catch {
          setLocationName('현재 위치')
          fetchRecommendation(lat, lng, DEFAULT_CATEGORIES, 1, [], '')
        }
      },
      () => { setLocating(false); setGpsError(true) },
      { timeout: 8000 }
    )
  }

  const mapLat = coords?.lat ?? DEFAULT_LOCATION.lat
  const mapLng = coords?.lng ?? DEFAULT_LOCATION.lng

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen key="splash" onDone={() => setShowSplash(false)} />}
      </AnimatePresence>

      <main className="h-screen flex flex-col overflow-hidden bg-tf-bg">
        {/* 상단 바 */}
        <header className="h-[56px] flex items-center justify-between px-5 bg-white flex-shrink-0"
          style={{ borderBottom: '1px solid #e5e8eb' }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { if (!locating) { setShowLocationEdit(true); setSearchInput('') } }}
              className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
              title="클릭하여 위치 변경"
            >
              <span className="text-[15px] font-bold text-tf-text">
                {locating ? '위치 확인 중...' : locationName ? locationName : '마님의 맛집'}
              </span>
              {coords && (
                <span className="text-[10px] text-tf-text-hint font-normal">
                  {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                </span>
              )}
              {!locating && (
                <span className="text-[11px] px-1.5 py-0.5 rounded font-medium"
                  style={{ background: BLUE_LIGHT, color: BLUE }}>변경</span>
              )}
            </button>
            {coords && <RiceBowlGauge rejectionCount={state.rejectionCount} />}
          </div>
          <div className="flex items-center gap-2">
            {/* GPS 허용 버튼 — 저장/기본 위치 사용 중일 때 현위치로 갱신 */}
            {!locating && (
              <button onClick={handleGpsRequest}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold active:scale-95 transition-all"
                style={{ background: BLUE_LIGHT, color: BLUE, border: `1px solid ${BLUE_BORDER}` }}
                title="현재 위치로 변경">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                  <path d="M12 1v2M12 21v2M1 12h2M21 12h2"/>
                </svg>
                {locating ? '...' : 'GPS'}
              </button>
            )}
            {coords && (
              <button onClick={handleRestart}
                className="px-3 py-2 rounded-xl text-[13px] text-tf-text-hint"
                style={{ background: '#f7f8fa', border: '1px solid #e5e8eb' }}>
                새로고침
              </button>
            )}
          </div>
        </header>

        {/* 본문: 좌 리스트 + 우 지도 */}
        <div className="flex-1 flex overflow-hidden">

          {/* 좌: 맛집 리스트 */}
          <div className="w-[320px] flex-shrink-0 flex flex-col bg-white overflow-hidden"
            style={{ borderRight: '1px solid #e5e8eb' }}>

            {/* 위치 변경 인풋 */}
            {((gpsError && !coords) || showLocationEdit) && (
              <div className="p-4 flex-shrink-0" style={{ borderBottom: '1px solid #f0f0f0' }}>
                <p className="text-[12px] text-tf-text-hint mb-2">
                  {showLocationEdit ? '새 위치를 입력하면 저장됩니다.' : '위치 접근이 거부되었습니다. 지역명을 입력해주세요.'}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                    placeholder="예: 강남역, 홍대"
                    autoFocus
                    className="flex-1 px-3 py-2 rounded-xl text-[13px] outline-none"
                    style={{ border: `1.5px solid ${BLUE_BORDER}`, background: BLUE_LIGHT }}
                  />
                  <button onClick={handleManualSearch} disabled={geocoding}
                    className="px-3 py-2 rounded-xl text-[13px] font-bold text-white active:scale-95 transition-all disabled:opacity-40"
                    style={{ background: BLUE }}>
                    {geocoding ? '...' : '검색'}
                  </button>
                  {showLocationEdit && (
                    <button onClick={() => setShowLocationEdit(false)}
                      className="px-3 py-2 rounded-xl text-[13px] text-tf-text-hint"
                      style={{ background: '#f7f8fa', border: '1px solid #e5e8eb' }}>
                      취소
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 리스트 헤더 */}
            {coords && (
              <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #f0f0f0' }}>
                <span className="text-[13px] font-semibold text-tf-text-sub">
                  {loading ? '마님이 고심 중이시니라...' : `이 지역 맛집 ${visibleRestaurants.length}곳`}
                </span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {/* 위치 확인 중 */}
              {locating && (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-6 h-6 border-2 border-tf-border rounded-full animate-spin"
                    style={{ borderTopColor: BLUE }} />
                  <p className="text-[13px] text-tf-text-hint">현재 위치를 확인하는 중...</p>
                </div>
              )}

              {/* 로딩 스켈레톤 */}
              {!locating && loading && (
                <div className="flex flex-col gap-0">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="px-4 py-4 animate-pulse" style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <div className="h-4 rounded-lg bg-tf-border w-3/4 mb-2" />
                      <div className="h-3 rounded-lg bg-tf-border w-1/2" />
                    </div>
                  ))}
                </div>
              )}

              {/* 뷰포트 안에 없음 */}
              {!loading && visibleRestaurants.length === 0 && state.restaurants.length > 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-center px-6">
                  <p className="text-[13px] text-tf-text-hint">지도를 이동하면<br />이 영역의 맛집이 표시됩니다</p>
                </div>
              )}

              {/* 검색 결과 없음 */}
              {!loading && coords && state.restaurants.length === 0 && !apiError && (
                <div className="flex flex-col items-center justify-center h-40 text-center px-6">
                  <p className="text-[13px] text-tf-text-hint">이 근방에는 먹을 곳이 없구나...</p>
                </div>
              )}

              {visibleRestaurants.map(r => (
                <RestaurantCard
                  key={r.id}
                  restaurant={r}
                  isActive={state.currentRestaurant?.id === r.id}
                  onClick={() => { selectOnMap(r); setShowModal(true) }}
                />
              ))}
            </div>
          </div>

          {/* 우: 지도 */}
          <div className="flex-1 relative">
            <MapView
              lat={mapLat}
              lng={mapLng}
              restaurants={state.restaurants}
              onPinClick={r => { selectOnMap(r); setShowModal(true) }}
              onBoundsChange={handleBoundsChange}
              mapClassName="w-full h-full"
              selectedId={state.currentRestaurant?.id}
            />

            {/* 마님께 여쭙기 — 지도 중앙 하단 토스트 배너 */}
            <AnimatePresence>
              {coords && !showModal && state.mode !== 'accepted' && (
                <motion.div
                  className="absolute bottom-8 left-1/2 z-10 pointer-events-auto"
                  style={{ transform: 'translateX(-50%)' }}
                  initial={{ opacity: 0, y: 16, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.9 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                >
                  <button
                    onClick={() => { startElimination(); setShowModal(true) }}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[14px] font-bold text-white"
                    style={{
                      background: '#3182f6',
                      boxShadow: '0 4px 24px rgba(49,130,246,0.45), 0 2px 8px rgba(0,0,0,0.12)',
                    }}
                  >
                    <div className="w-7 h-7 bg-white rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center border border-white/20">
                      <img src="/characters/event_tempting.png" alt="마님" className="w-[130%] h-[130%] object-cover pt-1.5 ml-0.5" style={{ mixBlendMode: 'multiply' }} />
                    </div>
                    마님께 여쭙기
                    <span className="text-[11px] font-normal opacity-80 ml-1">소거법으로 찾기</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* 바텀시트 모달 */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div className="fixed inset-0 z-30"
              style={{ background: 'rgba(25,31,40,0.24)', backdropFilter: 'blur(3px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-40 flex flex-col bg-white md:max-w-[480px] md:mx-auto md:bottom-6 md:rounded-3xl"
              style={{ borderRadius: '24px 24px 0 0', maxHeight: '88vh', boxShadow: '0 -4px 40px rgba(25,31,40,0.14)' }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            >
              {/* 모달 헤더 */}
              <div className="flex-shrink-0 px-5 pt-3 pb-3" style={{ borderBottom: '1px solid #f0f0f0' }}>
                <div className="w-10 h-1 rounded-full bg-tf-border mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-tf-text">마님과의 대화</span>
                  <button onClick={() => setShowModal(false)}
                    className="text-[12px] text-tf-text-hint px-3 py-1.5 rounded-full"
                    style={{ background: '#f7f8fa', border: '1px solid #e5e8eb' }}>닫기</button>
                </div>
              </div>

              {/* 대화 내용 */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 min-h-0">
                {state.dialogues.map((msg, i) => <ChatBubble key={i} msg={msg} />)}

                {/* 로딩 말풍선 */}
                {loading && (
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-white overflow-hidden border border-tf-border flex-shrink-0 flex items-center justify-center">
                      <img src="/characters/event_tempting.png" alt="마님" className="w-[130%] h-[130%] object-cover pt-1.5 ml-0.5" style={{ mixBlendMode: 'multiply' }} />
                    </div>
                    <div className="px-4 py-3"
                      style={{ background: BLUE_LIGHT, border: `1px solid ${BLUE_BORDER}`, borderRadius: '4px 16px 16px 16px', fontSize: 14 }}>
                      <div className="text-[11px] font-bold mb-1" style={{ color: BLUE }}>마님</div>
                      <span className="animate-pulse text-tf-text-sub font-medium">마님이 고심 중이시니라...</span>
                    </div>
                  </div>
                )}

                {/* 추천 음식점 카드 (dialogue 모드) */}
                {state.currentRestaurant && state.mode === 'dialogue' && !loading && (
                  <div className="ml-10 rounded-2xl p-4 bg-white" style={{ border: `1.5px solid ${BLUE_BORDER}` }}>
                    <div className="font-bold text-[15px] tracking-tight" style={{ color: BLUE }}>{state.currentRestaurant.name}</div>
                    <div className="text-[12px] text-tf-text-sub mt-1">
                      {state.currentRestaurant.category} · 도보 {Math.ceil(state.currentRestaurant.distance / 80)}분 ({state.currentRestaurant.distance}m)
                    </div>
                    {state.currentRestaurant.address && (
                      <div className="text-[11px] text-tf-text-hint mt-0.5">{state.currentRestaurant.address}</div>
                    )}
                    {state.currentRestaurant.reviews && state.currentRestaurant.reviews.map((rv, i) => (
                      <div key={i} className="mt-2 pt-2" style={{ borderTop: i === 0 ? '1px solid #f0f0f0' : 'none' }}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-bold text-tf-text-sub">{rv.nickname}</span>
                          <span className="text-[10px]">{'★'.repeat(rv.rating)}</span>
                        </div>
                        <div className="text-[11px] text-tf-text-hint italic">&ldquo;{rv.text}&rdquo;</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 추천 음식점 카드 (elimination 모드) */}
                {state.mode === 'elimination' && state.currentRestaurant && !loading && (
                  <div className="ml-10 rounded-2xl p-4 bg-white" style={{ border: '1.5px solid #c9dffe' }}>
                    <div className="text-[11px] font-semibold mb-1.5" style={{ color: '#3182f6' }}>
                      이 음식점은 어떻습니까?
                    </div>
                    <div className="font-bold text-[15px] tracking-tight text-tf-text">{state.currentRestaurant.name}</div>
                    <div className="text-[12px] text-tf-text-sub mt-1">
                      {state.currentRestaurant.category} · 도보 {Math.ceil(state.currentRestaurant.distance / 80)}분 ({state.currentRestaurant.distance}m)
                    </div>
                    {state.currentRestaurant.address && (
                      <div className="text-[11px] text-tf-text-hint mt-0.5">{state.currentRestaurant.address}</div>
                    )}
                    {state.currentRestaurant.reviews && state.currentRestaurant.reviews.map((rv, i) => (
                      <div key={i} className="mt-2 pt-2" style={{ borderTop: i === 0 ? '1px solid #f0f0f0' : 'none' }}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-bold text-tf-text-sub">{rv.nickname}</span>
                          <span className="text-[10px]">{'★'.repeat(rv.rating)}</span>
                        </div>
                        <div className="text-[11px] text-tf-text-hint italic">&ldquo;{rv.text}&rdquo;</div>
                      </div>
                    ))}
                    {state.currentRestaurant.naverUrl && (
                      <a href={state.currentRestaurant.naverUrl} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-block mt-2 text-[11px] font-semibold" style={{ color: '#03c75a' }}>
                        네이버 리뷰 →
                      </a>
                    )}
                  </div>
                )}

                {/* 선택한 음식점 카드 (map 모드) */}
                {state.mode === 'map' && state.currentRestaurant && (
                  <div className="ml-10 rounded-2xl p-4 bg-white" style={{ border: `1.5px solid ${BLUE}` }}>
                    <div className="font-bold text-[15px]" style={{ color: BLUE }}>{state.currentRestaurant.name}</div>
                    <div className="text-[12px] text-tf-text-sub mt-0.5">
                      {state.currentRestaurant.category} · {state.currentRestaurant.distance}m
                    </div>
                  </div>
                )}

                {/* 최종 확정 카드 & 쌀밥 이벤트 스티커 */}
                {(state.mode === 'accepted' || state.mode === 'forcePick') && state.currentRestaurant && (
                  <div className="flex flex-col gap-5">
                    {/* 쌀밥 강제 — 레터스왑 타이틀 */}
                    {state.mode === 'forcePick' && <RiceSlapTitle />}

                    {/* 쌀밥 확정(forcePick) 시 나오는 특별 스티커 연출 */}
                    {state.mode === 'forcePick' && (() => {
                      const stickers = [
                        { src: '/characters/event_subsub.png', alt: '섭섭' },
                        { src: '/characters/event_shutup.png', alt: '닥쳐라' },
                        { src: '/characters/event_cry.png', alt: '쮸륵' },
                      ]
                      // 고유 ID의 마지막 문자 값을 이용해 화면 출력 시 항상 동일한 '랜덤' 이미지 유지
                      const index = state.currentRestaurant.id.charCodeAt(state.currentRestaurant.id.length - 1) % 3
                      const sticker = stickers[index]

                      return (
                        <div className="flex flex-col items-center justify-center pt-2 pb-3">
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ type: 'spring', damping: 15, stiffness: 250 }}
                          >
                            <img src={sticker.src} alt={sticker.alt} className="w-[130px] md:w-[150px] object-contain" style={{ mixBlendMode: 'multiply' }} />
                          </motion.div>
                        </div>
                      )
                    })()}

                    <motion.div 
                      className="rounded-2xl p-5 text-center" 
                      style={{ background: BLUE_LIGHT, border: `1.5px solid ${BLUE_BORDER}` }}
                      initial={state.mode === 'forcePick' ? { opacity: 0, y: 20 } : false}
                      animate={state.mode === 'forcePick' ? { opacity: 1, y: 0 } : false}
                      transition={state.mode === 'forcePick' ? { delay: 2.4 } : undefined}
                    >
                      <div className="text-[12px] mb-1 font-bold" style={{ color: BLUE }}>
                        {state.mode === 'forcePick' ? '🍚 오늘의 쌀밥' : '오늘의 맛집이 정해졌습니다'}
                      </div>
                      <div className="text-[22px] font-bold text-tf-text tracking-tight">{state.currentRestaurant.name}</div>
                      <div className="text-[12px] text-tf-text-hint mt-1">{state.currentRestaurant.address}</div>
                    </motion.div>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* 소거법 질문 UI */}
              {state.mode === 'elimination' && !loading && (
                <EliminationPanel
                  step={state.eliminationStep}
                  restaurants={state.restaurants}
                  excludedCategories={state.excludedCategories}
                  maxWalkMin={state.maxWalkMin}
                  onAnswer={eliminationAnswer}
                  onSkip={() => forcePick(coords!.lat, coords!.lng)}
                />
              )}

              {/* 액션 버튼 */}
              <div className="flex-shrink-0 px-5 py-4 space-y-2 bg-white" style={{ borderTop: '1px solid #f0f0f0' }}>
                {apiError && !loading && (
                  <button onClick={handleRetry}
                    className="w-full py-3 rounded-xl text-[14px] font-semibold active:scale-95 transition-all"
                    style={{ border: `1.5px solid ${BLUE}`, color: BLUE, background: BLUE_LIGHT }}>
                    다시 여쭙기
                  </button>
                )}
                {state.mode === 'elimination' && state.currentRestaurant && !loading && (
                  <div className="flex gap-2">
                    <button onClick={accept}
                      className="flex-1 py-3 rounded-xl text-[14px] font-bold text-white active:scale-95 transition-all"
                      style={{ background: BLUE }}>
                      이걸로 먹겠습니다
                    </button>
                    <button onClick={rePickElimination}
                      className="flex-1 py-3 rounded-xl text-[14px] font-bold active:scale-95 transition-all"
                      style={{ background: '#f7f8fa', color: '#6b7684', border: '1px solid #e5e8eb' }}>
                      다른 것도 있사옵니까
                    </button>
                  </div>
                )}
                {state.mode === 'dialogue' && state.currentRestaurant && !loading && (
                  <div className="flex gap-2">
                    <button onClick={accept}
                      className="flex-1 py-4 rounded-xl text-[15px] font-bold text-white active:scale-95 transition-all"
                      style={{ background: BLUE }}>
                      감사히 받겠습니다
                    </button>
                    <button onClick={handleReject}
                      className="flex-1 py-4 rounded-xl text-[15px] font-bold active:scale-95 transition-all"
                      style={{ background: '#f7f8fa', color: '#6b7684', border: '1px solid #e5e8eb' }}>
                      사양하겠습니다
                    </button>
                  </div>
                )}
                {state.mode === 'map' && !loading && (
                  <div className="space-y-2">
                    {!state.currentRestaurant && (
                      <p className="text-center text-[13px] text-tf-text-sub py-1">지도에서 음식점 핀을 선택하세요</p>
                    )}
                    {state.currentRestaurant && (
                      <button onClick={accept}
                        className="w-full py-4 rounded-xl text-[15px] font-bold active:scale-95 transition-all"
                        style={{ background: BLUE, color: '#fff' }}>
                        {state.currentRestaurant.name}(으)로 가겠습니다
                      </button>
                    )}
                    <button onClick={() => forcePick(coords!.lat, coords!.lng)}
                      className="w-full py-3 rounded-xl text-[13px] active:scale-95 transition-all"
                      style={{ background: '#f7f8fa', color: '#b0b8c1', border: '1px solid #e5e8eb' }}>
                      쌀밥을 주시옵소서... (마님이 골라줌)
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
