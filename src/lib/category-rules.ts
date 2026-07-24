export type CategoryRuleMatcher = {
  pattern: string
  matchType: string
  isEnabled?: boolean
}

export function categoryRuleMatches(description: string, rule: CategoryRuleMatcher) {
  if (rule.isEnabled === false) return false
  const value = description.trim().toLocaleLowerCase()
  const pattern = rule.pattern.trim().toLocaleLowerCase()
  if (!value || !pattern) return false
  if (rule.matchType === "EXACT") return value === pattern
  if (rule.matchType === "STARTS_WITH") return value.startsWith(pattern)
  return value.includes(pattern)
}
