'use client'

import { useEffect } from 'react'
import { Button } from '@/shared/ui/button'

// Catches render errors in any page under the root layout, so a crash keeps
// the sidebar and offers a retry instead of dropping the user on Next's
// default error page.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="max-w-7xl mx-auto py-12 flex flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-heading font-extrabold text-[#172554] tracking-tight">Something went wrong</h1>
      <p className="text-[#64748B] text-sm mt-2 max-w-md">
        This page hit an unexpected error. Your saved data is not affected. Try again, or reload the page if it keeps happening.
      </p>
      {error.digest && <p className="text-[#94A3B8] text-xs mt-2">Reference: {error.digest}</p>}
      <Button onClick={reset} className="mt-6 bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-medium">
        Try again
      </Button>
    </div>
  )
}
