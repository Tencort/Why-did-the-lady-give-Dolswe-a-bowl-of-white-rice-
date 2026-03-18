# 왜 마님은 돌쇠에게 쌀밥을 주었을까 — 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사극 세계관 기반 직장인 점심 추천 웹서비스 MVP 구현

**Architecture:** Next.js App Router 기반 SPA. 클라이언트 상태만 사용 (DB 없음). 카카오맵 API로 음식점 검색 및 지도 렌더링. 대사 시스템은 사전 정의 풀에서 상황별 랜덤 선택.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, 카카오맵 SDK, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-16-lunch-recommender-design.md`

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx              # 루트 레이아웃 (나눔명조 폰트, 다크 테마)
│   ├── page.tsx                # 랜딩 (위치 허용 + 조건 설정)
│   ├── recommend/
│   │   └── page.tsx            # 추천 화면 (대화형 + 지도 탐색)
│   └── api/
│       ├── recommend/route.ts  # 음식점 추천 API
│       ├── dialogue/route.ts   # 대사 생성 API
│       └── geocode/route.ts    # 주소 → 좌표 변환 API
├── components/
│   ├── ConditionForm.tsx       # 인원/카테고리 선택 폼
│   ├── DialogueBox.tsx         # 마님/돌쇠 대화창 (RPG 턴제)
│   ├── MapView.tsx             # 카카오맵 + 캐릭터 오버레이
│   ├── RiceBowlGauge.tsx       # 쌀밥 잔여량 표시
│   └── AddressInput.tsx        # 위치 거부 시 수동 주소 입력
├── data/
│   └── dialogues.ts            # 대사 풀 (마님 추천/반응, 돌쇠 변명, 지도 코멘트)
├── hooks/
│   ├── useGeolocation.ts       # 위치 허용/거부 처리
│   └── useRecommendation.ts    # 추천 상태 관리 (거절 횟수, 모드, 음식점 목록)
└── types/
    └── index.ts                # 타입 정의 (Restaurant, DialogueState 등)

public/
├── characters/
│   ├── manim-normal.png        # 마님 기본
│   ├── manim-angry.png         # 마님 화남
│   ├── manim-furious.png       # 마님 폭발
│   ├── dolsoe-normal.png       # 돌쇠 기본
│   └── dolsoe-sorry.png        # 돌쇠 변명
```

---

## Chunk 1: 프로젝트 셋업 + 데이터 레이어

### Task 1: Next.js 프로젝트 초기화

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `.env.local`, `.gitignore`

- [ ] **Step 1: Next.js 프로젝트 생성**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

- [ ] **Step 2: .env.local 생성**

```env
NEXT_PUBLIC_KAKAO_APP_KEY=your_kakao_javascript_key_here
KAKAO_REST_API_KEY=your_kakao_rest_api_key_here
```

- [ ] **Step 3: .gitignore에 .env.local 확인**

`.env.local`이 `.gitignore`에 포함되어 있는지 확인. 없으면 추가.

- [ ] **Step 4: tailwind.config.ts에 사극 테마 컬러 추가**

```typescript
// tailwind.config.ts - theme.extend.colors에 추가
colors: {
  sageuk: {
    bg: '#1a1a2e',
    card: '#2a2a4a',
    gold: '#ffd700',
    accept: '#4a7c4a',
    reject: '#7c4a4a',
    danger: '#ff4444',
  }
}
```

- [ ] **Step 5: 나눔명조 폰트 적용 (layout.tsx)**

```typescript
// src/app/layout.tsx
import { Nanum_Myeongjo } from 'next/font/google'

const nanumMyeongjo = Nanum_Myeongjo({
  weight: ['400', '700', '800'],
  subsets: ['latin'],
})
```

- [ ] **Step 6: 글로벌 스타일 (globals.css)**

```css
body {
  background-color: #1a1a2e;
  color: #e0e0e0;
}
```

- [ ] **Step 7: 개발 서버 실행 확인**

```bash
npm run dev
```

Expected: localhost:3000에서 다크 배경 + 나눔명조 적용된 기본 페이지 확인

- [ ] **Step 8: 커밋**

```bash
git init && git add package.json tsconfig.json next.config.* tailwind.config.* postcss.config.* src/ public/ .gitignore .eslintrc.json && git commit -m "프로젝트 초기화 — Next.js + Tailwind + 사극 테마 설정"
```

---

### Task 2: 타입 정의 + 대사 데이터

**Files:**
- Create: `src/types/index.ts`
- Create: `src/data/dialogues.ts`

- [ ] **Step 1: 타입 정의 작성**

