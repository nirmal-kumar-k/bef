import { Fire } from '@phosphor-icons/react'

interface PourPlanningTabProps {
  openOrders: any[]
  dailyPlans: any[]
}

// Read-only report of every Melt pour: which heat, which product, how many
// moulds were poured into it. No inputs, no Save - Melt Planning is the only
// place pour data gets entered; this tab is just a view of it.
export function PourPlanningTab({ openOrders, dailyPlans }: PourPlanningTabProps) {
  const pours = dailyPlans
    .filter(p => p.stage === 'Melt')
    .map(p => {
      const order = openOrders.find(o => (o.id || o._id) === p.orderId)
      const cartItem = order?.cart?.find((c: any, idx: number) => `${order.id || order._id}-${idx}` === p.itemId)
      return {
        ...p,
        orderNo: order?.customerOrderNo || '-',
        productName: cartItem?.productName || p.patternRef || 'Unknown',
      }
    })
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return (a.heatNumber || 0) - (b.heatNumber || 0)
    })

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[#172554] font-heading">Pour Planning</h2>
        <p className="text-sm text-[#64748B] mt-1">Every heat poured and what went into it - read only, edited from Melt Planning.</p>
      </div>

      <div className="border border-[#E0E7FF] rounded-xl overflow-x-auto bg-white shadow-sm">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-[#F4F6FB] border-b border-[#E0E7FF] text-[#64748B] font-semibold text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Heat</th>
              <th className="px-6 py-4">Grade</th>
              <th className="px-6 py-4">Order No</th>
              <th className="px-6 py-4">Product</th>
              <th className="px-6 py-4 text-center">Moulds Poured</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E7FF]">
            {pours.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-[#94A3B8] italic">No heats poured yet.</td>
              </tr>
            ) : (
              pours.map((p, i) => (
                <tr key={i} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-6 py-4 font-mono text-[#172554]">{p.date}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 font-mono font-bold text-amber-700">
                      <Fire weight="fill" className="w-3.5 h-3.5" />
                      {p.heatNo || `Heat ${p.heatNumber || '-'}`}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-[#64748B]">{p.grade || '-'}</td>
                  <td className="px-6 py-4 font-mono text-[#4285F4]">{p.orderNo}</td>
                  <td className="px-6 py-4 font-semibold text-[#172554]">{p.productName}</td>
                  <td className="px-6 py-4 text-center font-mono font-bold text-[#172554]">{p.mouldsScheduled ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
