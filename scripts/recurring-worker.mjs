const secret = process.env.RECURRING_WORKER_SECRET || process.env.NEXTAUTH_SECRET
if (!secret) {
  console.error("❌ Recurring worker requires RECURRING_WORKER_SECRET or NEXTAUTH_SECRET.")
  process.exit(1)
}

const configuredInterval = Number(process.env.RECURRING_POLL_INTERVAL_MS || 60_000)
const intervalMs = Number.isFinite(configuredInterval) ? Math.max(15_000, configuredInterval) : 60_000
const endpoint = process.env.RECURRING_WORKER_URL || `http://127.0.0.1:${process.env.PORT || 3000}/api/internal/recurring`
let timer
let stopping = false
let unavailable = false

async function run() {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const result = await response.json()
    if (unavailable) console.log("✅ Recurring worker reconnected.")
    unavailable = false
    if (result.transactionsGenerated > 0) {
      console.log(`🔁 Generated ${result.transactionsGenerated} recurring transaction(s).`)
    }
  } catch (error) {
    if (!unavailable) console.warn(`⚠️ Recurring worker is waiting for the app: ${error.message}`)
    unavailable = true
  } finally {
    if (!stopping) timer = setTimeout(run, intervalMs)
  }
}

function stop() {
  stopping = true
  if (timer) clearTimeout(timer)
  process.exit(0)
}

process.on("SIGINT", stop)
process.on("SIGTERM", stop)

console.log(`⏱️ Recurring worker checking every ${Math.round(intervalMs / 1000)} seconds.`)
run()