```typescript
// src/types/index.ts

/** 카카오맵 API에서 반환된 음식점 정보 */
export interface Restaurant {
  id: string
  name: string
  category: string        // "한식", "중식" 등
  distance: number         // 미터 단위
  lat: number
  lng: number
  address: string
  phone?: string
}

/** 추천 상태 */
export type RecommendMode = 'dialogue' | 'map' | 'accepted' | 'forcePick'

/** 거절 단계 (0: 아직 안 거절, 1~3) */
export type RejectionLevel = 0 | 1 | 2 | 3

/** 마님 감정 상태 */
export type ManimEmotion = 'normal' | 'sad' | 'angry' | 'furious'

/** 대화 메시지 */
export interface DialogueMessage {
  speaker: 'manim' | 'dolsoe'
  text: string
  emotion: ManimEmotion
}

/** 추천 상태 전체 */
export interface RecommendState {
  mode: RecommendMode
  rejectionCount: RejectionLevel
  currentRestaurant: Restaurant | null
  rejectedIds: string[]
  restaurants: Restaurant[]
  dialogues: DialogueMessage[]
  headcount: number
  categories: string[]
  totalAvailable: number  // 추천 가능 음식점 총 수 (< 3이면 조기 지도 전환)
}

/** 조건 설정 */
export interface SearchCondition {
  lat: number
  lng: number
  headcount: number
  categories: string[]
}
```

- [ ] **Step 2: 대사 풀 작성**

```typescript
// src/data/dialogues.ts

/** 마님 추천 대사 — {category}, {name} 플레이스홀더 사용 */
export const MANIM_RECOMMEND = [
  "오늘은 {category}가 딱이니라. {name}에 가거라!",
  "내 입맛은 틀린 적이 없느니라. {name}을 먹어라!",
  "돌쇠야, 오늘 점심은 내가 정했다. {name}이다!",
  "{category}가 먹고 싶지 않느냐? {name}이 제격이니라.",
  "내가 아끼는 {name}, 오늘은 여기다!",
]

/** 돌쇠 거절 변명 */
export const DOLSOE_EXCUSE = [
  "마님, 어제도 그걸 먹었사옵니다...",
  "소인, 요즘 몸이 안 좋아 기름진 건 좀...",
  "마님 은혜는 감사하오나, 지갑 사정이...",
  "소인의 입맛이 오늘따라 까다로워졌사옵니다...",
  "마님, 그곳은 줄이 길다 하옵니다...",
]

/** 마님 거절 반응 (단계별) */
export const MANIM_REJECTION: Record<1 | 2 | 3, string[]> = {
  1: [
    "허, 내 안목을 의심하느냐...",
    "흠, 맘에 안 드느냐? 다시 골라주마.",
    "한 번은 봐주겠다. 다음엔 없느니라.",
  ],
  2: [
    "이놈이 감히! 두 번이나 거절이냐!",
    "내 체면이 말이 아니구나...",
    "좋다, 한 번만 더 기회를 주마. 마지막이다!",
  ],
  3: [
    "좋다! 네 놈이 직접 골라봐라. 쌀밥은 없다!",
    "더 이상 참을 수 없다! 네가 알아서 해라!",
    "쌀밥을 거두겠다! 직접 찾아 먹어라, 이 불충한 놈!",
  ],
}

/** 지도 모드 마님 코멘트 (조건별) */
export const MANIM_MAP_COMMENT = {
  close: [
    "가까운 곳만 찾다니, 게으른 놈...",
    "코앞만 보는구나, 쯧...",
  ],
  far: [
    "거기까지 걸어갈 성의는 있느냐?",
    "먼 곳을 고르다니, 의외로 부지런하구나.",
  ],
  sameCategory: [
    "...결국 내 말이 맞지 않더냐",
    "내가 추천한 것과 같은 종류잖느냐. 처음부터 들을 것이지!",
  ],
  other: [
    "흥, 네 놈 알아서 해라",
    "그래, 네 입맛이니 네가 알겠지...",
    "후회하지 마라...",
  ],
}

/** 인원 기반 대사 */
export const HEADCOUNT_COMMENT: Record<string, string[]> = {
  solo: ["혼밥이냐? 쓸쓸한 놈...", "혼자 먹겠다? 외로운 점심이로구나."],
  small: ["소수정예로 가는구나", "둘셋이 가기 좋은 곳을 찾아주마."],
  large: ["대식구로구나, 넓은 곳을 찾아야겠다", "이 많은 인원을... 자리가 있을지 모르겠구나."],
}

/** 검색 결과 없을 때 */
export const NO_RESULT = [
  "이 근방에는 먹을 곳이 없구나... 반경을 넓혀보겠느냐?",
  "허, 이런 황무지에서 밥을 찾다니... 다른 곳을 살펴보겠느냐?",
]

/** API 에러 시 */
export const API_ERROR = [
  "마님이 잠시 자리를 비우셨습니다...",
  "마님의 기력이 다하셨습니다. 잠시 후 다시...",
]

/** 지도 모드에서 결정 못할 때 — 마님이 강제로 골라주는 "쌀밥" 이벤트 */
export const MANIM_FORCE_PICK = [
  "에잇, 이 불쌍한 놈! 내가 정해주마. 쌀밥이다!",
  "결정도 못하느냐... 가엾구나. 내가 골라주겠다!",
  "보다 못해 나서마. 이리 오너라, 쌀밥을 주겠다!",
]
```

- [ ] **Step 3: 커밋**

```bash
git add src/types/index.ts src/data/dialogues.ts
git commit -m "타입 정의 + 대사 풀 데이터 추가 — 마님/돌쇠 세계관 텍스트"
```

---

### Task 3: 위치 훅 + API Routes

**Files:**
- Create: `src/hooks/useGeolocation.ts`
- Create: `src/app/api/recommend/route.ts`
- Create: `src/app/api/dialogue/route.ts`
- Create: `src/app/api/geocode/route.ts`

