/**
 * Role: 위치 허용 거부 시 수동 주소 입력 fallback UI
 * Key Features: /api/geocode 호출로 주소→좌표 변환, 엔터키 지원, 에러 메시지
 * Dependencies: react
 */
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
