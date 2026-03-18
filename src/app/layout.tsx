/**
 * Role: 루트 레이아웃 — 나눔명조 폰트, 사극 다크 테마 적용
 * Key Features: Nanum Myeongjo 폰트(CSS import), 메타데이터 설정
 * Dependencies: globals.css
 */
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '왜 마님은 돌쇠에게 쌀밥을 주었을까',
  description: '사극 세계관 직장인 맛집 추천 서비스',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
