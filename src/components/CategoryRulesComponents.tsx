"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react"
import { addCategoryRule, deleteCategoryRule, reorderCategoryRules, toggleCategoryRule, updateCategoryRule } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { categoryRuleMatches } from "@/lib/category-rules"
import { toast } from "sonner"

function RuleForm({ rule, categories, onSaved }: any) {
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = rule
      ? await updateCategoryRule(rule.id, new FormData(event.currentTarget))
      : await addCategoryRule(new FormData(event.currentTarget))
    if (result.error) return toast.error(result.error)
    toast.success(rule ? "Rule updated" : "Rule created")
    onSaved()
  }
  return <form onSubmit={submit} className="grid gap-4">
    <div className="grid gap-2"><Label>Rule name</Label><Input name="name" defaultValue={rule?.name || ""} placeholder="Costco groceries" required /></div>
    <div className="grid gap-2"><Label>Description pattern</Label><Input name="pattern" defaultValue={rule?.pattern || ""} placeholder="COSTCO" required /></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="grid gap-2"><Label>Match method</Label><Select name="matchType" defaultValue={rule?.matchType || "CONTAINS"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CONTAINS">Contains</SelectItem><SelectItem value="STARTS_WITH">Starts with</SelectItem><SelectItem value="EXACT">Exact match</SelectItem></SelectContent></Select></div>
      <div className="grid gap-2"><Label>Assign category</Label><Select name="categoryId" defaultValue={rule?.categoryId || undefined}><SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger><SelectContent>{categories.map((category: any) => <SelectItem key={category.id} value={category.id}>{category.type === "INCOME" ? "↑" : "↓"} {category.icon} {category.name}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <Button type="submit">{rule ? "Save Rule" : "Create Rule"}</Button>
  </form>
}

function RuleDialog({ rule, categories, trigger }: any) {
  const [open, setOpen] = useState(false)
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>{trigger}</DialogTrigger>
    <DialogContent className="sm:max-w-[560px]">
      <DialogHeader><DialogTitle>{rule ? "Edit Categorization Rule" : "Create Categorization Rule"}</DialogTitle><DialogDescription>Rules inspect imported transaction descriptions. The first enabled match in priority order wins.</DialogDescription></DialogHeader>
      <RuleForm rule={rule} categories={categories} onSaved={() => setOpen(false)} />
    </DialogContent>
  </Dialog>
}

export function CategoryRulesModule({ initialRules, categories }: { initialRules: any[], categories: any[] }) {
  const [rules, setRules] = useState(initialRules)
  const [testDescription, setTestDescription] = useState("")
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const matches = useMemo(() => rules.filter(rule => categoryRuleMatches(testDescription, rule)), [rules, testDescription])

  async function persistOrder(next: any[]) {
    setRules(next)
    const result = await reorderCategoryRules(next.map(rule => rule.id))
    if (result.error) {
      setRules(initialRules)
      return toast.error(result.error)
    }
    toast.success("Rule priority updated")
  }

  async function move(ruleId: string, direction: -1 | 1) {
    const index = rules.findIndex(rule => rule.id === ruleId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= rules.length) return
    const next = [...rules]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    await persistOrder(next)
  }

  async function dropOn(targetId: string) {
    if (!draggingId || draggingId === targetId) return setDraggingId(null)
    const from = rules.findIndex(rule => rule.id === draggingId)
    const to = rules.findIndex(rule => rule.id === targetId)
    if (from < 0 || to < 0) return setDraggingId(null)
    const next = [...rules]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setDraggingId(null)
    await persistOrder(next)
  }

  async function toggle(rule: any) {
    const result = await toggleCategoryRule(rule.id, !rule.isEnabled)
    if (result.error) return toast.error(result.error)
    setRules(items => items.map(item => item.id === rule.id ? { ...item, isEnabled: !rule.isEnabled } : item))
    toast.success(rule.isEnabled ? "Rule disabled" : "Rule enabled")
  }

  async function remove(rule: any) {
    if (!window.confirm(`Delete rule “${rule.name}”?`)) return
    const result = await deleteCategoryRule(rule.id)
    if (result.error) return toast.error(result.error)
    setRules(items => items.filter(item => item.id !== rule.id))
    toast.success("Rule deleted")
  }

  return <div className="space-y-5 sm:space-y-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div><h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Categorization Rules</h1><p className="mt-0.5 text-sm text-slate-500 sm:mt-1 sm:text-base">Automatically categorize imported CSV, OFX, and QFX transactions.</p></div>
      <RuleDialog categories={categories} trigger={<Button className="w-full rounded-xl bg-indigo-600 px-6 hover:bg-indigo-700 sm:w-auto sm:rounded-full">Add Rule +</Button>} />
    </div>

    <div className="grid grid-cols-3 gap-2 md:gap-4">
      <Card className="rounded-2xl"><CardHeader className="p-3 sm:p-6"><CardDescription className="text-[10px] sm:text-sm">Total</CardDescription><CardTitle className="text-xl sm:text-3xl">{rules.length}</CardTitle></CardHeader></Card>
      <Card className="rounded-2xl"><CardHeader className="p-3 sm:p-6"><CardDescription className="text-[10px] sm:text-sm">Enabled</CardDescription><CardTitle className="text-xl text-emerald-600 sm:text-3xl">{rules.filter(rule => rule.isEnabled).length}</CardTitle></CardHeader></Card>
      <Card className="rounded-2xl"><CardHeader className="p-3 sm:p-6"><CardDescription className="text-[10px] sm:text-sm">Disabled</CardDescription><CardTitle className="text-xl text-amber-600 sm:text-3xl">{rules.filter(rule => !rule.isEnabled).length}</CardTitle></CardHeader></Card>
    </div>

    <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 to-white shadow-md">
      <CardHeader className="p-4 sm:p-6"><CardTitle>Test a description</CardTitle><CardDescription>Type exactly what appears on a bank statement. Testing does not change any transactions.</CardDescription></CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
        <Input value={testDescription} onChange={event => setTestDescription(event.target.value)} placeholder="Example: COSTCO WHSE #1234" className="h-12 bg-white text-base" />
        {!testDescription.trim() ? <p className="text-sm text-slate-500">Enter a description to preview matching.</p> : matches.length ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold uppercase text-emerald-700">Winning rule</p><p className="mt-1 font-black text-emerald-950">{matches[0].name} → {matches[0].category.icon} {matches[0].category.name}</p>{matches.length > 1 && <p className="mt-2 text-xs text-emerald-700">{matches.length - 1} lower-priority rule(s) also match but will not be used.</p>}</div> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">No enabled rule matches this description.</div>}
      </CardContent>
    </Card>

    <Card className="border-0 shadow-lg">
      <CardHeader className="p-4 sm:p-6"><CardTitle>Priority order</CardTitle><CardDescription>Top rules run first. Drag a rule, or use the arrow buttons for keyboard-friendly ordering.</CardDescription></CardHeader>
      <CardContent className="space-y-3 p-3 pt-0 sm:p-6 sm:pt-0">
        {rules.map((rule, index) => <div
          key={rule.id}
          draggable
          onDragStart={() => setDraggingId(rule.id)}
          onDragEnd={() => setDraggingId(null)}
          onDragOver={event => event.preventDefault()}
          onDrop={() => dropOn(rule.id)}
          className={cn("grid gap-3 rounded-2xl border bg-white p-4 transition sm:grid-cols-[44px_1fr_auto] sm:items-center", !rule.isEnabled && "bg-slate-50 opacity-65", draggingId === rule.id && "border-indigo-400 opacity-50")}
        >
          <div className="flex items-center gap-2 sm:block"><span className="cursor-grab text-xl text-slate-400" title="Drag to reorder">⠿</span><span className="text-xs font-black text-slate-400">#{index + 1}</span></div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{rule.name}</p><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black", rule.isEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600")}>{rule.isEnabled ? "ENABLED" : "DISABLED"}</span></div>
            <p className="mt-1 text-sm text-slate-600">{rule.matchType.replaceAll("_", " ")} “{rule.pattern}” → <span className="font-semibold">{rule.category.icon} {rule.category.name}</span></p>
          </div>
          <div className="grid grid-cols-5 gap-1 sm:flex sm:flex-wrap">
            <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => move(rule.id, -1)} title="Move up">↑</Button>
            <Button size="sm" variant="ghost" disabled={index === rules.length - 1} onClick={() => move(rule.id, 1)} title="Move down">↓</Button>
            <Button size="sm" variant="outline" onClick={() => toggle(rule)}>{rule.isEnabled ? "Disable" : "Enable"}</Button>
            <RuleDialog rule={rule} categories={categories} trigger={<Button size="sm" variant="outline">Edit</Button>} />
            <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => remove(rule)}>Delete</Button>
          </div>
        </div>)}
        {!rules.length && <div className="flex min-h-48 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed text-center text-slate-500"><p>No categorization rules yet.</p><RuleDialog categories={categories} trigger={<Button variant="outline">Create your first rule</Button>} /></div>}
      </CardContent>
    </Card>
  </div>
}
