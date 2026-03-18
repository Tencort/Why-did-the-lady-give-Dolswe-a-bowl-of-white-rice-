/**
 * Role: 브라우저 위치 정보 요청 및 수동 위치 설정 훅
 * Key Features: 위치 허용/거부 상태 관리, 수동 주소 입력 지원, 실패 시 기본 위치(문정역) 사용
 * Dependencies: react
 */
'use client'

import { useState, useCallback } from 'react'

interface GeolocationState {
  lat: number | null
  lng: number | null
  status: 'idle' | 'loading' | 'granted' | 'denied' | 'error'
  error: string | null
}

// 위치 획득 실패 시 기본값 — 서울특별시 문정역
const DEFAULT_LOCATION = { lat: 37.4924, lng: 127.1238 }

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    lat: null, lng: null, status: 'idle', error: null,
  })

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      // 위치 서비스 미지원 — 기본 위치로 fallback
      setState({
        ...DEFAULT_LOCATION,
        status: 'granted',
        error: null,
      })
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
        // 위치 거부 또는 타임아웃 — 기본 위치(문정역)로 fallback
        setState({
          ...DEFAULT_LOCATION,
          status: 'granted',
          error: null,
        })
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
