// Shared between Tracking's hourly grid (Core/Mould/Knockout) and its Melt
// heat popup so a shortfall is categorised the same way whatever stage it
// happened in - otherwise the same breakdown gets logged three different ways
// and the data can't be aggregated later.
//
// The plan is never edited down to match a disrupted day; the shortfall stays
// visible and this explains it. That keeps Close Day's carry-forward correct
// (it computes planned - actual, so an edited-down plan would silently drop
// the unmade work) and makes downtime reportable.
export const VARIANCE_REASONS = [
  'Machine breakdown',
  'Power cut',
  'Material shortage',
  'Manpower shortage',
  'Quality hold',
  'Mould/pattern issue',
  'Other',
] as const

export type VarianceReason = (typeof VARIANCE_REASONS)[number]
