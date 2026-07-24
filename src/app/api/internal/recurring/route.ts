import { timingSafeEqual } from "node:crypto"
import { postDueRecurringTransactions } from "@/lib/recurring"

export const dynamic = "force-dynamic"

function authorized(request: Request) {
  const secret = process.env.RECURRING_WORKER_SECRET || process.env.NEXTAUTH_SECRET
  const header = request.headers.get("authorization")
  const token = header?.startsWith("Bearer ") ? header.slice(7) : ""
  if (!secret || !token) return false
  const expected = Buffer.from(secret)
  const received = Buffer.from(token)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await postDueRecurringTransactions()
    return Response.json({ success: true, ...result })
  } catch (error) {
    console.error("Recurring worker run failed:", error)
    return Response.json({ error: "Recurring generation failed" }, { status: 500 })
  }
}
