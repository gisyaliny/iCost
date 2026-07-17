"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react"
import { deleteRecurringSchedule, toggleRecurringSchedule, updateRecurringSchedule } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatMoney } from "@/lib/money"
import { toast } from "sonner"

function dateValue(value?: string | Date | null) {
  return value ? new Date(value).toISOString().split("T")[0] : ""
}

function ScheduleEditor({ schedule, categories, properties, projects, accounts }: any) {
  const [open, setOpen] = useState(false)
  const [scheduleType, setScheduleType] = useState(schedule.type)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await updateRecurringSchedule(schedule.id, new FormData(event.currentTarget))
    if (result.error) return toast.error(result.error)
    toast.success("Schedule updated")
    setOpen(false)
  }
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline">Edit</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
      <DialogHeader><DialogTitle>Edit Recurring Schedule</DialogTitle><DialogDescription>Changes apply to future occurrences. Existing transactions are preserved.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-2"><Label>Name</Label><Input name="name" defaultValue={schedule.name} required /></div>
        <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label>Amount</Label><Input name="amount" type="number" min="0.01" step="0.01" defaultValue={schedule.amount} required /></div><div className="grid gap-2"><Label>Type</Label><Select name="type" value={scheduleType} onValueChange={setScheduleType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EXPENSE">Expense</SelectItem><SelectItem value="INCOME">Income</SelectItem></SelectContent></Select></div></div>
        <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label>Frequency</Label><Select name="frequency" defaultValue={schedule.frequency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].map(value => <SelectItem key={value} value={value}>{value.toLowerCase()}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Every</Label><Input name="interval" type="number" min="1" max="365" defaultValue={schedule.interval} required /></div></div>
        <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label>Next Date</Label><Input name="nextDate" type="date" defaultValue={dateValue(schedule.nextDate)} required /></div><div className="grid gap-2"><Label>End Date</Label><Input name="endDate" type="date" defaultValue={dateValue(schedule.endDate)} /></div></div>
        <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label>Category</Label><Select name="categoryId" defaultValue={schedule.categoryId || undefined}><SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger><SelectContent>{categories.filter((item: any) => item.type === scheduleType).map((item: any) => <SelectItem key={item.id} value={item.id}>{item.icon} {item.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Account</Label><Select name="accountId" defaultValue={schedule.accountId || "NONE"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">No account</SelectItem>{accounts.map((item: any) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div></div>
        <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label>Property</Label><Select name="propertyId" defaultValue={schedule.propertyId || "NONE"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">No property</SelectItem>{properties.map((item: any) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Project</Label><Select name="projectId" defaultValue={schedule.projectId || "NONE"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">No project</SelectItem>{projects.map((item: any) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div></div>
        <div className="grid gap-2"><Label>Description</Label><Input name="description" defaultValue={schedule.description || ""} /></div>
        <div className="grid gap-2"><Label>Note</Label><Input name="note" defaultValue={schedule.note || ""} /></div>
        <Button type="submit">Save Schedule</Button>
      </form>
    </DialogContent>
  </Dialog>
}

export function RecurringModule({ schedules, categories, properties, projects, accounts, settings }: any) {
  const money = (value: number) => formatMoney(value, settings?.currency || "USD", settings?.locale || "en-US")
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
  return <div className="space-y-8">
    <div><h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Recurring</h1><p className="mt-1 text-slate-500">Manage subscriptions, bills, income, and other repeating transactions.</p></div>
    <div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardDescription>Total schedules</CardDescription><CardTitle className="text-3xl">{schedules.length}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Active</CardDescription><CardTitle className="text-3xl text-emerald-600">{schedules.filter((item: any) => item.isActive).length}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Paused</CardDescription><CardTitle className="text-3xl text-amber-600">{schedules.filter((item: any) => !item.isActive).length}</CardTitle></CardHeader></Card></div>
    <div className="grid gap-4 lg:grid-cols-2">{schedules.map((schedule: any) => <Card key={schedule.id} className="border-0 shadow-lg"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{schedule.name}</CardTitle><CardDescription>{schedule.frequency.toLowerCase()} · every {schedule.interval}</CardDescription></div><span className={schedule.isActive ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700" : "rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700"}>{schedule.isActive ? "ACTIVE" : "PAUSED"}</span></div></CardHeader><CardContent className="space-y-4"><div className="flex items-end justify-between"><div><div className="text-xs text-slate-400">Amount</div><div className="text-2xl font-black">{money(schedule.amount)}</div></div><div className="text-right text-xs text-slate-500"><div>Next: {new Date(schedule.nextDate).toLocaleDateString()}</div>{schedule.endDate && <div>Ends: {new Date(schedule.endDate).toLocaleDateString()}</div>}</div></div><div className="flex flex-wrap gap-2 text-xs text-slate-500">{schedule.category && <span>{schedule.category.icon} {schedule.category.name}</span>}{schedule.account && <span>· {schedule.account.name}</span>}{schedule.project && <span>· 📌 {schedule.project.name}</span>}</div><div className="flex gap-2"><ScheduleEditor schedule={schedule} categories={categories} properties={properties} projects={projects} accounts={accounts} /><Button size="sm" variant="outline" onClick={() => toggle(schedule.id, !schedule.isActive)}>{schedule.isActive ? "Pause" : "Resume"}</Button><Button size="sm" variant="ghost" className="text-rose-600" onClick={() => remove(schedule.id)}>Delete</Button></div></CardContent></Card>)}{schedules.length === 0 && <Card className="border-dashed lg:col-span-2"><CardContent className="flex min-h-64 items-center justify-center text-center text-slate-500">No recurring schedules yet. Create one from Add Transaction.</CardContent></Card>}</div>
  </div>
}