- [ ] **Step 1: useGeolocation 훅 작성**

```typescript
// src/hooks/useGeolocation.ts
'use client'

import { useState, useCallback } from 'react'

interface GeolocationState {
  lat: number | null
  lng: number | null
  status: 'idle' | 'loading' | 'granted' | 'denied' | 'error'
  error: string | null
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    lat: null, lng: null, status: 'idle', error: null,
  })

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, status: 'error', error: '위치 서비스를 지원하지 않는 브라우저입니다.' }))
      return
    }

    setState(prev => ({ ...prev, status: 'loading' }))

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          status: 'granted',
          error: null,
        })
      },
      () => {
        setState(prev => ({
          ...prev,
          status: 'denied',
          error: '위치 허용이 필요합니다.',
        }))
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // 수동 주소 입력으로 좌표 설정
  const setManualLocation = useCallback((lat: number, lng: number) => {
    setState({ lat, lng, status: 'granted', error: null })
  }, [])

  return { ...state, requestLocation, setManualLocation }
}
```

- [ ] **Step 2: 음식점 추천 API Route 작성**

```typescript
// src/app/api/recommend/route.ts
import { NextRequest, NextResponse } from 'next/server'

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY

export async function POST(request: NextRequest) {
  try {
    const { lat, lng, categories, rejectedIds } = await request.json()

    if (!KAKAO_REST_API_KEY) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    // 각 카테고리별로 키워드 검색 후 합치기
    const allRestaurants: any[] = []

    for (const category of categories) {
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(category)}&x=${lng}&y=${lat}&radius=1000&sort=distance&category_group_code=FD6`

      const response = await fetch(url, {
        headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
      })

      if (!response.ok) continue

      const data = await response.json()
      allRestaurants.push(...(data.documents || []))
    }

    // 중복 제거 (id 기준) + 거절한 음식점 제외
    const uniqueMap = new Map()
    for (const r of allRestaurants) {
      if (!rejectedIds?.includes(r.id) && !uniqueMap.has(r.id)) {
        uniqueMap.set(r.id, {
          id: r.id,
          name: r.place_name,
          category: r.category_name?.split(' > ').pop() || '음식점',
          distance: parseInt(r.distance) || 0,
          lat: parseFloat(r.y),
          lng: parseFloat(r.x),
          address: r.road_address_name || r.address_name,
          phone: r.phone || undefined,
        })
      }
    }

    const restaurants = Array.from(uniqueMap.values())

    if (restaurants.length === 0) {
      return NextResponse.json({ restaurants: [], picked: null, totalAvailable: 0 })
    }

    // 랜덤 선택
    const picked = restaurants[Math.floor(Math.random() * restaurants.length)]

    return NextResponse.json({ restaurants, picked, totalAvailable: restaurants.length })
  } catch (error) {
    return NextResponse.json({ error: '음식점 검색 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
```

- [ ] **Step 3: 대사 API Route 작성**

```typescript
// src/app/api/dialogue/route.ts
import { NextRequest, NextResponse } from 'next/server'
import {
  MANIM_RECOMMEND, DOLSOE_EXCUSE, MANIM_REJECTION,
  MANIM_MAP_COMMENT, HEADCOUNT_COMMENT, NO_RESULT, API_ERROR,
} from '@/data/dialogues'

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || '')
}

export async function POST(request: NextRequest) {
  const { type, restaurantName, category, rejectionLevel, distance, headcount, recommendedCategory } = await request.json()

  switch (type) {
    case 'recommend': {
      const template = pickRandom(MANIM_RECOMMEND)
      const text = fillTemplate(template, { name: restaurantName, category })
      return NextResponse.json({ speaker: 'manim', text, emotion: 'normal' })
    }
    case 'excuse': {
      const text = pickRandom(DOLSOE_EXCUSE)
      return NextResponse.json({ speaker: 'dolsoe', text, emotion: 'normal' })
    }
    case 'rejection': {
      const level = Math.min(rejectionLevel, 3) as 1 | 2 | 3
      const text = pickRandom(MANIM_REJECTION[level])
      const emotion = level === 1 ? 'sad' : level === 2 ? 'angry' : 'furious'
      return NextResponse.json({ speaker: 'manim', text, emotion })
    }
    case 'mapComment': {
      let commentPool: string[]
      if (distance <= 200) commentPool = MANIM_MAP_COMMENT.close
      else if (distance >= 800) commentPool = MANIM_MAP_COMMENT.far
      else if (category === recommendedCategory) commentPool = MANIM_MAP_COMMENT.sameCategory
      else commentPool = MANIM_MAP_COMMENT.other
      return NextResponse.json({ speaker: 'manim', text: pickRandom(commentPool), emotion: 'angry' })
    }
    case 'headcount': {
      const key = headcount === 1 ? 'solo' : headcount <= 3 ? 'small' : 'large'
      return NextResponse.json({ speaker: 'manim', text: pickRandom(HEADCOUNT_COMMENT[key]), emotion: 'normal' })
    }
    case 'noResult': {
      return NextResponse.json({ speaker: 'manim', text: pickRandom(NO_RESULT), emotion: 'sad' })
    }
    case 'apiError': {
      return NextResponse.json({ speaker: 'manim', text: pickRandom(API_ERROR), emotion: 'sad' })
    }
    default:
      return NextResponse.json({ error: '알 수 없는 대사 타입' }, { status: 400 })
  }
}
```

- [ ] **Step 4: 지오코딩 API Route 작성 (주소 → 좌표)**

```typescript
// src/app/api/geocode/route.ts
import { NextRequest, NextResponse } from 'next/server'

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY

/** 주소 검색 → 좌표 변환 (AddressInput에서 사용) */
export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!KAKAO_REST_API_KEY) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    // 키워드로 장소 검색 (주소 검색보다 유연)
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`
    const response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
    })

    if (!response.ok) {
      return NextResponse.json({ error: '주소 검색에 실패했습니다.' }, { status: 500 })
    }

    const data = await response.json()
    if (!data.documents || data.documents.length === 0) {
      return NextResponse.json({ error: '검색 결과가 없습니다.' }, { status: 404 })
    }

    const place = data.documents[0]
    return NextResponse.json({
      lat: parseFloat(place.y),
      lng: parseFloat(place.x),
      name: place.place_name || place.address_name,
    })
  } catch {
    return NextResponse.json({ error: '주소 검색 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
```

