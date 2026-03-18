/**
 * Role: 위치/인원/카테고리 조건 설정 폼 — Toss Feed 라이트 스타일
 * Key Features: 위치 텍스트 입력, 인원 증감, 카테고리 토글
 * Dependencies: react
 */
'use client'

import { useState } from 'react'

interface Props {
  onSubmit: (location: string, headcount: number, categories: string[]) => void
  isLoading?: boolean
}

const CATEGORIES = ['한식', '중식', '일식', '양식', '분식']

export default function ConditionForm({ onSubmit, isLoading }: Props) {
  const [location, setLocation] = useState('')
  const [headcount, setHeadcount] = useState(1)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const handleSubmit = () => {
    if (!location.trim() || isLoading) return
    const cats = selectedCategories.length > 0 ? selectedCategories : CATEGORIES
    onSubmit(location.trim(), headcount, cats)
  }

  return (
    <div className="space-y-6">
      {/* 위치 */}
      <div>
        <label className="block text-[13px] font-semibold text-tf-text-sub mb-2">위치</label>
        <input
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="예: 강남역, 홍대입구, 판교역"
          className="w-full rounded-xl px-4 py-3 text-[15px] text-tf-text placeholder:text-tf-text-hint outline-none transition-all"
          style={{ background: '#f7f8fa', border: '1.5px solid #e5e8eb' }}
          onFocus={e => (e.target.style.borderColor = '#3182f6')}
          onBlur={e => (e.target.style.borderColor = '#e5e8eb')}
        />
      </div>

      {/* 인원 */}
      <div>
        <label className="block text-[13px] font-semibold text-tf-text-sub mb-2">인원</label>
        <div className="flex items-center gap-4 rounded-xl px-4 py-3"
          style={{ background: '#f7f8fa', border: '1.5px solid #e5e8eb' }}>
          <button
            onClick={() => setHeadcount(Math.max(1, headcount - 1))}
            className="w-8 h-8 rounded-lg text-tf-text-sub font-bold text-lg active:scale-90 transition-all flex items-center justify-center"
            style={{ background: '#e5e8eb' }}
          >−</button>
          <span className="flex-1 text-center text-[16px] font-bold text-tf-text">{headcount}명</span>
          <button
            onClick={() => setHeadcount(Math.min(10, headcount + 1))}
            className="w-8 h-8 rounded-lg text-tf-text-sub font-bold text-lg active:scale-90 transition-all flex items-center justify-center"
            style={{ background: '#e5e8eb' }}
          >+</button>
        </div>
      </div>

      {/* 카테고리 */}
      <div>
        <label className="block text-[13px] font-semibold text-tf-text-sub mb-2">
          음식 종류 <span className="text-tf-text-hint font-normal">(미선택 시 전체)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold active:scale-95 transition-all duration-150"
              style={selectedCategories.includes(cat)
                ? { background: '#3182f6', color: '#fff', border: '1.5px solid #3182f6' }
                : { background: '#f7f8fa', color: '#6b7684', border: '1.5px solid #e5e8eb' }
              }
            >{cat}</button>
          ))}
        </div>
      </div>

      {/* 제출 */}
      <button
        onClick={handleSubmit}
        disabled={!location.trim() || isLoading}
        className="w-full py-4 rounded-xl text-[15px] font-bold active:scale-[0.98] transition-all duration-200 disabled:opacity-40"
        style={{ background: '#191f28', color: '#ffffff' }}
      >
        {isLoading
          ? <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              맛집 찾는 중...
            </span>
          : '마님께 여쭙기'}
      </button>
    </div>
  )
}
