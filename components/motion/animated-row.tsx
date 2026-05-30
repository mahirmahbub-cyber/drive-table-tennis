'use client'

import { motion } from 'framer-motion'

export function AnimatedRow({
  layoutId,
  children,
  className,
}: {
  layoutId: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.li
      layout
      layoutId={layoutId}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className={className}
    >
      {children}
    </motion.li>
  )
}
