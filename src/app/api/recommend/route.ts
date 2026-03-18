/**
 * Role: 네이버 Local Search API로 음식점 추천 — 병렬 다중 페이지 요청으로 풍부한 결과 확보
 * Key Features: 카테고리별 2페이지 병렬 요청, Haversine 반경 필터(1.5km), 중복 제거, 랜덤 픽
 * Dependencies: next/server, NAVER_LOCAL_CLIENT_ID, NAVER_LOCAL_CLIENT_SECRET 환경변수
 */
import { NextRequest, NextResponse } from 'next/server'
import type { ReviewItem } from '@/types'

// ─── 가짜 리뷰 풀 ───────────────────────────────────────────────
const REVIEW_POOL: Record<string, string[]> = {
  한식: [
    '진짜 집밥 같은 맛이에요. 반찬도 넉넉하게 주셔서 좋았어요.',
    '된장찌개가 정말 깊은 맛이 나더라고요. 또 오고 싶어요.',
    '가격 대비 양이 많아서 만족스러웠습니다.',
    '사장님이 친절하셔서 기분 좋게 먹고 왔어요.',
    '밥이 찰지고 맛있었어요. 반찬이 계속 나와서 배불리 먹었네요.',
    '국물 맛이 진해서 해장하기 딱 좋았어요.',
    '점심 특선이 합리적이에요. 직장인들이 많이 찾더라고요.',
  ],
  중식: [
    '짜장면이 진짜 맛있어요. 면이 쫄깃하고 소스가 풍부해요.',
    '짬뽕 국물이 시원하고 칼칼해요. 자주 올 것 같아요.',
    '탕수육 소스가 특제인지 다른 데랑 달라요. 강추!',
    '배달도 되는데 방문하면 훨씬 맛있어요.',
    '직화 볶음밥이 불향이 살아있어서 맛있어요.',
    '코스 요리 가성비 대박이에요.',
  ],
  일식: [
    '연어가 신선해서 회 떠놓은 게 달라요.',
    '돈까스가 두꺼운데도 부드러워요. 소스도 맛있고요.',
    '라멘 국물이 진해서 취향저격이에요.',
    '초밥 하나하나가 정성스럽게 만들어져 있어요.',
    '사시미 신선도가 확실히 보장되는 곳이에요.',
  ],
  양식: [
    '파스타가 면 삶기를 딱 알맞게 해줘서 좋아요.',
    '스테이크 굽기 요청을 정확히 해줘서 감동이에요.',
    '분위기도 좋고 음식도 맛있어서 데이트 코스로 추천해요.',
    '크림 리조또가 진해서 한 그릇 다 먹었어요.',
    '피자 도우가 얇고 바삭해서 좋았어요.',
  ],
  분식: [
    '떡볶이 매운 정도를 조절해줘서 좋아요.',
    '김밥 재료가 신선하고 꽉 차있어요. 최고!',
    '순대국이 저렴한데 양이 어마어마해요.',
    '라볶이 국물이 진해서 계속 생각나요.',
    '튀김이 갓 튀겨서 바삭바삭해요.',
  ],
  카페: [
    '아메리카노가 진하고 맛있어요. 원두 퀄리티가 느껴져요.',
    '케이크가 달지 않아서 커피랑 잘 어울려요.',
    '조용하고 아늑해서 일하기 좋은 카페예요.',
    '라떼 아트가 예뻐서 사진 찍고 싶어지는 곳이에요.',
  ],
  default: [
    '음식이 맛있고 서비스가 친절해요.',
    '가격 대비 만족스러운 곳이에요.',
    '깨끗하고 위생적인 환경이 마음에 들었어요.',
    '또 오고 싶은 식당이에요.',
    '밥 먹고 나서 기분이 좋아지는 곳이에요.',
    '직원들이 친절하고 음식이 빨리 나와요.',
  ],
}

