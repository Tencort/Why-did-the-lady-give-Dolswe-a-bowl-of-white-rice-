/**
 * Role: Leaflet + CartoDB Positron 지도 렌더링 + SVG 핀 + 호버 툴팁
 * Key Features: API 키 불필요, SVG 테어드롭 핀, 호버 시 상세 툴팁 확대, 선택 핀 블루 강조
 * Dependencies: react, @/types, Leaflet CDN
 */
'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Restaurant } from '@/types'

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
  radiusM: number
}

/** 현재 뷰포트의 중심 기준 반경(m) 계산 — 위/경도 차이 중 더 큰 값을 사용하되 최대 5km 제한 */
function calcViewportRadius(map: any): number {
  const bounds = map.getBounds()
  const center = map.getCenter()
  const R = 6371000
  const northLat = bounds.getNorth() * Math.PI / 180
  const centerLat = center.lat * Math.PI / 180
  const latDiff = (bounds.getNorth() - center.lat) * Math.PI / 180
  const latR = latDiff * R
  const lngDiff = (bounds.getEast() - center.lng) * Math.PI / 180
  const lngR = lngDiff * R * Math.cos(centerLat)
  // northLat은 bounds 계산에 사용하지 않지만 향후 확장성을 위해 선언 유지
  void northLat
  return Math.min(Math.round(Math.max(latR, lngR)), 5000)
}

interface Props {
  lat: number
  lng: number
  restaurants: Restaurant[]
  onPinClick: (restaurant: Restaurant) => void
  onBoundsChange?: (bounds: MapBounds) => void
  mapClassName?: string
  selectedId?: string
}

/** SVG 테어드롭 핀 + 호버 툴팁 HTML 생성 */
function buildPinHtml(r: Restaurant, isSelected: boolean): string {
  const walkMin = Math.ceil(r.distance / 80)
  const pinColor = isSelected ? '#3182f6' : '#ffffff'
  const dotColor = isSelected ? '#ffffff' : '#3182f6'
  const strokeColor = isSelected ? '#1a6fe0' : '#c9dffe'
  const shadow = isSelected
    ? '0 4px 20px rgba(49,130,246,0.5)'
    : '0 2px 10px rgba(49,130,246,0.2)'
  const scale = isSelected ? 'scale(1.2)' : 'scale(1)'

  return `
    <div class="mp-wrap" style="transform:${scale};transform-origin:bottom center;">
      <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg"
        style="filter:drop-shadow(${shadow});display:block;">
        <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z"
          fill="${pinColor}" stroke="${strokeColor}" stroke-width="1.5"/>
        <circle cx="14" cy="14" r="5.5" fill="${dotColor}"/>
      </svg>
      <div class="mp-tooltip">
        <div class="mp-name">${r.name}</div>
        <div class="mp-meta">
          <span class="mp-cat">${r.category}</span>
          <span class="mp-dist">도보 ${walkMin}분 · ${r.distance}m</span>
        </div>
        ${r.address ? `<div class="mp-addr">${r.address}</div>` : ''}
      </div>
    </div>
  `
}

