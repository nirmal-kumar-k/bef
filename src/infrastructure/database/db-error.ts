import { NextResponse } from 'next/server'

// Turns a database error from a write into a response the screen can show.
// Drizzle wraps the Postgres error - the code lives on error.cause, not on
// error itself - which is why checks like `error?.code === '23505'` written
// against the top-level error never fired and duplicates came back as 500s.
export function dbErrorResponse(error: unknown, fallback: string, messages: { duplicate?: string; inUse?: string } = {}) {
  const pg = ((error as { cause?: unknown })?.cause ?? error) as { code?: string; column_name?: string; detail?: string }
  const field = pg?.column_name ? pg.column_name.replace(/_/g, ' ') : 'a required field'
  switch (pg?.code) {
    case '23502': // not_null_violation
      return NextResponse.json({ error: `${field.charAt(0).toUpperCase()}${field.slice(1)} is required` }, { status: 400 })
    case '23505': // unique_violation
      return NextResponse.json({ error: messages.duplicate || 'A record with these details already exists' }, { status: 409 })
    case '23503': // foreign_key_violation
      return NextResponse.json({ error: messages.inUse || 'This record is still used elsewhere and cannot be removed or changed this way' }, { status: 409 })
    case '22P02': // invalid_text_representation (e.g. text in a number or uuid field)
    case '22003': // numeric_value_out_of_range
    case '23514': // check_violation
      return NextResponse.json({ error: 'One of the values is not valid for its field' }, { status: 400 })
    default:
      return NextResponse.json({ error: fallback }, { status: 500 })
  }
}