- [ ] **Step 5: 커밋**

```bash
git add src/hooks/useGeolocation.ts src/app/api/recommend/route.ts src/app/api/dialogue/route.ts src/app/api/geocode/route.ts
git commit -m "위치 훅 + API Routes 추가 — 카카오맵 연동, 대사 시스템, 지오코딩"
```

---

## Chunk 2: UI 컴포넌트

### Task 4: RiceBowlGauge 컴포넌트

**Files:**
- Create: `src/components/RiceBowlGauge.tsx`

- [ ] **Step 1: RiceBowlGauge 구현**

```tsx
// src/components/RiceBowlGauge.tsx
'use client'

import { RejectionLevel } from '@/types'

interface Props {
  rejectionCount: RejectionLevel
}

/** 쌀밥 잔여량 표시 — 거절할 때마다 하나씩 사라짐 */
export default function RiceBowlGauge({ rejectionCount }: Props) {
  const remaining = 3 - rejectionCount

  return (
    <div className="flex flex-col items-center gap-1 bg-sageuk-card rounded-lg p-3">
      <span className="text-xs text-gray-400">쌀밥 잔여량</span>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`text-2xl transition-all duration-500 ${
              i < remaining ? 'opacity-100 scale-100' : 'opacity-20 scale-75'
            }`}
          >
            🍚
          </span>
        ))}
      </div>
      {rejectionCount === 3 && (
        <span className="text-xs text-sageuk-danger mt-1 animate-pulse">
          쌀밥 박탈!
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/RiceBowlGauge.tsx
git commit -m "RiceBowlGauge 컴포넌트 추가 — 쌀밥 잔여량 시각화"
```

---

### Task 5: DialogueBox 컴포넌트

**Files:**
- Create: `src/components/DialogueBox.tsx`

- [ ] **Step 1: DialogueBox 구현**

```tsx
// src/components/DialogueBox.tsx
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
  const lastDialogue = dialogues[dialogues.length - 1]

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
                  // 이미지 로드 실패 시 이모지 fallback
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  target.parentElement!.textContent = msg.speaker === 'manim' ? '👴' : '🧑'
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
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/DialogueBox.tsx
git commit -m "DialogueBox 컴포넌트 추가 — RPG 대화창 + 캐릭터 이미지 + 이모지 fallback"
```

---

### Task 6: ConditionForm 컴포넌트

**Files:**
- Create: `src/components/ConditionForm.tsx`

- [ ] **Step 1: ConditionForm 구현**

