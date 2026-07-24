import test from "node:test"
import assert from "node:assert/strict"
import { categoryRuleMatches } from "../src/lib/category-rules"
import { nextOccurrence } from "../src/lib/recurring"

test("categorization rule matching mirrors import behavior", () => {
  assert.equal(categoryRuleMatches("COSTCO WHSE 123", { pattern: "costco", matchType: "CONTAINS" }), true)
  assert.equal(categoryRuleMatches("COSTCO WHSE 123", { pattern: "costco", matchType: "STARTS_WITH" }), true)
  assert.equal(categoryRuleMatches("COSTCO WHSE 123", { pattern: "costco", matchType: "EXACT" }), false)
  assert.equal(categoryRuleMatches("COSTCO", { pattern: "costco", matchType: "EXACT", isEnabled: false }), false)
})

test("recurring monthly interval preserves the anchor day at month end", () => {
  const current = new Date("2026-01-31T12:00:00Z")
  const next = nextOccurrence(current, current, "MONTHLY", 1)
  assert.equal(next?.toISOString().slice(0, 10), "2026-02-28")
})

test("recurring intervals advance by the configured number of periods", () => {
  const current = new Date("2026-01-15T12:00:00Z")
  assert.equal(nextOccurrence(current, current, "WEEKLY", 2)?.toISOString().slice(0, 10), "2026-01-29")
  assert.equal(nextOccurrence(current, current, "YEARLY", 2)?.toISOString().slice(0, 10), "2028-01-15")
})
