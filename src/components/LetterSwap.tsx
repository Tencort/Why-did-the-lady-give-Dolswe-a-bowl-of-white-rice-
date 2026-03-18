/**
 * Role: 글자 단위 스왑 애니메이션 컴포넌트
 * Key Features: 호버 시 글자가 위/아래로 교체되는 인터랙션
 * Dependencies: framer-motion, lodash
 */
'use client'

import { useState } from 'react'
import { AnimationOptions, motion, stagger, useAnimate } from 'framer-motion'

interface TextProps {
  label: string
  reverse?: boolean
  transition?: AnimationOptions
  staggerDuration?: number
  staggerFrom?: 'first' | 'last' | 'center' | number
  className?: string
  onClick?: () => void
}

export function LetterSwapForward({
  label,
  reverse = true,
  transition = { type: 'spring', duration: 0.7 },
  staggerDuration = 0.03,
  staggerFrom = 'first',
  className,
  onClick,
  ...props
}: TextProps) {
  const [scope, animate] = useAnimate()
  const [blocked, setBlocked] = useState(false)

  const hoverStart = () => {
    if (blocked) return
    setBlocked(true)

    const mergeTransition = (base: AnimationOptions) => ({
      ...base,
      delay: stagger(staggerDuration, { from: staggerFrom }),
    })

    animate('.letter', { y: reverse ? '100%' : '-100%' }, mergeTransition(transition)).then(() => {
      animate('.letter', { y: 0 }, { duration: 0 }).then(() => setBlocked(false))
    })

    animate('.letter-secondary', { top: '0%' }, mergeTransition(transition)).then(() => {
      animate('.letter-secondary', { top: reverse ? '-100%' : '100%' }, { duration: 0 })
    })
  }

  return (
    <span
      className={`flex justify-center items-center relative overflow-hidden ${className ?? ''}`}
      onMouseEnter={hoverStart}
      onClick={onClick}
      ref={scope}
      {...props}
    >
      <span className="sr-only">{label}</span>
      {label.split('').map((letter, i) => (
        <span className="whitespace-pre relative flex" key={i}>
          <motion.span className="relative letter" style={{ top: 0 }}>{letter}</motion.span>
          <motion.span
            className="absolute letter-secondary"
            aria-hidden
            style={{ top: reverse ? '-100%' : '100%' }}
          >{letter}</motion.span>
        </span>
      ))}
    </span>
  )
}