/** 전역 핀 CSS — Leaflet 초기화 시 1회 주입 */
function injectPinStyles() {
  if (document.getElementById('manim-pin-styles')) return
  const style = document.createElement('style')
  style.id = 'manim-pin-styles'
  style.textContent = `
    /* 지도 타일 채도 조절 — 원색 과다 방지, 앱 블루 계열과 조화 */
    .map-tile-muted {
      filter: saturate(0.55) brightness(1.04) hue-rotate(-5deg);
    }
    .mp-wrap {
      position: relative;
      cursor: pointer;
      transition: transform 0.15s cubic-bezier(0.34,1.56,0.64,1);
      display: inline-block;
    }
    .mp-wrap:hover {
      transform: scale(1.25) translateY(-3px) !important;
    }
    .mp-tooltip {
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%) scale(0.85);
      transform-origin: bottom center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s, transform 0.15s cubic-bezier(0.34,1.56,0.64,1);
      background: #ffffff;
      border: 1.5px solid #c9dffe;
      border-radius: 10px;
      padding: 8px 10px;
      box-shadow: 0 4px 20px rgba(49,130,246,0.18);
      min-width: 140px;
      max-width: 200px;
      z-index: 9999;
    }
    .mp-wrap:hover .mp-tooltip {
      opacity: 1;
      transform: translateX(-50%) scale(1);
    }
    .mp-name {
      font-size: 13px;
      font-weight: 700;
      color: #191f28;
      white-space: nowrap;
      margin-bottom: 4px;
    }
    .mp-meta {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .mp-cat {
      font-size: 11px;
      font-weight: 600;
      color: #3182f6;
      background: #ebf3fe;
      border-radius: 20px;
      padding: 1px 6px;
      white-space: nowrap;
    }
    .mp-dist {
      font-size: 11px;
      color: #b0b8c1;
      white-space: nowrap;
    }
    .mp-addr {
      font-size: 11px;
      color: #b0b8c1;
      margin-top: 3px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 180px;
    }
  `
  document.head.appendChild(style)
}

export default function MapView({ lat, lng, restaurants, onPinClick, onBoundsChange, mapClassName, selectedId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const onBoundsChangeRef = useRef(onBoundsChange)
  onBoundsChangeRef.current = onBoundsChange

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
  }, [])

  const emitBounds = useCallback((map: any) => {
    const b = map.getBounds()
    onBoundsChangeRef.current?.({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
      radiusM: calcViewportRadius(map),
    })
  }, [])

  // Leaflet 초기화
  useEffect(() => {
    if (!mapRef.current) return

    function initMap(L: any) {
      if (mapInstanceRef.current || !mapRef.current) return

      injectPinStyles()

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([lat, lng], 16)
      mapInstanceRef.current = map

      // CartoDB Voyager — POI 라벨 밀도 높음, 채도 낮춰 앱 블루 색감과 조화
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        className: 'map-tile-muted',
      }).addTo(map)

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // 현위치 마커 — 블루 펄스 스타일
      const posIcon = L.divIcon({
        html: `<div style="
          width:14px;height:14px;border-radius:50%;
          background:#3182f6;border:3px solid #fff;
          box-shadow:0 0 0 3px rgba(49,130,246,0.25),0 2px 8px rgba(0,0,0,0.2);
        "></div>`,
        className: '',
        iconAnchor: [7, 7],
      })
      L.marker([lat, lng], { icon: posIcon }).addTo(map)

      map.on('moveend zoomend', () => emitBounds(map))
      map.whenReady(() => emitBounds(map))
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    if ((window as any).L) {
      initMap((window as any).L)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.onload = () => initMap((window as any).L)
    document.head.appendChild(script)

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [lat, lng, emitBounds])

  // lat/lng 변경 시 지도 중심 이동
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    map.setView([lat, lng], map.getZoom(), { animate: true })
    emitBounds(map)
  }, [lat, lng, emitBounds])

  // 음식점 핀 업데이트 — SVG 테어드롭 + 호버 툴팁
  useEffect(() => {
    const map = mapInstanceRef.current
    const L = (window as any).L
    if (!map || !L) return

    clearMarkers()

    restaurants.forEach(r => {
      const isSelected = r.id === selectedId
      const pinIcon = L.divIcon({
        html: buildPinHtml(r, isSelected),
        className: '',
        iconAnchor: [14, 36],   // 핀 하단 꼭짓점을 좌표에 맞춤
      })
      const marker = L.marker([r.lat, r.lng], { icon: pinIcon }).addTo(map)
      marker.on('click', () => onPinClick(r))
      markersRef.current.push(marker)
    })

    return clearMarkers
  }, [restaurants, selectedId, onPinClick, clearMarkers])

  return (
    <div className="w-full h-full">
      <div ref={mapRef} className={mapClassName ?? 'w-full h-80'} style={{ zIndex: 0 }} />
    </div>
  )
}
