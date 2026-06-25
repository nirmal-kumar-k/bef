export type Grade = {
  id: string
  code: string
  name: string
  c: string
  si: string
  mn: string
  p: string
  s: string
  remarks?: string
}

export const mockGrades: Grade[] = [
  { id: '1', code: 'FC 200', name: 'Grey Cast Iron 200', c: '3.1–3.4', si: '1.9–2.3', mn: '0.6–0.9', p: '≤0.15', s: '≤0.12' },
  { id: '2', code: 'FC 215', name: 'Grey Cast Iron 215', c: '3.1–3.4', si: '1.9–2.3', mn: '0.6–0.9', p: '≤0.15', s: '≤0.12' },
  { id: '3', code: 'FC 250', name: 'Grey Cast Iron 250', c: '3.0–3.3', si: '1.6–2.0', mn: '0.6–0.9', p: '≤0.12', s: '≤0.10' },
  { id: '4', code: 'FC 300', name: 'Grey Cast Iron 300', c: '2.9–3.2', si: '1.4–1.8', mn: '0.6–0.9', p: '≤0.10', s: '≤0.10' },
  { id: '5', code: 'FC 350', name: 'Grey Cast Iron 350', c: '2.7–3.0', si: '1.2–1.6', mn: '0.6–0.9', p: '≤0.10', s: '≤0.10' },
  { id: '6', code: 'SG 400', name: 'Ductile Iron 400', c: '3.5–3.8', si: '2.2–2.8', mn: '≤0.30', p: '≤0.05', s: '≤0.02' },
  { id: '7', code: 'SG 500', name: 'Ductile Iron 500', c: '3.4–3.7', si: '2.0–2.6', mn: '≤0.30', p: '≤0.05', s: '≤0.02' },
  { id: '8', code: 'SG 600', name: 'Ductile Iron 600', c: '3.3–3.6', si: '1.8–2.4', mn: '≤0.30', p: '≤0.05', s: '≤0.02' },
]
