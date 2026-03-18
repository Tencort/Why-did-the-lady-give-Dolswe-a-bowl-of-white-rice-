# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

"왜 마님은 돌쇠에게 쌀밥을 주었을까" — 사극 세계관 기반 직장인 점심 추천 웹서비스. 마님(시스템)이 음식점을 추천하고, 돌쇠(사용자)가 수락/거절하는 턴제 인터랙션. 4회 거절 시 "쌀밥 강제 지급" 후 forcePick 모드 전환.

## 개발 명령어

```bash
npm run dev      # 개발 서버 (localhost:3000, 이미 실행 중이면 3001)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npx tsc --noEmit # 타입 체크만 (빌드 없이)
```

## 환경변수

`.env.local` 필요:
```
NAVER_LOCAL_CLIENT_ID=      # 네이버 Local Search API 클라이언트 ID
NAVER_LOCAL_CLIENT_SECRET=  # 네이버 Local Search API 시크릿
```
카카오맵은 제거됨. 지도 렌더링은 **Leaflet.js CDN** (API 키 불필요), 장소 검색은 **Naver Local Search API** 사용.

## 기술 스택

- Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS v4
- Leaflet.js (CDN 동적 로드) + CartoDB Voyager 타일
- Naver Local Search API (서버사이드 `/api/recommend`)
- framer-motion (애니메이션), localStorage (위치·이력 저장), DB 없음

## 아키텍처

### 상태 머신 (`RecommendMode`)
```
dialogue → (4회 거절) → forcePick
         → (선택지 소진) → map → forcePick | accepted
         → (소거법 시작) → elimination → forcePick | accepted
accepted (종료)
forcePick (종료)
```

### 핵심 데이터 흐름
1. GPS 획득 → `/api/nearby-station`으로 가장 가까운 역명 조회 → locationName 설정
2. `fetchRecommendation()` → `/api/recommend` (Naver 병렬 검색) → `state.restaurants` 세팅
3. 지도 뷰포트 변경 시 `refreshRestaurants()` (900ms 디바운스) → 기존 목록과 병합 (덮어쓰지 않음)
4. 수락/거절 이력 → `localStorage(manim_user_history)` → `detectPattern()` → 마님 행동 첨언

### API Routes (`src/app/api/`)
- `/api/recommend` — Naver Local Search 병렬 배치 요청 → Haversine 반경 필터 → 가짜 리뷰 첨부 → 랜덤 픽
- `/api/dialogue` — 상황별 대사 생성 (recommend, excuse, rejection 1~4, mapComment, headcount, noResult)
- `/api/geocode` — 장소명 → 좌표 변환
- `/api/nearby-station` — GPS 좌표 → 가장 가까운 지하철역명 반환

### 주요 파일
| 파일 | 역할 |
|------|------|
| `src/app/page.tsx` | 메인 페이지. GPS 흐름, 레이아웃, 모달, EliminationPanel, RiceSlapTitle |
| `src/hooks/useRecommendation.ts` | 전체 추천 상태 관리. stale closure 방지용 `stateRef` 패턴 사용 |
| `src/components/MapView.tsx` | Leaflet 지도. SVG 테어드롭 핀 + CSS hover 툴팁 (`injectPinStyles`) |
| `src/components/RiceBowlGauge.tsx` | 쌀밥 잔여량 게이지 (🍚 × 4) |
| `src/data/dialogues.ts` | 모든 대사 풀. 플레이스홀더(`{name}`, `{category}` 등) 사용 |
| `src/data/userHistory.ts` | 선택 이력 localStorage 관리 + 6종 행동 패턴 감지 |
| `src/types/index.ts` | 전체 타입 정의 (`Restaurant`, `RecommendState`, `ReviewItem` 등) |

## 중요 설계 결정

**`refreshRestaurants` 병합 전략**: 뷰포트 변경 시 기존 `state.restaurants`를 덮어쓰지 않고 신규 결과와 병합(중복 제거). 확대 시 핀이 사라지는 문제 방지. 최소 반경은 1500m 보장.

**소거법 (`elimination`) 플로우**: `eliminationStep` 1~5 진행. `rePickCount` 3회 초과 시 `ELIMINATION_FORCE` 대사로 강제 종료. `eliminationAnswer()` 호출마다 `currentRestaurant` 갱신 (즉시 제안).

**RejectionLevel**: `0 | 1 | 2 | 3 | 4`. 4단계에서 강제 forcePick. 3단계까지는 계속 dialogue 모드 유지.

**대사 시스템**: `/api/dialogue`가 대사를 생성하지만 일부(소거법, 에러, 행동 패턴)는 `dialogues.ts` 풀에서 클라이언트 직접 선택. `MANIM_BEHAVIOR_COMMENT`는 `accept()` 후 패턴 감지 시 자동 첨언.

**가짜 리뷰**: `restaurantId` 해시 기반 결정론적 생성 — 같은 식당은 항상 같은 리뷰. `generateFakeReviews()` in `/api/recommend/route.ts`.

## 디자인 시스템

- 포인트 컬러: Toss Feed 블루 `#3182f6`, 라이트 `#ebf3fe`, 보더 `#c9dffe`
- 텍스트: `#191f28` (본문), `#6b7684` (서브), `#b0b8c1` (힌트)
- UI 텍스트: 사극 말투 ("감사히 받겠습니다", "사양하겠습니다", "다른 것도 있사옵니까")
- 지도: CartoDB Voyager + `filter: saturate(0.55)` (채도 조절)
- 캐릭터 이미지: `public/characters/` — `manim_sticker_*.png`, `event_*.png`, `profile_*.png`

## 검색 카테고리

`DEFAULT_CATEGORIES` (page.tsx): 한식·중식·일식·양식·분식·카페·치킨·피자·패스트푸드·고기·해산물·술집·베이커리·아시안·브런치·뷔페 (16종)

Naver API 배치 전략: 카테고리 16개 × 1페이지 + 일반 검색 3종 × 2페이지 = 22개 병렬 요청
