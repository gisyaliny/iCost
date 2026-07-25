"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react"
import { createRecurringSchedule, deleteRecurringSchedule, getRecurringScheduleHistory, toggleRecurringSchedule, updateRecurringSchedule } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

function dateValue(value?: string | Date | null) {
  return value ? new Date(value).toISOString().split("T")[0] : ""
}

function frequencyUnit(frequency: string) {
  return ({ DAILY: "day", WEEKLY: "week", MONTHLY: "month", YEARLY: "year" } as Record<string, string>)[frequency] || frequency.toLowerCase()
}

function ScheduleForm({ schedule, categories, properties, projects, accounts, onSaved }: any) {
  const [scheduleType, setScheduleType] = useState(schedule?.type || "EXPENSE")
  const [categoryId, setCategoryId] = useState(schedule?.categoryId || "")
  const [indefinite, setIndefinite] = useState(!schedule?.endDate)
  const isEditing = Boolean(schedule?.id)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    if (indefinite) formData.delete("endDate")
    const result = isEditing
      ? await updateRecurringSchedule(schedule.id, formData)
      : await createRecurringSchedule(formData)
    if (result.error) return toast.error(result.error)
    toast.success(isEditing ? "Schedule updated" : "Recurring schedule created")
    onSaved()
  }

  return <form onSubmit={submit} className="grid gap-4">
    <div className="grid gap-2"><Label>Name</Label><Input name="name" defaultValue={schedule?.name || ""} placeholder="Mortgage, salary, Netflix…" required /></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="grid gap-2"><Label>Amount</Label><Input name="amount" type="number" min="0.01" step="0.01" defaultValue={schedule?.amount || ""} required /></div>
      <div className="grid gap-2"><Label>Money direction</Label><Select name="type" value={scheduleType} onValueChange={value => { setScheduleType(value); setCategoryId("") }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EXPENSE">↓ Money Out / Expense</SelectItem><SelectItem value="INCOME">↑ Money In / Income</SelectItem></SelectContent></Select></div>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="grid gap-2"><Label>Frequency</Label><Select name="frequency" defaultValue={schedule?.frequency || "MONTHLY"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].map(value => <SelectItem key={value} value={value}>{value.toLowerCase()}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-2"><Label>Repeat every</Label><Input name="interval" type="number" min="1" max="365" defaultValue={schedule?.interval || 1} required /><p className="text-xs text-slate-400">Example: every 2 months</p></div>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="grid gap-2"><Label>Next occurrence</Label><Input name="nextDate" type="date" defaultValue={dateValue(schedule?.nextDate) || dateValue(new Date())} required /></div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between"><Label>End date</Label><label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={indefinite} onChange={event => setIndefinite(event.target.checked)} /> No end date</label></div>
        <Input name="endDate" type="date" defaultValue={dateValue(schedule?.endDate)} disabled={indefinite} min={dateValue(schedule?.nextDate)} />
      </div>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="grid gap-2"><Label>Category</Label><Select name="categoryId" value={categoryId || undefined} onValueChange={setCategoryId}><SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger><SelectContent>{categories.filter((item: any) => item.type === scheduleType).map((item: any) => <SelectItem key={item.id} value={item.id}>{item.icon} {item.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-2"><Label>Account</Label><Select name="accountId" defaultValue={schedule?.accountId || "NONE"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">No account</SelectItem>{accounts.map((item: any) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="grid gap-2"><Label>Property</Label><Select name="propertyId" defaultValue={schedule?.propertyId || "NONE"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">No property</SelectItem>{properties.map((item: any) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-2"><Label>Project</Label><Select name="projectId" defaultValue={schedule?.projectId || "NONE"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">No project</SelectItem>{projects.map((item: any) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <div className="grid gap-2"><Label>Description</Label><Input name="description" defaultValue={schedule?.description || ""} placeholder="Description used for generated transactions" /></div>
    <div className="grid gap-2"><Label>Note</Label><Input name="note" defaultValue={schedule?.note || ""} /></div>
    <Button type="submit">{isEditing ? "Save Schedule" : "Create Schedule"}</Button>
  </form>
}

function ScheduleDialog({ schedule, categories, properties, projects, accounts, trigger }: any) {
  const [open, setOpen] = useState(false)
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>{trigger}</DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
      <DialogHeader>
        <DialogTitle>{schedule ? "Edit Recurring Schedule" : "Create Recurring Schedule"}</DialogTitle>
        <DialogDescription>{schedule ? "Changes apply only to future occurrences; generated transactions stay unchanged." : "Transactions will be generated automatically when their due date arrives."}</DialogDescription>
      </DialogHeader>
      <ScheduleForm schedule={schedule} categories={categories} properties={properties} projects={projects} accounts={accounts} onSaved={() => setOpen(false)} />
    </DialogContent>
  </Dialog>
}

function GeneratedHistory({ schedule, settings }: any) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<any[] | null>(null)
  const [total, setTotal] = useState(schedule._count?.transactions || 0)
  const [error, setError] = useState("")
  const money = (value: number) => formatMoney(value, settings?.currency || "USD", settings?.locale || "en-US")

  async function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen || history !== null || loading) return
    setLoading(true)
    setError("")
    const result = await getRecurringScheduleHistory(schedule.id)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setHistory(result.transactions || [])
    setTotal(result.total || 0)
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button size="sm" variant="ghost">History ({schedule._count?.transactions || 0})</Button></DialogTrigger>
    <DialogContent className="sm:max-w-[680px]">
      <DialogHeader><DialogTitle>{schedule.name} history</DialogTitle><DialogDescription>The latest generated transactions. Editing or deleting the schedule does not rewrite this history.</DialogDescription></DialogHeader>
      <div className="max-h-[55vh] divide-y overflow-y-auto rounded-xl border">
        {loading && <div className="space-y-3 p-4">{[1, 2, 3].map(item => <div key={item} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}</div>}
        {!loading && error && <div className="space-y-3 p-8 text-center"><p className="text-sm text-rose-600">{error}</p><Button size="sm" variant="outline" onClick={() => { setHistory(null); changeOpen(true) }}>Try again</Button></div>}
        {!loading && !error && history?.map((transaction: any) => <div key={transaction.id} className="flex items-center justify-between gap-4 p-3">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{transaction.description || schedule.name}</p><p className="text-xs text-slate-500">{new Date(transaction.date).toLocaleDateString()} · {transaction.category?.name || "Uncategorized"}</p></div>
          <span className={cn("font-bold", transaction.type === "INCOME" ? "text-emerald-600" : "text-rose-600")}>{transaction.type === "INCOME" ? "+" : "-"}{money(transaction.amount)}</span>
        </div>)}
        {!loading && !error && history !== null && !history.length && <p className="p-8 text-center text-sm text-slate-400">No transactions generated yet.</p>}
      </div>
      {history && total > history.length && <p className="text-center text-xs text-slate-500">Showing the latest {history.length} of {total} transactions.</p>}
    </DialogContent>
  </Dialog>
}

export function RecurringModule({ schedules, categories, properties, projects, accounts, settings }: any) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("ALL")
  const money = (value: number) => formatMoney(value, settings?.currency || "USD", settings?.locale || "en-US")
  const filtered = useMemo(() => schedules.filter((schedule: any) => {
    const matchesSearch = !search.trim() || [schedule.name, schedule.description, schedule.note, schedule.category?.name, schedule.account?.name].some(value => value?.toLowerCase().includes(search.trim().toLowerCase()))
    const matchesStatus = status === "ALL" || (status === "ACTIVE" ? schedule.isActive : !schedule.isActive)
    return matchesSearch && matchesStatus
  }), [schedules, search, status])

  async function toggle(id: string, active: boolean) {
    const result = await toggleRecurringSchedule(id, active)
    if (result.error) return toast.error(result.error)
    toast.success(active ? "Schedule resumed" : "Schedule paused")
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this schedule? Existing transactions will be kept.")) return
    const result = await deleteRecurringSchedule(id)
    if (result.error) return toast.error(result.error)
    toast.success("Schedule deleted")
  }

  return <div className="space-y-5 sm:space-y-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div><h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Recurring</h1><p className="mt-0.5 text-sm text-slate-500 sm:mt-1 sm:text-base">Manage subscriptions, bills, income, and repeating transactions.</p></div>
      <ScheduleDialog categories={categories} properties={properties} projects={projects} accounts={accounts} trigger={<Button className="w-full rounded-xl bg-indigo-600 px-6 hover:bg-indigo-700 sm:w-auto sm:rounded-full">Add Recurring +</Button>} />
    </div>
    <div className="grid grid-cols-3 gap-2 md:gap-4">
      <Card className="rounded-2xl"><CardHeader className="p-3 sm:p-6"><CardDescription className="text-[10px] sm:text-sm">Total</CardDescription><CardTitle className="text-xl sm:text-3xl">{schedules.length}</CardTitle></CardHeader></Card>
      <Card className="rounded-2xl"><CardHeader className="p-3 sm:p-6"><CardDescription className="text-[10px] sm:text-sm">Active</CardDescription><CardTitle className="text-xl text-emerald-600 sm:text-3xl">{schedules.filter((item: any) => item.isActive).length}</CardTitle></CardHeader></Card>
      <Card className="rounded-2xl"><CardHeader className="p-3 sm:p-6"><CardDescription className="text-[10px] sm:text-sm">Paused</CardDescription><CardTitle className="text-xl text-amber-600 sm:text-3xl">{schedules.filter((item: any) => !item.isActive).length}</CardTitle></CardHeader></Card>
    </div>
    <Card className="border-0 shadow-md"><CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_200px]">
      <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, description, category, or account…" />
      <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All statuses</SelectItem><SelectItem value="ACTIVE">Active only</SelectItem><SelectItem value="PAUSED">Paused only</SelectItem></SelectContent></Select>
    </CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-2">
      {filtered.map((schedule: any) => <Card key={schedule.id} className={cn("rounded-2xl border-0 shadow-sm sm:shadow-lg", !schedule.isActive && "opacity-75")}>
        <CardHeader className="p-4 sm:p-6"><div className="flex items-start justify-between gap-3"><div><div className="mb-2 flex flex-wrap items-center gap-2"><span className={cn("rounded-full px-2 py-1 text-xs font-black", schedule.type === "INCOME" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{schedule.type === "INCOME" ? "↑ MONEY IN" : "↓ MONEY OUT"}</span><span className={schedule.isActive ? "rounded-full bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700" : "rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700"}>{schedule.isActive ? "ACTIVE" : "PAUSED"}</span></div><CardTitle>{schedule.name}</CardTitle><CardDescription>Every {schedule.interval} {frequencyUnit(schedule.frequency)}{schedule.interval > 1 ? "s" : ""}</CardDescription></div></div></CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="flex items-end justify-between gap-4"><div><div className="text-xs text-slate-400">Amount</div><div className={cn("text-2xl font-black", schedule.type === "INCOME" ? "text-emerald-600" : "text-rose-600")}>{schedule.type === "INCOME" ? "+" : "-"}{money(schedule.amount)}</div></div><div className="text-right text-xs text-slate-500"><div className="font-semibold">Next: {new Date(schedule.nextDate).toLocaleDateString()}</div><div>{schedule.endDate ? `Ends: ${new Date(schedule.endDate).toLocaleDateString()}` : "No end date"}</div></div></div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">{schedule.category && <span>{schedule.category.icon} {schedule.category.name}</span>}{schedule.account && <span>· {schedule.account.name}</span>}{schedule.project && <span>· 📌 {schedule.project.name}</span>}</div>
          <div className="flex flex-wrap gap-2"><ScheduleDialog schedule={schedule} categories={categories} properties={properties} projects={projects} accounts={accounts} trigger={<Button size="sm" variant="outline">Edit</Button>} /><Button size="sm" variant="outline" onClick={() => toggle(schedule.id, !schedule.isActive)}>{schedule.isActive ? "Pause" : "Resume"}</Button><GeneratedHistory schedule={schedule} settings={settings} /><Button size="sm" variant="ghost" className="text-rose-600" onClick={() => remove(schedule.id)}>Delete</Button></div>
        </CardContent>
      </Card>)}
      {filtered.length === 0 && <Card className="border-dashed lg:col-span-2"><CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center text-slate-500"><p>{schedules.length ? "No schedules match these filters." : "No recurring schedules yet."}</p>{!schedules.length && <ScheduleDialog categories={categories} properties={properties} projects={projects} accounts={accounts} trigger={<Button variant="outline">Create your first schedule</Button>} />}</CardContent></Card>}
    </div>
  </div>
}
