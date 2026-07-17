"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from "next/link"
import { useState } from "react"
import { addProject, archiveProject, updateProject } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { roundMoney, sumMoney } from "@/lib/money"
import { toast } from "sonner"

function dateInput(value?: string | Date | null) {
  return value ? new Date(value).toISOString().split("T")[0] : ""
}

function ProjectForm({ project, trigger }: { project?: any; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const result = project ? await updateProject(project.id, data) : await addProject(data)
    if (result.error) return toast.error(result.error)
    toast.success(project ? "Project updated" : "Project created")
    form.reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{project ? "Edit Project" : "Create Project"}</DialogTitle>
          <DialogDescription>Set a budget and timeframe, then assign transactions from the Transactions module.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2"><Label>Name</Label><Input name="name" maxLength={100} defaultValue={project?.name} required /></div>
          <div className="grid gap-2"><Label>Description</Label><Input name="description" maxLength={300} defaultValue={project?.description || ""} placeholder="Optional" /></div>
          <div className="grid gap-2"><Label>Budget</Label><Input name="budget" type="number" min="0" step="0.01" defaultValue={project?.budget ?? ""} placeholder="Optional" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label>Start Date</Label><Input name="startDate" type="date" defaultValue={dateInput(project?.startDate)} /></div>
            <div className="grid gap-2"><Label>End Date</Label><Input name="endDate" type="date" defaultValue={dateInput(project?.endDate)} /></div>
          </div>
          <Button type="submit">{project ? "Save Changes" : "Create Project"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ProjectsModule({ projects, settings }: { projects: any[]; settings?: any }) {
  const money = (value: number) => new Intl.NumberFormat(settings?.locale || "en-US", { style: "currency", currency: settings?.currency || "USD" }).format(value)
  const projectStats = projects.map(project => {
    const expenses = sumMoney(project.transactions.filter((item: any) => item.type === "EXPENSE" && item.reviewed !== false).map((item: any) => item.amount))
    const income = sumMoney(project.transactions.filter((item: any) => item.type === "INCOME" && item.reviewed !== false).map((item: any) => item.amount))
    return { ...project, expenses, income, netCost: roundMoney(expenses - income) }
  })
  const totalCost = sumMoney(projectStats.map(project => project.netCost))
  const totalBudget = sumMoney(projectStats.map(project => project.budget || 0))
  const overBudget = projectStats.filter(project => project.budget !== null && project.netCost > project.budget).length

  async function archive(id: string, name: string) {
    if (!window.confirm(`Archive “${name}”? Existing transactions will keep their project history.`)) return
    const result = await archiveProject(id)
    if (result.error) return toast.error(result.error)
    toast.success("Project archived")
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Projects</h1><p className="mt-1 text-slate-500">Plan, organize, and measure one-off household spending.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/">Assign Transactions</Link></Button>
          <ProjectForm trigger={<Button>Create Project +</Button>} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardDescription>Active Projects</CardDescription><CardTitle className="text-3xl">{projects.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Combined Net Cost</CardDescription><CardTitle className="text-3xl">{money(totalCost)}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Combined Budget · {overBudget} over</CardDescription><CardTitle className="text-3xl">{money(totalBudget)}</CardTitle></CardHeader></Card>
      </div>

      {projectStats.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center"><div className="text-5xl">📌</div><CardTitle>No projects yet</CardTitle><CardDescription>Create a project for a move, renovation, trip, or other household goal.</CardDescription><ProjectForm trigger={<Button>Create Your First Project</Button>} /></CardContent></Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {projectStats.map(project => {
            const progress = project.budget && project.budget > 0 ? (project.netCost / project.budget) * 100 : 0
            return (
              <Card key={project.id} className="overflow-hidden border-0 shadow-lg">
                <CardHeader className="border-b bg-slate-50/70">
                  <div className="flex items-start justify-between gap-4">
                    <div><CardTitle className="text-xl">📌 {project.name}</CardTitle><CardDescription className="mt-1">{project.description || "No description"}</CardDescription></div>
                    <div className="flex gap-1"><ProjectForm project={project} trigger={<Button size="sm" variant="outline">Edit</Button>} /><Button size="sm" variant="ghost" className="text-rose-600" onClick={() => archive(project.id, project.name)}>Archive</Button></div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-5">
                  <div className="grid grid-cols-3 gap-3 text-sm"><div><div className="text-xs text-slate-400">Expenses</div><div className="font-bold text-rose-600">{money(project.expenses)}</div></div><div><div className="text-xs text-slate-400">Income</div><div className="font-bold text-emerald-600">{money(project.income)}</div></div><div><div className="text-xs text-slate-400">Net Cost</div><div className="font-bold">{money(project.netCost)}</div></div></div>
                  {project.budget !== null && <div className="space-y-2"><div className="flex justify-between text-xs font-semibold"><span>Budget usage</span><span className={cn(progress > 100 && "text-rose-600")}>{money(project.netCost)} / {money(project.budget)}</span></div><Progress value={Math.min(Math.max(progress, 0), 100)} /><div className="text-right text-xs text-slate-400">{progress.toFixed(0)}%</div></div>}
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500"><span>{project.transactions.length} transactions</span>{project.startDate && <span>Starts {new Date(project.startDate).toLocaleDateString()}</span>}{project.endDate && <span>Ends {new Date(project.endDate).toLocaleDateString()}</span>}</div>
                  {project.transactions.length > 0 && <div className="space-y-2 border-t pt-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent transactions</div>{project.transactions.slice(0, 4).map((item: any) => <div key={item.id} className="flex items-center justify-between gap-3 text-sm"><div className="min-w-0"><div className="truncate font-medium">{item.description || "No description"}</div><div className="text-xs text-slate-400">{new Date(item.date).toLocaleDateString()} · {item.category?.name || "Uncategorized"}</div></div><span className={cn("font-semibold", item.type === "INCOME" ? "text-emerald-600" : "text-rose-600")}>{item.type === "INCOME" ? "+" : "-"}{money(item.amount)}</span></div>)}</div>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
