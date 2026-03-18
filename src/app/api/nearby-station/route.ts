/**
 * Role: GPS 좌표 → 가장 가까운 지하철역명 반환
 * Key Features: Naver Local Search "지하철역" 쿼리, 좌표 기반 nearest 1개 반환
 * Dependencies: next/server, NAVER_LOCAL_CLIENT_ID, NAVER_LOCAL_CLIENT_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'

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

export async function POST(request: NextRequest) {
  try {
    const { lat, lng } = await request.json()
    if (!lat || !lng) return NextResponse.json({ stationName: null }, { status: 400 })
    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return NextResponse.json({ stationName: null }, { status: 500 })

    const params = new URLSearchParams({
      query: '지하철역',
      display: '5',
      sort: 'random',
      coordinate: `${lng},${lat}`,
    })

    const res = await fetch(`https://openapi.naver.com/v1/search/local.json?${params}`, {
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
    })

    if (!res.ok) return NextResponse.json({ stationName: null })
    const data = await res.json()
    if (!data.items || data.items.length === 0) return NextResponse.json({ stationName: null })

    // 가장 가까운 역 선택
    let nearest = data.items[0]
    let minDist = Infinity
    for (const item of data.items) {
      const iLat = parseInt(item.mapy) / 1e7
      const iLng = parseInt(item.mapx) / 1e7
      const d = haversineDistance(lat, lng, iLat, iLng)
      if (d < minDist) { minDist = d; nearest = item }
    }

    // HTML 태그 제거 + "역" 포함 이름 정리 (예: "문정역" 또는 "문정")
    const raw = nearest.title.replace(/<[^>]*>/g, '').trim()
    const stationName = raw.endsWith('역') ? raw : raw + '역'

    return NextResponse.json({ stationName })
  } catch {
    return NextResponse.json({ stationName: null })
  }
}
