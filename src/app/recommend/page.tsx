/**
 * Role: 추천 페이지 — 대화형 턴제 + 지도 탐색 + 수락 완료 화면
 * Key Features: Suspense로 useSearchParams 감싸기, 재시도 버튼, 강제 선택(쌀밥)
 * Dependencies: useRecommendation, DialogueBox, RiceBowlGauge, MapView
 */
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
              {state.mode === 'forcePick' ? '🍚 마님이 쌀밥을 내리셨습니다' : '오늘의 맛집이 정해졌습니다'}
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center text-sageuk-gold">
        마님을 모시는 중...
      </div>
    }>
      <RecommendContent />
    </Suspense>
  )
}
