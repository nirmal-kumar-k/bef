'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ y: 5, opacity: 0, filter: 'blur(4px)' }}
        animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
        exit={{ y: -5, opacity: 0, filter: 'blur(4px)' }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="will-change-transform h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