// ─── 마님의 추천 포인트 풀 — 사극 말투 결정론적 코멘트 ───────────────
const MANIM_COMMENT_POOL: Record<string, string[]> = {
  한식: [
    '이곳 국물 맛은 임금님 수라상에 올려도 손색없을 듯 하오이다.',
    '밥 한 그릇으로 기운을 차리기에 이보다 나은 곳은 없사옵니다.',
    '반찬 인심이 후하여 돌쇠도 배불리 먹을 수 있을 것이오.',
    '된장 향이 고향 마을 부엌 냄새 같아 정겹사옵니다.',
    '점심 특선이 마련되어 있어 주머니 사정도 걱정 없을 것이오.',
  ],
  중식: [
    '짜장 소스의 깊이가 예사롭지 않사옵니다. 분명 비법이 있을 것이오.',
    '면발의 쫄깃함이 마님 심기를 유쾌하게 하는구나.',
    '탕수육 한 점에 세상 시름을 잊을 수 있을 것이오.',
    '불향이 살아있어 궁중 연회에서도 통할 솜씨로소이다.',
  ],
  일식: [
    '신선도가 으뜸이라 바다를 그대로 담아온 듯 하오이다.',
    '칼솜씨가 번뜩여 장인의 경지에 이르렀음이 분명하오.',
    '국물 한 모금에 피로가 싹 가시니 신묘한 맛이로다.',
    '정갈한 상차림이 마님의 눈을 즐겁게 하는구나.',
  ],
  양식: [
    '멀리 이국에서 건너온 맛이나 결코 낯설지 않사옵니다.',
    '고기 굽기를 정확히 맞추니 기술이 대단하오이다.',
    '분위기가 고아하여 귀한 손님 모시기에 적합하겠소.',
    '크림 소스의 농도가 딱 알맞아 마님도 탐이 나는구나.',
  ],
  분식: [
    '매운 것을 즐기는 돌쇠에게 안성맞춤일 것이오.',
    '빠르고 든든하니 바쁜 점심 시간에 제격이로다.',
    '저렴한 값에 배불리 먹을 수 있으니 현명한 선택이오.',
    '갓 튀겨낸 바삭함이 사람의 마음을 사로잡는구나.',
  ],
  카페: [
    '차 한 잔으로 지친 심신을 달래기에 더없이 좋은 곳이오.',
    '원두 향이 진하여 마음이 절로 안정되는구나.',
    '조용하고 아늑하여 잠시 쉬어가기에 제격이오.',
    '달콤한 것들이 많아 마님도 모처럼 흡족하겠구나.',
  ],
  치킨: [
    '바삭한 튀김옷이 손을 멈출 수 없게 만드는구나.',
    '양념 맛이 일품이라 마님도 한 점 탐이 날 지경이오.',
    '맥주와 함께하면 세상 부러울 게 없을 것이오.',
  ],
  default: [
    '마님이 직접 맛을 보고 엄선한 곳이오이다.',
    '이곳은 허투루 추천하는 법이 없는 마님이 인정한 곳이오.',
    '한번 가면 발길이 자연스레 다시 향하게 되는 곳이로다.',
    '주변에 소문이 자자하니 맛은 이미 검증되었다 할 것이오.',
    '정성이 담긴 음식을 내어주니 고마운 곳이로다.',
  ],
}

/** 마님 추천 코멘트 — restaurantId 해시 기반 결정론적 선택 */
function generateManimComment(restaurantId: string, category: string): string {
  let hash = 0
  for (let i = 0; i < restaurantId.length; i++) {
    hash = ((hash << 5) - hash) + restaurantId.charCodeAt(i)
    hash |= 0
  }
  const h = Math.abs(hash)
  const pool = MANIM_COMMENT_POOL[category] ?? MANIM_COMMENT_POOL.default
  return pool[(h + 13) % pool.length]
}

const NICKNAMES = [
  '맛집탐방러', '점심왕', '직장인A', '먹스타그램', '배고픈직장인',
  '런치타임', '식도락가', '동네맛집박사', '맛집헌터', '점심고수',
  '배부른돼지', '오늘도점심', '맛집순례자', '직장인밥상', '런치퀸',
]

/** 가짜 리뷰 생성 — restaurantId 기반 결정론적 선택 */
function generateFakeReviews(restaurantId: string, category: string): ReviewItem[] {
  // 단순 해시 — 같은 restaurantId는 항상 같은 리뷰 생성
  let hash = 0
  for (let i = 0; i < restaurantId.length; i++) {
    hash = ((hash << 5) - hash) + restaurantId.charCodeAt(i)
    hash |= 0
  }
  const h = Math.abs(hash)
  const pool = REVIEW_POOL[category] ?? REVIEW_POOL.default
  const count = 2 + (h % 2)  // 2~3개
  const reviews: ReviewItem[] = []
  for (let i = 0; i < count; i++) {
    reviews.push({
      nickname: NICKNAMES[(h + i * 7) % NICKNAMES.length],
      text: pool[(h + i * 3) % pool.length],
      rating: 4 + ((h + i) % 2),  // 4~5점
    })
  }
  return reviews
}

const NAVER_CLIENT_ID = process.env.NAVER_LOCAL_CLIENT_ID
const NAVER_CLIENT_SECRET = process.env.NAVER_LOCAL_CLIENT_SECRET

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

