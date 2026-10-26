// Failed-login throttling. Two counters, both over a rolling 15-minute window:
//
// - username + IP: 5 failures locks that pair. Keyed on the pair, not the
//   username alone, so someone hammering "admin" from the internet cannot lock
//   the real admin out from the office.
// - IP alone: 20 failures blocks the address for every username, which stops
//   one host cycling through usernames.
//
// Held in memory: the app runs as a single pm2 process, so one Map sees every
// request. A restart clears all locks - acceptable, and also the way to free a
// locked-out employee without waiting.

const WINDOW_MS = 15 * 60 * 1000
const MAX_PER_USER_IP = 5
const MAX_PER_IP = 20

type Bucket = { failures: number; windowStart: number; lockedUntil: number }

const buckets = new Map<string, Bucket>()

function prune(now: number) {
  for (const [key, b] of buckets) {
    if (b.lockedUntil <= now && now - b.windowStart > WINDOW_MS) buckets.delete(key)
  }
}

function keys(username: string, ip: string) {
  return { pair: `u:${username.toLowerCase()}|${ip}`, ip: `ip:${ip}` }
}

// Minutes until the caller may try again, or 0 if not locked.
export function lockedForMinutes(username: string, ip: string): number {
  const now = Date.now()
  prune(now)
  const k = keys(username, ip)
  const until = Math.max(buckets.get(k.pair)?.lockedUntil ?? 0, buckets.get(k.ip)?.lockedUntil ?? 0)
  return until > now ? Math.ceil((until - now) / 60000) : 0
}

function bump(key: string, limit: number, now: number) {
  let b = buckets.get(key)
  if (!b || now - b.windowStart > WINDOW_MS) {
    b = { failures: 0, windowStart: now, lockedUntil: 0 }
    buckets.set(key, b)
  }
  b.failures++
  if (b.failures >= limit) b.lockedUntil = now + WINDOW_MS
}

export function recordFailure(username: string, ip: string) {
  const now = Date.now()
  const k = keys(username, ip)
  bump(k.pair, MAX_PER_USER_IP, now)
  bump(k.ip, MAX_PER_IP, now)
  if (buckets.get(k.pair)!.lockedUntil > now || buckets.get(k.ip)!.lockedUntil > now) {
    console.warn(`Login locked: username="${username}" ip=${ip}`)
  }
}

// A successful login clears that username's counter for this IP. The IP-wide
// counter is left alone so a correct guess does not reset a scanner's tally.
export function recordSuccess(username: string, ip: string) {
  buckets.delete(keys(username, ip).pair)
}
