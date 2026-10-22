// Shown while a route segment loads; same spinner the list pages use.
export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto py-12 flex flex-col items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#E0E7FF] border-t-[#4F46E5] rounded-full animate-spin mb-4" />
      <p className="text-[#64748B] text-sm">Loading...</p>
    </div>
  )
}
