// Shared by the user modal (client) and the users API (server) so the rule
// and its message cannot drift apart. scripts/create-admin.mjs repeats the
// number since it runs outside the app.
export const MIN_PASSWORD_LENGTH = 8

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  }
  return null
}
