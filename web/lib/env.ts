// Reading a missing env var with `process.env.X!` yields `undefined` at
// runtime, which silently produces things like
// `https://undefined.r2.cloudflarestorage.com` or `undefined/undefined` preview
// URLs served with a 200. Fail loudly, naming the variable, instead.
export function requireEnv(name: string): string {
  const value = process.env[name]

  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}
