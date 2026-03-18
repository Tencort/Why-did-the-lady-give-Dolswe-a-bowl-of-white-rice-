/**
 * Role: 상황별 대사 생성 API — 대사 풀에서 랜덤 선택 후 플레이스홀더 치환
 * Key Features: recommend/excuse/rejection/mapComment/headcount/noResult/apiError 타입 지원
 * Dependencies: next/server, @/data/dialogues
 */
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
  const { type, restaurantName, category, rejectionLevel, distance, walkMin, headcount, recommendedCategory } = await request.json()

  switch (type) {
    case 'recommend': {
      const template = pickRandom(MANIM_RECOMMEND)
      const text = fillTemplate(template, {
        name: restaurantName,
        category,
        distance: String(distance ?? ''),
        walkMin: String(walkMin ?? Math.ceil((distance ?? 0) / 80)),
      })
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