/** 단일 Naver Local Search 요청 */
async function naverSearch(query: string, start: number, lng: number, lat: number): Promise<any[]> {
  const params = new URLSearchParams({
    query,
    display: '30',      // 한 번에 최대 30개
    start: String(start),
    sort: 'comment',    // 리뷰 많은 순 — 실제 영업 중인 곳 우선
    coordinate: `${lng},${lat}`,
  })

  try {
    const res = await fetch(`https://openapi.naver.com/v1/search/local.json?${params}`, {
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID!,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET!,
      },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.items || []
  } catch {
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lat, lng, categories, rejectedIds, locationName, radius } = await request.json()
    // 뷰포트 기반 반경 — 기본 1500m, 최대 5000m
    const searchRadius: number = Math.min(Math.max(Number(radius) || 1500, 100), 5000)

    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      return NextResponse.json({ error: '네이버 API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: '유효한 위치 정보가 없습니다.' }, { status: 400 })
    }

    // 요청 배치 구성 — 카테고리별 1페이지 + 일반 검색 3종 2페이지
    // 카테고리가 많을수록 요청 수 증가 → 카테고리는 1페이지, 일반 검색에서 2페이지로 결과 보완
    const batches: Array<{ query: string; start: number }> = []
    const loc = locationName || ''

    for (const category of categories) {
      const query = loc ? `${loc} ${category}` : category
      batches.push({ query, start: 1 })
    }

    // 일반 검색 2페이지 — 카테고리 단일 요청의 결과 보완
    const generalQueries = loc
      ? [`${loc} 맛집`, `${loc} 음식점`, `${loc} 식당`]
      : ['맛집', '음식점', '식당']

    for (const gq of generalQueries) {
      batches.push({ query: gq, start: 1 })
      batches.push({ query: gq, start: 31 })
    }

    // 모든 요청 병렬 실행 — 빠른 응답 + 최대 결과 수
    const results = await Promise.all(
      batches.map(({ query, start }) => naverSearch(query, start, lng, lat))
    )
    const allItems = results.flat()

    if (allItems.length === 0) {
      return NextResponse.json(
        { error: '네이버 API 호출에 실패했습니다. Client ID/Secret을 확인해주세요.' },
        { status: 502 }
      )
    }

    // 좌표 변환 + 반경 1.5km 필터 + 중복 제거 + 거절 목록 제외
    const uniqueMap = new Map()
    for (const item of allItems) {
      const itemLng = parseInt(item.mapx) / 1e7
      const itemLat = parseInt(item.mapy) / 1e7

      if (!itemLat || !itemLng || isNaN(itemLat) || isNaN(itemLng)) continue

      const distance = Math.round(haversineDistance(lat, lng, itemLat, itemLng))
      if (distance > searchRadius) continue

      const id = item.link || `${itemLat.toFixed(6)},${itemLng.toFixed(6)}`
      const name = stripHtml(item.title)

      // 음식점 카테고리만 포함 — Naver category 필드로 음식점 판별
      const rawCategory: string = item.category || ''
      const isFoodPlace = rawCategory.includes('음식') || rawCategory.includes('식당') ||
        rawCategory.includes('한식') || rawCategory.includes('중식') ||
        rawCategory.includes('일식') || rawCategory.includes('양식') ||
        rawCategory.includes('분식') || rawCategory.includes('카페') ||
        rawCategory.includes('패스트푸드') || rawCategory.includes('치킨') ||
        rawCategory.includes('피자') || rawCategory.includes('스테이크') ||
        rawCategory.includes('뷔페') || rawCategory.includes('브런치') ||
        rawCategory.includes('아시안') || rawCategory.includes('베트남') ||
        rawCategory.includes('태국') || rawCategory.includes('인도')

      if (!isFoodPlace) continue
      if (rejectedIds?.includes(id)) continue
      if (uniqueMap.has(id)) continue

      // Naver 카테고리에서 주요 분류 추출 (예: "음식점>한식>해장국" → "한식")
      const categoryParts = rawCategory.split('>')
      const displayCategory = categoryParts.length >= 2
        ? categoryParts[1].trim()
        : categoryParts[0].trim() || '음식점'

      uniqueMap.set(id, {
        id,
        name,
        category: displayCategory,
        distance,
        lat: itemLat,
        lng: itemLng,
        address: item.roadAddress || item.address,
        phone: item.telephone || undefined,
        naverUrl: item.link || undefined,
        reviews: generateFakeReviews(id, displayCategory),
        manimComment: generateManimComment(id, displayCategory),
      })
    }

    const restaurants = Array.from(uniqueMap.values())
      .sort((a, b) => a.distance - b.distance)  // 가까운 순 정렬

    if (restaurants.length === 0) {
      return NextResponse.json({ restaurants: [], picked: null, totalAvailable: 0 })
    }

    const picked = restaurants[Math.floor(Math.random() * restaurants.length)]
    return NextResponse.json({ restaurants, picked, totalAvailable: restaurants.length })
  } catch {
    return NextResponse.json({ error: '음식점 검색 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