```tsx
// src/components/ConditionForm.tsx
'use client'

import { useState } from 'react'

interface Props {
  onSubmit: (headcount: number, categories: string[]) => void
}

const CATEGORIES = ['한식', '중식', '일식', '양식', '분식']

/** 인원/카테고리 조건 설정 폼 */
export default function ConditionForm({ onSubmit }: Props) {
  const [headcount, setHeadcount] = useState(1)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const handleSubmit = () => {
    const cats = selectedCategories.length > 0 ? selectedCategories : CATEGORIES
    onSubmit(headcount, cats)
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-sageuk-gold text-center">마님의 밥상</h2>

      {/* 인원 선택 */}
      <div className="bg-sageuk-card border border-sageuk-gold rounded-lg p-4">
        <label className="text-xs text-gray-400 block mb-2">인원</label>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setHeadcount(Math.max(1, headcount - 1))}
            className="w-8 h-8 bg-sageuk-bg border border-sageuk-gold rounded text-sageuk-gold"
          >
            -
          </button>
          <span className="text-xl font-bold text-sageuk-gold">{headcount}명</span>
          <button
            onClick={() => setHeadcount(Math.min(10, headcount + 1))}
            className="w-8 h-8 bg-sageuk-bg border border-sageuk-gold rounded text-sageuk-gold"
          >
            +
          </button>
        </div>
      </div>

      {/* 카테고리 선택 */}
      <div className="bg-sageuk-card border border-sageuk-gold rounded-lg p-4">
        <label className="text-xs text-gray-400 block mb-2">카테고리 (미선택 시 전체)</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`px-3 py-1.5 rounded text-sm font-bold transition-colors ${
                selectedCategories.includes(cat)
                  ? 'bg-sageuk-gold text-sageuk-bg'
                  : 'bg-sageuk-bg text-gray-400 border border-gray-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 제출 */}
      <button
        onClick={handleSubmit}
        className="w-full bg-sageuk-gold text-sageuk-bg py-3 rounded-lg text-lg font-bold hover:bg-yellow-500 transition-colors"
      >
        마님께 여쭙기
      </button>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/ConditionForm.tsx
git commit -m "ConditionForm 컴포넌트 추가 — 인원/카테고리 조건 설정"
```

---

### Task 7: AddressInput 컴포넌트

**Files:**
- Create: `src/components/AddressInput.tsx`

- [ ] **Step 1: AddressInput 구현**

```tsx
// src/components/AddressInput.tsx
'use client'

import { useState } from 'react'

interface Props {
  onLocationSet: (lat: number, lng: number) => void
}

/** 위치 허용 거부 시 수동 주소 입력 fallback — /api/geocode 통해 좌표 변환 */
export default function AddressInput({ onLocationSet }: Props) {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!address.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: address }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || '주소를 찾을 수 없습니다.')
        return
      }

      const { lat, lng } = await res.json()
      onLocationSet(lat, lng)
    } catch {
      setError('주소 검색 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      <p className="text-sm text-gray-400 text-center">
        위치 허용이 거부되었습니다. 주소를 직접 입력해주세요.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="회사 주소 입력 (예: 강남역)"
          className="flex-1 bg-sageuk-card border border-sageuk-gold rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-sageuk-gold text-sageuk-bg px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
        >
          {loading ? '...' : '검색'}
        </button>
      </div>
      {error && <p className="text-xs text-sageuk-danger text-center">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/AddressInput.tsx
git commit -m "AddressInput 컴포넌트 추가 — /api/geocode 통해 주소 → 좌표 변환"
```

---

### Task 8: MapView 컴포넌트

**Files:**
- Create: `src/components/MapView.tsx`

- [ ] **Step 1: MapView 구현**

```tsx
// src/components/MapView.tsx
'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Restaurant } from '@/types'

interface Props {
  lat: number
  lng: number
  restaurants: Restaurant[]
  onPinClick: (restaurant: Restaurant) => void
}

declare global {
  interface Window {
    kakao: any
  }
}

/** 카카오맵 + 픽셀아트 캐릭터 오버레이 + 음식점 핀 */
export default function MapView({ lat, lng, restaurants, onPinClick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  // 마커 정리 함수
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []
  }, [])

  // 카카오맵 SDK 로드 + 지도 초기화
  useEffect(() => {
    // SDK 이미 로드된 경우 재사용
    if (window.kakao?.maps) {
      initMap()
      return
    }

    const script = document.createElement('script')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_APP_KEY}&autoload=false`
    script.async = true
    document.head.appendChild(script)
    script.onload = initMap

    function initMap() {
      window.kakao.maps.load(() => {
        if (!mapRef.current) return
        const mapInstance = new window.kakao.maps.Map(mapRef.current, {
          center: new window.kakao.maps.LatLng(lat, lng),
          level: 4,
        })
        mapInstanceRef.current = mapInstance

        // 마님 캐릭터 오버레이
        new window.kakao.maps.CustomOverlay({
          map: mapInstance,
          position: new window.kakao.maps.LatLng(lat, lng),
          content: `<div style="background:#ffd700;padding:2px 8px;border-radius:6px;font-size:12px;color:#000;font-weight:bold;white-space:nowrap;">마님 😤</div>`,
          yAnchor: 1.5,
        })
      })
    }
  }, [lat, lng])

  // 음식점 핀 표시 (restaurants 변경 시 이전 마커 정리)
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    clearMarkers()

    restaurants.forEach((r) => {
      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(r.lat, r.lng),
        map,
      })
      markersRef.current.push(marker)

      const infowindow = new window.kakao.maps.InfoWindow({
        content: `<div style="padding:4px 8px;font-size:12px;white-space:nowrap;">${r.name}</div>`,
      })

      window.kakao.maps.event.addListener(marker, 'click', () => {
        onPinClick(r)
      })
      window.kakao.maps.event.addListener(marker, 'mouseover', () => {
        infowindow.open(map, marker)
      })
      window.kakao.maps.event.addListener(marker, 'mouseout', () => {
        infowindow.close()
      })
    })

    return clearMarkers
  }, [restaurants, onPinClick, clearMarkers])

  return (
    <div className="w-full">
      <div ref={mapRef} className="w-full h-80 rounded-lg border border-sageuk-gold" />
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/MapView.tsx
git commit -m "MapView 컴포넌트 추가 — SDK 중복 로드 방지 + 마커 cleanup"
```

---

## Chunk 3: 페이지 조립 + 상태 관리

### Task 9: useRecommendation 훅

**Files:**
- Create: `src/hooks/useRecommendation.ts`

- [ ] **Step 1: useRecommendation 훅 구현**

```typescript
// src/hooks/useRecommendation.ts
'use client'

import { useState, useCallback, useRef } from 'react'
import { RecommendState, Restaurant, DialogueMessage, RejectionLevel } from '@/types'
import { API_ERROR } from '@/data/dialogues'

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
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** 추천 플로우 전체 상태 관리 */
export function useRecommendation() {
  const [state, setState] = useState<RecommendState>(initialState)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState(false)
  // stale closure 방지용 ref
  const stateRef = useRef(state)
  stateRef.current = state

  // 대사 API 호출 헬퍼
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
    lat: number, lng: number, categories: string[], headcount: number, rejectedIds: string[] = []
  ) => {
    setLoading(true)
    setApiError(false)
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, categories, rejectedIds }),
      })
      const data = await res.json()

      if (data.error) {
        // API 에러 — 재시도 가능하게
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
        // 검색 결과 없음
        const dialogue = await fetchDialogue({ type: 'noResult' })
        setState(prev => ({
          ...prev,
          headcount,
          categories,
          dialogues: [...prev.dialogues, dialogue],
        }))
        return
      }

      // 인원 기반 대사 (첫 추천 시에만)
      const msgs: DialogueMessage[] = []
      if (rejectedIds.length === 0) {
        msgs.push(await fetchDialogue({ type: 'headcount', headcount }))
      }

      // 추천 가능 음식점이 3개 미만이면 안내
      if (data.totalAvailable < 3 && rejectedIds.length === 0) {
        msgs.push({
          speaker: 'manim',
          text: `이 근방에 먹을 곳이 ${data.totalAvailable}곳밖에 없구나...`,
          emotion: 'sad',
        })
      }

      // 마님 추천 대사
      msgs.push(await fetchDialogue({
        type: 'recommend',
        restaurantName: data.picked.name,
        category: data.picked.category,
      }))

      setState(prev => ({
        ...prev,
        headcount,
        categories,
        currentRestaurant: data.picked,
        restaurants: data.restaurants,
        totalAvailable: data.totalAvailable,
        dialogues: [...prev.dialogues, ...msgs],
      }))
    } catch {
      // 네트워크 장애 — 로컬 대사 풀에서 직접 선택 (fetch 재시도 안 함)
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

  // 수락 — 'accepted' 모드로 전환하여 종료 화면 표시
  const accept = useCallback(() => {
    setState(prev => ({ ...prev, mode: 'accepted' }))
  }, [])

  // 지도 모드에서 결정 못할 때 — 마님이 강제로 골라줌 ("쌀밥")
  const forcePick = useCallback(async (lat: number, lng: number) => {
    const current = stateRef.current
    // 전체 음식점 중 랜덤 선택 (거절 목록 무시)
    const randomRestaurant = current.restaurants[Math.floor(Math.random() * current.restaurants.length)]
    if (!randomRestaurant) return

    const forceText = pickRandom(
      ["에잇, 이 불쌍한 놈! 내가 정해주마. 쌀밥이다!",
       "결정도 못하느냐... 가엾구나. 내가 골라주겠다!",
       "보다 못해 나서마. 이리 오너라, 쌀밥을 주겠다!"]
    )

    setState(prev => ({
      ...prev,
      currentRestaurant: randomRestaurant,
      mode: 'forcePick',
      dialogues: [...prev.dialogues, { speaker: 'manim', text: forceText, emotion: 'normal' }],
    }))
  }, [])

  // 거절 (함수형 setState로 stale closure 방지)
  const reject = useCallback(async (lat: number, lng: number) => {
    const current = stateRef.current
    const newCount = Math.min(current.rejectionCount + 1, 3) as RejectionLevel
    const newRejectedIds = [...current.rejectedIds, current.currentRestaurant!.id]

    // 돌쇠 변명 + 마님 반응
    const [excuse, reaction] = await Promise.all([
      fetchDialogue({ type: 'excuse' }),
      fetchDialogue({ type: 'rejection', rejectionLevel: newCount }),
    ])

    // 추천 가능 음식점이 남아있는지 확인
    const remainingCount = current.totalAvailable - newRejectedIds.length
    const shouldSwitchToMap = newCount >= 3 || remainingCount <= 0

    if (shouldSwitchToMap) {
      setState(prev => ({
        ...prev,
        rejectionCount: newCount,
        mode: 'map',
        rejectedIds: newRejectedIds,
        currentRestaurant: null,
        dialogues: [...prev.dialogues, excuse, reaction],
      }))
    } else {
      setState(prev => ({
        ...prev,
        rejectionCount: newCount,
        rejectedIds: newRejectedIds,
        dialogues: [...prev.dialogues, excuse, reaction],
      }))

      // 재추천
      await fetchRecommendation(lat, lng, current.categories, current.headcount, newRejectedIds)
    }
  }, [fetchRecommendation])

  // 지도에서 음식점 선택 시 마님 코멘트
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
      dialogues: [...prev.dialogues, comment],
    }))
  }, [])

  // 리셋
  const reset = useCallback(() => {
    setState(initialState)
    setApiError(false)
  }, [])

  return { state, loading, apiError, fetchRecommendation, accept, reject, selectOnMap, forcePick, reset }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/hooks/useRecommendation.ts
git commit -m "useRecommendation 훅 추가 — stale closure 수정 + 조기 지도 전환 + 에러 핸들링"
```

---

### Task 10: 메인 페이지 (랜딩 + 조건 설정)

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 메인 페이지 구현**

```tsx
// src/app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGeolocation } from '@/hooks/useGeolocation'
import ConditionForm from '@/components/ConditionForm'
import AddressInput from '@/components/AddressInput'

/** 랜딩 페이지 — 위치 허용 + 조건 설정 */
export default function Home() {
  const router = useRouter()
  const geo = useGeolocation()
  const [step, setStep] = useState<'intro' | 'location' | 'condition'>('intro')

  const handleStart = () => {
    geo.requestLocation()
    setStep('location')
  }

  // 위치 허용 상태 변화 감지 (useEffect로 무한 리렌더 방지)
  useEffect(() => {
    if (step === 'location' && geo.status === 'granted') {
      setStep('condition')
    }
  }, [step, geo.status])

  const handleConditionSubmit = (headcount: number, categories: string[]) => {
    const params = new URLSearchParams({
      lat: String(geo.lat),
      lng: String(geo.lng),
      headcount: String(headcount),
      categories: categories.join(','),
    })
    router.push(`/recommend?${params.toString()}`)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      {step === 'intro' && (
        <div className="text-center space-y-6">
          <h1 className="text-3xl font-bold text-sageuk-gold leading-tight">
            왜 마님은 돌쇠에게<br />쌀밥을 주었을까
          </h1>
          <p className="text-gray-400 text-sm">오늘 점심, 마님이 정해주실 것이니라</p>
          <button
            onClick={handleStart}
            className="bg-sageuk-gold text-sageuk-bg px-8 py-3 rounded-lg text-lg font-bold hover:bg-yellow-500 transition-colors"
          >
            입장하기
          </button>
        </div>
      )}

      {step === 'location' && geo.status === 'loading' && (
        <div className="text-center space-y-4">
          <p className="text-sageuk-gold text-lg">마님이 위치를 파악하고 계십니다...</p>
          <div className="animate-spin text-4xl">🔍</div>
        </div>
      )}

      {step === 'location' && geo.status === 'denied' && (
        <AddressInput onLocationSet={(lat, lng) => {
          geo.setManualLocation(lat, lng)
          setStep('condition')
        }} />
      )}

      {step === 'condition' && (
        <ConditionForm onSubmit={handleConditionSubmit} />
      )}
    </main>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/page.tsx
git commit -m "메인 페이지 구현 — useEffect로 위치 상태 감지 + 조건 설정 플로우"
```

---

### Task 11: 추천 페이지 (대화형 + 지도 탐색)

**Files:**
- Create: `src/app/recommend/page.tsx`

- [ ] **Step 1: 추천 페이지 구현**

```tsx
// src/app/recommend/page.tsx
'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useRecommendation } from '@/hooks/useRecommendation'
import DialogueBox from '@/components/DialogueBox'
import RiceBowlGauge from '@/components/RiceBowlGauge'
import MapView from '@/components/MapView'

function RecommendContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { state, loading, apiError, fetchRecommendation, accept, reject, selectOnMap, forcePick, reset } = useRecommendation()

  const lat = parseFloat(searchParams.get('lat') || '0')
  const lng = parseFloat(searchParams.get('lng') || '0')
  const headcount = parseInt(searchParams.get('headcount') || '1')
  const categories = (searchParams.get('categories') || '').split(',').filter(Boolean)

  // 첫 추천 요청
  useEffect(() => {
    if (lat && lng && categories.length > 0) {
      fetchRecommendation(lat, lng, categories, headcount)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleReject = () => reject(lat, lng)

  const handleRestart = () => {
    reset()
    router.push('/')
  }

  const handleRetry = () => {
    fetchRecommendation(lat, lng, categories, headcount, state.rejectedIds)
  }

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto space-y-4">
      {/* 상단: 쌀밥 게이지 */}
      <RiceBowlGauge rejectionCount={state.rejectionCount} />

      {/* 쌀밥 박탈 경고 */}
      {state.mode === 'map' && (
        <div className="bg-sageuk-card border border-sageuk-danger rounded-lg p-2 text-center">
          <span className="text-sageuk-danger text-sm font-bold animate-pulse">
            쌀밥 박탈! 네 놈이 직접 골라봐라
          </span>
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="text-center py-8">
          <p className="text-sageuk-gold animate-pulse">마님이 고심 중이시니라...</p>
        </div>
      )}

      {/* 대화형 모드 */}
      {!loading && state.mode === 'dialogue' && (
        <DialogueBox
          dialogues={state.dialogues}
          currentRestaurant={state.currentRestaurant}
          onAccept={accept}
          onReject={handleReject}
          isMapMode={false}
        />
      )}

      {/* API 에러 시 재시도 버튼 */}
      {apiError && !loading && (
        <button
          onClick={handleRetry}
          className="w-full bg-sageuk-card border border-sageuk-gold text-sageuk-gold py-3 rounded-lg font-bold hover:bg-sageuk-gold hover:text-sageuk-bg transition-colors"
        >
          다시 여쭙기
        </button>
      )}

      {/* 지도 탐색 모드 */}
      {state.mode === 'map' && (
        <>
          <MapView
            lat={lat}
            lng={lng}
            restaurants={state.restaurants}
            onPinClick={selectOnMap}
          />
          <DialogueBox
            dialogues={state.dialogues.slice(-3)}
            currentRestaurant={state.currentRestaurant}
            onAccept={accept}
            onReject={handleReject}
            isMapMode={true}
          />
          {/* 지도에서 선택한 음식점 확정 버튼 */}
          {state.currentRestaurant && (
            <div className="space-y-2">
              <div className="bg-sageuk-card border border-sageuk-gold rounded-lg p-3">
                <div className="font-bold text-sageuk-gold">{state.currentRestaurant.name}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {state.currentRestaurant.category} · {state.currentRestaurant.distance}m
                </div>
              </div>
              <button
                onClick={accept}
                className="w-full bg-sageuk-gold text-sageuk-bg py-3 rounded-lg font-bold"
              >
                {state.currentRestaurant.name}(으)로 가겠습니다
              </button>
            </div>
          )}
        </>
      )}

      {/* 수락 완료 화면 */}
      {(state.mode === 'accepted' || state.mode === 'forcePick') && state.currentRestaurant && (
        <div className="space-y-4">
          <div className="bg-sageuk-card border-2 border-sageuk-gold rounded-lg p-4 text-center">
            <div className="text-sageuk-gold text-lg font-bold mb-2">
              {state.mode === 'forcePick' ? '🍚 마님이 쌀밥을 내리셨습니다' : '오늘의 점심이 정해졌습니다'}
            </div>
            <div className="text-2xl font-bold text-white mb-2">{state.currentRestaurant.name}</div>
            <div className="text-sm text-gray-400">
              {state.currentRestaurant.category} · {state.currentRestaurant.distance}m
            </div>
            {state.currentRestaurant.address && (
              <div className="text-xs text-gray-500 mt-1">{state.currentRestaurant.address}</div>
            )}
          </div>
          <MapView
            lat={state.currentRestaurant.lat}
            lng={state.currentRestaurant.lng}
            restaurants={[state.currentRestaurant]}
            onPinClick={() => {}}
          />
        </div>
      )}

      {/* 지도 모드에서 "쌀밥을 주시옵소서" 버튼 */}
      {state.mode === 'map' && (
        <button
          onClick={() => forcePick(lat, lng)}
          className="w-full bg-sageuk-card border border-gray-600 text-gray-400 py-2 rounded-lg text-sm hover:border-sageuk-gold hover:text-sageuk-gold transition-colors"
        >
          쌀밥을 주시옵소서... (마님이 골라줌)
        </button>
      )}

      {/* 다시 하기 */}
      <button
        onClick={handleRestart}
        className="w-full text-gray-500 text-sm py-2 hover:text-gray-300"
      >
        처음부터 다시
      </button>
    </main>
  )
}

/** 추천 페이지 — useSearchParams를 Suspense로 감싸야 함 */
export default function RecommendPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sageuk-gold">마님을 모시는 중...</div>}>
      <RecommendContent />
    </Suspense>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/recommend/page.tsx
git commit -m "추천 페이지 구현 — 대화형 턴제 + 지도 탐색 + 재시도 버튼"
```

---

### Task 12: 레이아웃 + 글로벌 스타일 마무리

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: layout.tsx 완성**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Nanum_Myeongjo } from 'next/font/google'
import './globals.css'

const nanumMyeongjo = Nanum_Myeongjo({
  weight: ['400', '700', '800'],
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: '왜 마님은 돌쇠에게 쌀밥을 주었을까',
  description: '사극 세계관 직장인 점심 추천 서비스',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={nanumMyeongjo.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: globals.css 사극 테마 적용**

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #1a1a2e;
  color: #e0e0e0;
  min-height: 100vh;
}

/* 스크롤바 사극풍 */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: #1a1a2e;
}
::-webkit-scrollbar-thumb {
  background: #ffd700;
  border-radius: 3px;
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "레이아웃 + 글로벌 스타일 마무리 — 사극 테마 완성"
```

---

### Task 13: 픽셀아트 캐릭터 플레이스홀더 + 최종 점검

**Files:**
- Create: `public/characters/` (플레이스홀더 이미지)

- [ ] **Step 1: 캐릭터 이미지 디렉토리 생성**

```bash
mkdir -p public/characters
```

플레이스홀더로 간단한 SVG 또는 이모지 기반 이미지 생성. 실제 "아이탈출" 스타일 픽셀아트는 별도 제작 필요. DialogueBox에 이모지 fallback이 있으므로 이미지 없이도 동작.

- [ ] **Step 2: 전체 빌드 확인**

```bash
npm run build
```

Expected: 빌드 성공, 에러 없음

- [ ] **Step 3: 개발 서버에서 전체 플로우 확인**

```bash
npm run dev
```

확인 사항:
1. 랜딩 페이지 → "입장하기" 클릭
2. 위치 허용 → 조건 설정 화면 표시
3. 위치 거부 → 주소 입력 → 검색 → 조건 설정 화면
4. 카테고리 선택 → "마님께 여쭙기" → 추천 화면
5. 수락/거절 인터랙션 동작
6. 3회 거절 → 지도 모드 전환
7. 지도에서 핀 클릭 → 마님 코멘트 → 확정

- [ ] **Step 4: 최종 커밋**

```bash
git add public/characters src/
git commit -m "픽셀아트 플레이스홀더 + 전체 플로우 연결 완료 — MVP v1"
```
