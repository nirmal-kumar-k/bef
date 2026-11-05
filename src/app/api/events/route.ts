import { NextRequest } from 'next/server'
import { getSessionUser } from '@/shared/lib/auth'
import { subscribe } from '@/infrastructure/realtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Server-Sent Events stream of data changes for logged-in browsers. Receive
// only: changes are made through the normal API routes, never through here.
export async function GET(request: NextRequest) {
  // proxy.ts already rejects requests without a valid session; checked again
  // because this stream stays open for as long as the tab does.
  if (!(await getSessionUser())) return new Response('Unauthorized', { status: 401 })

  const encoder = new TextEncoder()
  let cleanup: (() => void) | undefined

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try { controller.enqueue(encoder.encode(chunk)) } catch { cleanup?.() }
      }
      // Browser reconnects 3s after a drop; "ready" tells it the stream is live.
      send('retry: 3000\n\n')
      send('event: ready\ndata: {}\n\n')
      const unsubscribe = subscribe(payload => send(`data: ${payload}\n\n`))
      // A comment line every 25s keeps nginx (60s read timeout) and phones'
      // network stacks from treating the quiet connection as dead.
      const heartbeat = setInterval(() => send(': ping\n\n'), 25000)
      cleanup = () => { clearInterval(heartbeat); unsubscribe(); cleanup = undefined }
      request.signal.addEventListener('abort', () => {
        cleanup?.()
        try { controller.close() } catch { /* already closed */ }
      })
    },
    cancel() { cleanup?.() },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Tells nginx not to buffer this response, so events arrive immediately
      // without any change to the server's nginx configuration.
      'X-Accel-Buffering': 'no',
    },
  })
}
