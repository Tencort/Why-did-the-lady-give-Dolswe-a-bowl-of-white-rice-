/**
 * Role: 장소명/주소 → 위도/경도 좌표 변환 API
 * Key Features: 네이버 Local Search로 키워드 검색 후 첫 결과 좌표 반환
 * Dependencies: next/server, NAVER_LOCAL_CLIENT_ID, NAVER_LOCAL_CLIENT_SECRET 환경변수
 */
import { NextRequest, NextResponse } from 'next/server'

const NAVER_CLIENT_ID = process.env.NAVER_LOCAL_CLIENT_ID
const NAVER_CLIENT_SECRET = process.env.NAVER_LOCAL_CLIENT_SECRET

/** 장소명 → 좌표 변환 (예: "강남역" → { lat, lng }) */
export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      return NextResponse.json({ error: '네이버 API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    if (!query?.trim()) {
      return NextResponse.json({ error: '검색어를 입력해주세요.' }, { status: 400 })
    }

    const params = new URLSearchParams({ query: query.trim(), display: '1' })
    const response = await fetch(`https://openapi.naver.com/v1/search/local.json?${params}`, {
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: '장소 검색에 실패했습니다.' }, { status: 502 })
    }

    const data = await response.json()
    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ error: '검색 결과가 없습니다.' }, { status: 404 })
    }

    const item = data.items[0]
    const lat = parseInt(item.mapy) / 1e7
    const lng = parseInt(item.mapx) / 1e7
    const name = item.title.replace(/<[^>]*>/g, '')

    return NextResponse.json({ lat, lng, name })
  } catch {
    return NextResponse.json({ error: '좌표 변환 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
