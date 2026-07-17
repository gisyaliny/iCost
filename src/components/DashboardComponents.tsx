"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addTransaction, deleteTransaction, addCategory, importTransactions, addProperty, addProject, assignTransactionsToProject, deleteTransactions, resetAllData, addAccount, addTransfer, updateUserSettings, markTransactionsReviewed, updateTransactionReview, addCategoryRule, saveImportProfile, scanImportInbox, previewInboxFile } from "@/app/actions"
import { Checkbox } from "@/components/ui/checkbox"
import { useEffect, useRef, useState, useMemo } from "react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import Papa from "papaparse"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, Line, ComposedChart } from 'recharts'
import { updateTransaction, removeDuplicates } from "@/app/actions"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"
import { CategorySelectorContent } from "./CategorySelectorContent"
import { formatMoney, roundMoney, sumMoney } from "@/lib/money"
import { CSVMapping, detectCSVMapping, EMPTY_CSV_MAPPING, ImportTransaction, mapCSVRows, parseStatementText, statementFileType } from "@/lib/statement-import"

const isStatementImport = (source?: string | null) => source === "CSV_IMPORT" || source === "OFX_IMPORT" || source === "QFX_IMPORT"

function displayMoney(value: number, settings?: any) {
    return formatMoney(value, settings?.currency || "USD", settings?.locale || "en-US")
}

function displayCurrencySymbol(settings?: any) {
    return new Intl.NumberFormat(settings?.locale || "en-US", { style: "currency", currency: settings?.currency || "USD" })
        .formatToParts(0)
        .find(part => part.type === "currency")?.value || settings?.currency || "USD"
}

function formatDate(value: string | Date) {
    return new Date(value).toLocaleDateString(undefined, { timeZone: "UTC" })
}

const SHARED_FILTERS_KEY = "icost-shared-finance-filters"
const LEGACY_TRANSACTION_FILTERS_KEY = "icost-transaction-filters"

type StoredFinanceFilters = {
    startDate?: string
    endDate?: string
    categoryIds?: string[]
    transactionSearch?: string
    search?: string
}

function readStoredFinanceFilters(): StoredFinanceFilters | null {
    const saved = window.sessionStorage.getItem(SHARED_FILTERS_KEY)
        || window.sessionStorage.getItem(LEGACY_TRANSACTION_FILTERS_KEY)
    if (!saved) return null

    try {
        return JSON.parse(saved) as StoredFinanceFilters
    } catch {
        window.sessionStorage.removeItem(SHARED_FILTERS_KEY)
        window.sessionStorage.removeItem(LEGACY_TRANSACTION_FILTERS_KEY)
        return null
    }
}

function saveStoredFinanceFilters(filters: StoredFinanceFilters) {
    const current = readStoredFinanceFilters() || {}
    window.sessionStorage.setItem(SHARED_FILTERS_KEY, JSON.stringify({ ...current, ...filters }))
    window.sessionStorage.removeItem(LEGACY_TRANSACTION_FILTERS_KEY)
}

function filterBySharedFinanceFilters(transactions: any[], startDate: string, endDate: string, selectedCategories: Set<string>) {
    return transactions.filter(transaction => {
        const date = new Date(transaction.date).toISOString().split("T")[0]
        return date >= startDate
            && date <= endDate
            && selectedCategories.has(transaction.categoryId)
    })
}


export function SummaryCards({ transactions, settings }: { transactions: any[], settings?: any }) {
  const [budget, setBudget] = useState(settings?.monthlyBudget ?? 2000)
  const [isEditingBudget, setIsEditingBudget] = useState(false)
  const money = (value: number) => new Intl.NumberFormat(settings?.locale || "en-US", { style: "currency", currency: settings?.currency || "USD" }).format(value)

  const income = sumMoney(transactions.filter(t => t.type === "INCOME").map(t => t.amount))
  const expense = sumMoney(transactions.filter(t => t.type === "EXPENSE").map(t => t.amount))
  const balance = roundMoney(income - expense)
  const budgetProgress = budget > 0 ? Math.min((expense / budget) * 100, 100) : 0

  async function saveBudget(value: string) {
    const nextBudget = Math.max(0, roundMoney(Number(value) || 0))
    const formData = new FormData()
    formData.set("monthlyBudget", nextBudget.toString())
    formData.set("currency", settings?.currency || "USD")
    formData.set("locale", settings?.locale || "en-US")
    formData.set("timezone", settings?.timezone || "America/New_York")
    const result = await updateUserSettings(formData)
    if (result.error) return toast.error(result.error)
    setBudget(nextBudget)
    setIsEditingBudget(false)
    toast.success("Monthly budget saved")
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="bg-white shadow-lg border-0 animate-slide-up overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Income</CardTitle>
          <div className="text-emerald-500 bg-emerald-50 p-1.5 rounded-full">↑</div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black text-emerald-600">{money(income)}</div>
        </CardContent>
      </Card>
      <Card className="bg-white shadow-lg border-0 animate-slide-up overflow-hidden" style={{ animationDelay: '0.1s' }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Expenses</CardTitle>
          <div className="text-rose-500 bg-rose-50 p-1.5 rounded-full">↓</div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black text-rose-600">{money(expense)}</div>
          <div className="mt-4 space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                  <span>Monthly Budget</span>
                  <span onClick={() => setIsEditingBudget(true)} className="cursor-pointer hover:text-slate-600">
                      {isEditingBudget ? (
                          <Input 
                            type="number" 
                            defaultValue={budget} 
                            autoFocus 
                            onBlur={(e) => saveBudget(e.target.value)}
                            onKeyDown={(e) => { if(e.key==='Enter') saveBudget(e.currentTarget.value) }}
                            className="h-4 w-16 text-right p-0 border-0 focus-visible:ring-0"
                          />
                      ) : money(budget)}
                  </span>
              </div>
              <Progress value={budgetProgress} className={cn("h-1.5", budgetProgress > 90 ? "bg-rose-100" : "bg-slate-100")} />
              <div className="text-[10px] text-slate-400 text-right">{budgetProgress.toFixed(0)}% used</div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-white shadow-lg border-0 animate-slide-up overflow-hidden">
         <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Net Cash Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("text-3xl font-black", balance >= 0 ? "text-slate-900" : "text-rose-600")}>
              {money(balance)}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function AccountsOverview({ accounts, settings }: { accounts: any[], settings?: any }) {
  const [accountOpen, setAccountOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const totalBalance = sumMoney(accounts.map(account => account.balance))

  async function submitAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await addAccount(new FormData(event.currentTarget))
    if (result.error) return toast.error(result.error)
    toast.success("Account added")
    setAccountOpen(false)
  }

  async function submitTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await addTransfer(new FormData(event.currentTarget))
    if (result.error) return toast.error(result.error)
    toast.success("Transfer recorded")
    setTransferOpen(false)
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>Total balance {displayMoney(totalBalance, settings)}</CardDescription>
        </div>
        <div className="flex gap-2">
          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogTrigger asChild><Button variant="outline" disabled={accounts.length < 2}>Transfer</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Transfer</DialogTitle><DialogDescription>Transfers move money between accounts and do not affect income or expenses.</DialogDescription></DialogHeader>
              <form onSubmit={submitTransfer} className="grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2"><Label>From</Label><Select name="fromAccountId" required><SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger><SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid gap-2"><Label>To</Label><Select name="toAccountId" required><SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger><SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2"><Label>Amount</Label><Input name="amount" type="number" min="0.01" step="0.01" required /></div>
                  <div className="grid gap-2"><Label>Date</Label><Input name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required /></div>
                </div>
                <div className="grid gap-2"><Label>Description</Label><Input name="description" placeholder="Optional" /></div>
                <Button type="submit">Save Transfer</Button>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
            <DialogTrigger asChild><Button>Add Account</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Account</DialogTitle><DialogDescription>Add cash, bank, card, or investment accounts.</DialogDescription></DialogHeader>
              <form onSubmit={submitAccount} className="grid gap-4">
                <div className="grid gap-2"><Label>Name</Label><Input name="name" placeholder="Everyday Checking" required /></div>
                <div className="grid gap-2"><Label>Type</Label><Select name="type" defaultValue="CHECKING"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CHECKING">Checking</SelectItem><SelectItem value="SAVINGS">Savings</SelectItem><SelectItem value="CASH">Cash</SelectItem><SelectItem value="CREDIT_CARD">Credit Card</SelectItem><SelectItem value="INVESTMENT">Investment</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></div>
                <div className="grid gap-2"><Label>Opening Balance</Label><Input name="openingBalance" type="number" step="0.01" defaultValue="0" required /></div>
                <Button type="submit">Add Account</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map(account => (
          <div key={account.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3"><span className="font-semibold text-slate-800">{account.name}</span><span className="text-[10px] font-bold text-slate-400">{account.type.replaceAll("_", " ")}</span></div>
            <div className={cn("mt-2 text-xl font-black", account.balance < 0 ? "text-rose-600" : "text-slate-900")}>{displayMoney(account.balance, settings)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function TransactionDashboard({ transactions, categories, properties, projects, accounts, settings }: { transactions: any[], categories: any[], properties: any[], projects: any[], accounts: any[], settings?: any }) {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const [startDate, setStartDate] = useState<string>(firstDay.toISOString().split('T')[0])
    const [endDate, setEndDate] = useState<string>(lastDay.toISOString().split('T')[0])
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(categories.map(c => c.id)))
    const [search, setSearch] = useState("")
    const filtersRestored = useRef(false)

    useEffect(() => {
        if (filtersRestored.current) return

        const parsed = readStoredFinanceFilters()
        if (!parsed) {
            filtersRestored.current = true
            return
        }

        try {
            const validCategoryIds = new Set(categories.map(category => category.id))
            const restoredCategories = Array.isArray(parsed.categoryIds)
                ? parsed.categoryIds.filter(id => validCategoryIds.has(id))
                : categories.map(category => category.id)

            queueMicrotask(() => {
                if (parsed.startDate) setStartDate(parsed.startDate)
                if (parsed.endDate) setEndDate(parsed.endDate)
                setSelectedCategories(new Set(restoredCategories))
                setSearch(parsed.transactionSearch ?? parsed.search ?? "")
                filtersRestored.current = true
            })
        } catch {
            window.sessionStorage.removeItem(SHARED_FILTERS_KEY)
            filtersRestored.current = true
        }
    }, [categories])

    useEffect(() => {
        if (!filtersRestored.current) return
        saveStoredFinanceFilters({
            startDate,
            endDate,
            categoryIds: Array.from(selectedCategories),
            transactionSearch: search,
        })
    }, [startDate, endDate, selectedCategories, search])

    // 1. Filter by Date Range
    const dateFiltered = useMemo(() => transactions.filter(t => {
        const d = new Date(t.date).toISOString().split('T')[0]
        return d >= startDate && d <= endDate
    }), [transactions, startDate, endDate])

    // 2. Apply the filters shared with Analysis.
    const sharedFiltered = useMemo(
        () => filterBySharedFinanceFilters(transactions, startDate, endDate, selectedCategories),
        [transactions, startDate, endDate, selectedCategories]
    )

    // 3. Description/note search is specific to the transaction list.
    const filtered = useMemo(() => {
        let list = sharedFiltered
        if (search.trim() !== "") {
            const term = search.toLowerCase()
            list = list.filter(t =>
                t.description?.toLowerCase().includes(term) ||
                t.note?.toLowerCase().includes(term)
            )
        }
        return list
    }, [sharedFiltered, search])

    function toggleCategory(id: string) {
        const next = new Set(selectedCategories)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedCategories(next)
    }

    function toggleAllCategories() {
        if (selectedCategories.size === categories.length) setSelectedCategories(new Set())
        else setSelectedCategories(new Set(categories.map(c => c.id)))
    }

    const pendingReview = sharedFiltered.filter(transaction => !transaction.reviewed)
    const pendingIncome = sumMoney(pendingReview.filter(transaction => transaction.type === "INCOME").map(transaction => transaction.amount))
    const pendingExpense = sumMoney(pendingReview.filter(transaction => transaction.type === "EXPENSE").map(transaction => transaction.amount))

    return (
        <div className="space-y-8">
            {pendingReview.length > 0 && (
                <div role="alert" className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4 text-amber-950 shadow-sm">
                    <div className="flex items-start gap-3"><span className="text-2xl">⚠️</span><div><p className="font-black">{pendingReview.length} imported transaction(s) are excluded from all official totals</p><p className="mt-1 text-sm font-medium">Waiting for approval: {displayMoney(pendingIncome, settings)} Money In and {displayMoney(pendingExpense, settings)} Money Out. Open Review Inbox, correct the direction/category, then approve them.</p></div></div>
                </div>
            )}
            <SummaryCards transactions={sharedFiltered.filter(transaction => transaction.reviewed !== false)} settings={settings} />
            <AccountsOverview accounts={accounts} settings={settings} />
            <TransactionList 
                transactions={transactions} 
                categories={categories} 
                properties={properties}
                projects={projects}
                accounts={accounts}
                settings={settings}
                filtered={filtered}
                dateFilteredCount={dateFiltered.length}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
                search={search}
                setSearch={setSearch}
                selectedCategories={selectedCategories}
                toggleCategory={toggleCategory}
                toggleAllCategories={toggleAllCategories}
            />
        </div>
    )
}

export function TransactionList({ 
    transactions, 
    categories, 
    properties,
    projects,
    accounts,
    settings,
    filtered, 
    dateFilteredCount, 
    startDate, 
    setStartDate, 
    endDate, 
    setEndDate, 
    search,
    setSearch,
    selectedCategories,
    toggleCategory,
    toggleAllCategories
}: any) {
    // Autocomplete list
    const uniqueDescriptions = useMemo(() => {
        return Array.from(new Set(transactions.map((t: any) => t.description).filter(Boolean)))
    }, [transactions])
    
    // Pagination State
    const [pageSize, setPageSize] = useState(100)
    const [currentPage, setCurrentPage] = useState(1)

    async function handleDelete(id: string) {
        const res = await deleteTransaction(id)
        if (res.success) toast.success("Transaction deleted")
        else toast.error("Failed to delete")
    }

    // Inline Editing Logic
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingField, setEditingField] = useState<"amount" | "category" | "description" | "note" | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [showReviewOnly, setShowReviewOnly] = useState(false)
    const reviewCount = filtered.filter((transaction: any) => !transaction.reviewed).length

    function toggleSelect(id: string) {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedIds(next)
    }

    function toggleSelectAll() {
        const pageIds = paginatedTransactions.map((t: any) => t.id)
        const allPageSelected = pageIds.length > 0 && pageIds.every((id: string) => selectedIds.has(id))
        const next = new Set(selectedIds)
        pageIds.forEach((id: string) => allPageSelected ? next.delete(id) : next.add(id))
        setSelectedIds(next)
    }

    async function handleBatchDelete() {
        const ids = Array.from(selectedIds)
        const res = await deleteTransactions(ids)
        if (res.success) {
            toast.success(`Deleted ${ids.length} transactions`)
            setSelectedIds(new Set())
        } else {
            toast.error("Failed to delete")
        }
    }

    function startEdit(id: string, field: "amount" | "category" | "description" | "note", t: any) {
        if (field === "amount" && isStatementImport(t.source)) return // Locked
        if (field === "description" && isStatementImport(t.source)) return
        setEditingId(id)
        setEditingField(field)
    }

    async function saveAmount(id: string, val: string, t: any) {
        if (!val || isNaN(parseFloat(val))) {
            setEditingId(null)
            return
        }
        const formData = new FormData()
        formData.append("amount", val)
        formData.append("description", t.description || "") // Keep existing
        formData.append("categoryId", t.categoryId)   // Keep existing 
        formData.append("type", t.type)
        formData.append("date", new Date(t.date).toISOString().split('T')[0])
        formData.append("propertyId", t.propertyId || "NONE")
        formData.append("projectId", t.projectId || "NONE")
        formData.append("note", t.note || "")
        formData.append("accountId", t.accountId || "NONE")
        
        await updateTransaction(id, formData)
        setEditingId(null)
        setEditingField(null)
    }

    async function saveDescription(id: string, val: string, t: any) {
        if (val === t.description) {
            setEditingId(null)
            return
        }
        const formData = new FormData()
        formData.append("amount", t.amount.toString())
        formData.append("description", val)
        formData.append("categoryId", t.categoryId)
        formData.append("type", t.type)
        formData.append("date", new Date(t.date).toISOString().split('T')[0])
        formData.append("propertyId", t.propertyId || "NONE")
        formData.append("projectId", t.projectId || "NONE")
        formData.append("note", t.note || "")
        formData.append("accountId", t.accountId || "NONE")

        await updateTransaction(id, formData)
        setEditingId(null)
        setEditingField(null)
    }

    async function saveCategory(id: string, catId: string, t: any) {
         const formData = new FormData()
         formData.append("categoryId", catId)
         formData.append("amount", t.amount.toString())
         formData.append("description", t.description || "")
         formData.append("type", t.type)
         formData.append("date", new Date(t.date).toISOString().split('T')[0])
         formData.append("propertyId", t.propertyId || "NONE")
         formData.append("projectId", t.projectId || "NONE")
         formData.append("note", t.note || "")
         formData.append("accountId", t.accountId || "NONE")

         await updateTransaction(id, formData)
         setEditingId(null)
         setEditingField(null)
    }

    function handleExport() {
        const csvContent = Papa.unparse(filtered.map((t: any) => ({
            Date: new Date(t.date).toISOString().split("T")[0],
            Description: t.description || "",
            Note: t.note || "",
            Category: t.category?.name || "Uncategorized",
            Account: t.account?.name || "",
            Project: t.project?.name || "",
            Amount: t.amount,
            Type: t.type,
            Source: t.source || "",
        })))
        const blobUrl = URL.createObjectURL(new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8" }))
        const link = document.createElement("a")
        link.setAttribute("href", blobUrl)
        link.setAttribute("download", `iCost_Export_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)
        toast.success("CSV Exported")
    }

    async function saveNote(id: string, val: string, t: any) {
        if (val === (t.note || "")) {
            setEditingId(null)
            setEditingField(null)
            return
        }
        const formData = new FormData()
        formData.append("amount", t.amount.toString())
        formData.append("description", t.description || "")
        formData.append("categoryId", t.categoryId)
        formData.append("type", t.type)
        formData.append("date", new Date(t.date).toISOString().split('T')[0])
        formData.append("propertyId", t.propertyId || "NONE")
        formData.append("projectId", t.projectId || "NONE")
        formData.append("accountId", t.accountId || "NONE")
        formData.append("note", val)
        const result = await updateTransaction(id, formData)
        if (result.error) toast.error(result.error)
        else toast.success("Note updated")
        setEditingId(null)
        setEditingField(null)
    }

    async function handleMarkReviewed() {
        const ids = Array.from(selectedIds)
        const result = await markTransactionsReviewed(ids)
        if (result.error) return toast.error(result.error)
        toast.success(`${result.count} transactions approved`)
        setSelectedIds(new Set())
    }

    async function handleReviewType(id: string, type: "INCOME" | "EXPENSE", approve = false) {
        const result = await updateTransactionReview(id, type, approve)
        if (result.error) return toast.error(result.error)
        toast.success(approve ? "Transaction approved" : `Changed to ${type === "INCOME" ? "Money In" : "Money Out"}`)
    }

    async function handleBatchProject(projectId: string) {
        const result = await assignTransactionsToProject(Array.from(selectedIds), projectId)
        if (result.error) {
            toast.error(result.error)
            return
        }
        toast.success(projectId === "NONE" ? `Removed ${result.count} transactions from projects` : `Assigned ${result.count} transactions to project`)
        setSelectedIds(new Set())
    }

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)

    const sortedTransactions = useMemo(() => {
        const sortableItems = [...(showReviewOnly ? filtered.filter((transaction: any) => !transaction.reviewed) : filtered)]
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key]
                let bValue = b[sortConfig.key]

                // Handle special cases
                if (sortConfig.key === 'category') {
                    aValue = a.category?.name || ""
                    bValue = b.category?.name || ""
                }
                if (sortConfig.key === 'amount') {
                    // Normalize amount for sorting (income positive, expense negative)
                    aValue = a.type === 'INCOME' ? a.amount : -a.amount
                    bValue = b.type === 'INCOME' ? b.amount : -b.amount
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1
                }
                return 0
            })
        }
        return sortableItems
    }, [filtered, showReviewOnly, sortConfig])

    function handleSort(key: string) {
        let direction: 'asc' | 'desc' = 'asc'
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    // 4. Paginate
    const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / pageSize))
    const safeCurrentPage = Math.min(currentPage, totalPages)
    const paginatedTransactions = sortedTransactions.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize)
    const firstVisiblePage = Math.max(1, Math.min(safeCurrentPage - 2, totalPages - 4))
    const visiblePages = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => firstVisiblePage + index)

  return (
    <Card className="shadow-xl border-0 overflow-hidden animate-slide-up">
        {/* ... (Header content skipped for brevity, keeping existing structure) ... */}
        <CardHeader className="bg-slate-50/50 p-6">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <CardTitle className="text-2xl font-bold text-slate-900 tracking-tight">Transactions</CardTitle>
                        <CardDescription className="text-slate-500 font-medium">{filtered.length} matching / {dateFilteredCount} in period</CardDescription>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 items-center">
                        {selectedIds.size > 0 && (
                            <>
                                <Button variant="outline" size="sm" onClick={handleMarkReviewed} className="h-9 text-emerald-700">Approve {selectedIds.size}</Button>
                                <Select onValueChange={handleBatchProject}>
                                    <SelectTrigger className="w-[190px] h-9">
                                        <SelectValue placeholder={`Assign ${selectedIds.size} to project`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NONE">Remove from project</SelectItem>
                                        {projects.map((project: any) => (
                                            <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <DeleteTransactionsDialog onConfirm={handleBatchDelete} count={selectedIds.size}>
                                    <Button variant="outline" size="sm" className="text-red-600 border-red-100 hover:bg-red-50 h-9">
                                        Delete {selectedIds.size} selected
                                    </Button>
                                </DeleteTransactionsDialog>
                            </>
                        )}
                        <Button variant={showReviewOnly ? "default" : "outline"} size="sm" onClick={() => { setShowReviewOnly(value => !value); setCurrentPage(1) }} className={cn("h-9", reviewCount > 0 && !showReviewOnly && "border-amber-400 bg-amber-50 text-amber-900 font-bold")}>
                            {showReviewOnly ? "Exit Review" : "Review Inbox"} {reviewCount > 0 ? `(${reviewCount})` : ""}
                        </Button>
                        <MonthlyReportDialog transactions={filtered.filter((transaction: any) => transaction.reviewed !== false)} startDate={startDate} endDate={endDate} settings={settings} />
                        <Button variant="outline" size="sm" onClick={handleExport} className="h-9 gap-2 shadow-sm bg-white">
                            <span>📤</span> Export CSV
                        </Button>
                        <RemoveDuplicatesDialog transactions={transactions} settings={settings} />
                    </div>
                </div>

                {showReviewOnly && reviewCount > 0 && (
                    <div role="alert" className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950">
                        <p className="font-bold">Review mode: correct each transaction before approval</p>
                        <p className="mt-1 text-sm">Use the Money In / Money Out selector in the Amount column, click Category to correct it, then click Approve. Checkboxes can approve several corrected rows together.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-4 border-t border-slate-200/60">
                    <div className="md:col-span-5 relative group">
                        <Input 
                            placeholder="Search description or note..."
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)} 
                            className="h-10 w-full pl-9 bg-white border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10 transition-all shadow-sm rounded-lg"
                        />
                        <span className="absolute left-3 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors">🔍</span>
                    </div>

                    <div className="md:col-span-4 flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-3 py-1 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 transition-all">
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-0 h-8 p-0 text-xs font-semibold focus-visible:ring-0 bg-transparent flex-1" />
                        <span className="text-slate-400 px-1">→</span>
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border-0 h-8 p-0 text-xs font-semibold focus-visible:ring-0 bg-transparent flex-1" />
                    </div>

                    <div className="md:col-span-3">
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full h-10 gap-2 rounded-lg border-slate-200 bg-white hover:bg-slate-50 font-semibold shadow-sm justify-between">
                                    <div className="flex items-center gap-2 truncate">
                                        <span>📂</span> 
                                        {selectedCategories.size === categories.length ? "All Categories" : `${selectedCategories.size} Categories`}
                                    </div>
                                    <span className="text-slate-400">▼</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[340px] p-4 rounded-3xl shadow-2xl border-0" align="end">
                                <CategorySelectorContent 
                                    categories={categories} 
                                    selectedCategories={selectedCategories} 
                                    toggleCategory={toggleCategory} 
                                    toggleAllCategories={toggleAllCategories} 
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                  <Checkbox checked={paginatedTransactions.length > 0 && paginatedTransactions.every((t: any) => selectedIds.has(t.id))} onCheckedChange={toggleSelectAll} />
              </TableHead>
              <TableHead 
                  className="cursor-pointer hover:bg-slate-50 transition-colors group" 
                  onClick={() => handleSort('date')}
              >
                  <div className="flex items-center gap-1">
                      Date
                      {sortConfig?.key === 'date' && (
                          <span className="text-xs text-indigo-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                  </div>
              </TableHead>
              <TableHead 
                  className="cursor-pointer hover:bg-slate-50 transition-colors group"
                  onClick={() => handleSort('description')}
              >
                  <div className="flex items-center gap-1">
                       Description
                       {sortConfig?.key === 'description' && (
                          <span className="text-xs text-indigo-500">{sortConfig.direction === 'asc' ? 'A-Z' : 'Z-A'}</span>
                      )}
                  </div>
              </TableHead>
              <TableHead 
                  className="cursor-pointer hover:bg-slate-50 transition-colors group"
                  onClick={() => handleSort('category')}
              >
                  <div className="flex items-center gap-1">
                       Category
                       {sortConfig?.key === 'category' && (
                          <span className="text-xs text-indigo-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                  </div>
              </TableHead>
              <TableHead 
                  className="text-right cursor-pointer hover:bg-slate-50 transition-colors group"
                  onClick={() => handleSort('amount')}
              >
                  <div className="flex items-center justify-end gap-1">
                       Amount
                       {sortConfig?.key === 'amount' && (
                          <span className="text-xs text-indigo-500">{sortConfig.direction === 'asc' ? 'LOW' : 'HIGH'}</span>
                      )}
                  </div>
              </TableHead>
              <TableHead className="w-10 text-right"></TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTransactions.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground h-24">
                        No transactions found in this period
                    </TableCell>
                  </TableRow>
            ) : paginatedTransactions.map((t: any, idx: number) => (
              <TableRow key={t.id} style={{ animationDelay: `${idx * 0.05}s` }} className={cn("animate-slide-up bg-white group transition-all duration-300", selectedIds.has(t.id) ? "bg-indigo-50/50" : "hover:bg-slate-50", !t.reviewed && "border-l-4 border-l-amber-400")}>
                <TableCell>
                    <Checkbox checked={selectedIds.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} />
                </TableCell>
                <TableCell className="font-medium text-xs text-slate-500 whitespace-nowrap">{formatDate(t.date)}</TableCell>
                <TableCell
                    onClick={() => { if (!isStatementImport(t.source)) startEdit(t.id, 'description', t) }}
                    onDoubleClick={() => { if (isStatementImport(t.source)) startEdit(t.id, 'note', t) }}
                >
                    {editingId === t.id && editingField === 'description' ? (
                        <Input 
                            defaultValue={t.description} 
                            autoFocus 
                            className="h-8 w-full"
                            list="descriptions-list-inline"
                            onBlur={(e) => saveDescription(t.id, e.target.value, t)}
                            onKeyDown={(e) => { if(e.key === 'Enter') saveDescription(t.id, e.currentTarget.value, t) }}
                        />
                    ) : editingId === t.id && editingField === 'note' ? (
                        <Input
                            defaultValue={t.note || ""}
                            autoFocus
                            className="h-8 w-full"
                            placeholder="Add a note for this imported transaction"
                            onBlur={(e) => saveNote(t.id, e.target.value, t)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveNote(t.id, e.currentTarget.value, t) }}
                        />
                    ) : (
                        <div className={cn("flex flex-col group/desc", isStatementImport(t.source) ? "cursor-text" : "cursor-pointer")} title={isStatementImport(t.source) ? "Description is locked. Double-click to edit the note." : t.description}>
                            <div className="font-medium truncate max-w-[200px] lg:max-w-[400px]">{t.description || "No description"}</div>
                            {t.note && <div className="text-xs text-slate-500 mt-1 line-clamp-2 max-w-[240px] lg:max-w-[420px]">{t.note}</div>}
                            <div className="flex flex-wrap gap-1 mt-1">
                                {t.project && <span className="text-[10px] w-fit bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded-full">📌 {t.project.name}</span>}
                                {t.account && <span className="text-[10px] w-fit bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{t.account.name}</span>}
                                {isStatementImport(t.source) && <span className="text-[10px] w-fit bg-blue-50 text-blue-600 px-1 rounded">IMPORTED</span>}
                                {!t.reviewed && <span className="text-[10px] w-fit bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">⚠ NEEDS REVIEW</span>}
                                {t.reviewReason && <span className="text-[10px] w-fit bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-bold" title={t.reviewReason}>ISSUE: {t.reviewReason}</span>}
                            </div>
                        </div>
                    )}
                </TableCell>
                <TableCell onClick={() => startEdit(t.id, 'category', t)}>
                    {editingId === t.id && editingField === 'category' ? (
                         <Popover open={true} onOpenChange={() => setEditingId(null)}>
                             <PopoverTrigger asChild><span className="opacity-0">.</span></PopoverTrigger>
                             <PopoverContent className="w-[300px] p-2" align="start">
                                 <div className="grid grid-cols-4 gap-2">
                                     {categories.filter((c: any) => c.type === t.type).map((c: any) => (
                                         <button key={c.id} onClick={() => saveCategory(t.id, c.id, t)} className={cn("flex flex-col items-center p-2 rounded hover:bg-slate-100", t.categoryId === c.id && "bg-slate-100 ring-1 ring-slate-300")}>
                                             <span className="text-xl">{c.icon}</span>
                                             <span className="text-[10px] truncate w-full text-center">{c.name}</span>
                                         </button>
                                     ))}
                                 </div>
                             </PopoverContent>
                         </Popover>
                    ) : ( 
                        <span className={cn("px-2 py-1 rounded-full text-xs font-medium bg-slate-100 cursor-pointer hover:ring-1 ring-slate-300", t.category?.color)} title="Click to edit">
                             {t.category?.icon} {t.category?.name || "Uncategorized"}
                        </span>
                    )}
                 </TableCell>
                <TableCell className={cn("text-right font-semibold", t.type === 'INCOME' ? "text-emerald-600" : "text-rose-600")} onClick={() => { if (!showReviewOnly || t.reviewed) startEdit(t.id, 'amount', t) }}>
                    {editingId === t.id && editingField === 'amount' ? (
                        <Input 
                            type="number" 
                            step="0.01" 
                            defaultValue={t.amount} 
                            autoFocus 
                            className="h-8 w-24 text-right inline-block"
                            onBlur={(e) => saveAmount(t.id, e.target.value, t)}
                            onKeyDown={(e) => { if(e.key === 'Enter') saveAmount(t.id, e.currentTarget.value, t) }}
                        />
                    ) : showReviewOnly && !t.reviewed ? (
                        <div className="flex flex-col items-end gap-1">
                            <Select value={t.type} onValueChange={value => handleReviewType(t.id, value as "INCOME" | "EXPENSE")}><SelectTrigger className={cn("h-9 w-36 font-bold", t.type === "INCOME" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-rose-300 bg-rose-50 text-rose-700")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EXPENSE">↓ Money Out</SelectItem><SelectItem value="INCOME">↑ Money In</SelectItem></SelectContent></Select>
                            {t.reviewReason && <span className="max-w-56 text-right text-[10px] leading-tight text-amber-700">⚠ {t.reviewReason}</span>}
                        </div>
                    ) : (
                        <span title={isStatementImport(t.source) ? "Locked" : "Click to edit"} className={cn("cursor-pointer", !isStatementImport(t.source) && "hover:underline decoration-dashed")}>
                            {t.type === 'INCOME' ? '+' : '-'}{displayMoney(t.amount, settings)}
                        </span>
                    )}
                </TableCell>
                <TableCell className="text-right">
                    <DeleteTransactionDialog onDelete={() => handleDelete(t.id)}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-500">
                            ×
                        </Button>
                    </DeleteTransactionDialog>
                </TableCell>
                <TableCell className={cn("text-right transition-opacity", !t.reviewed ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                    {!t.reviewed ? (
                        <Button type="button" size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleReviewType(t.id, t.type, true)}>Approve</Button>
                    ) : <EditTransactionDialog transaction={t} categories={categories} properties={properties} projects={projects} accounts={accounts} settings={settings} uniqueDescriptions={uniqueDescriptions}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-500 transition-colors">✎</Button>
                    </EditTransactionDialog>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <datalist id="descriptions-list-inline">
            {uniqueDescriptions.map((desc: any) => (
                <option key={desc} value={desc} />
            ))}
        </datalist>
      </CardContent>

      <div className="p-4 border-t bg-slate-50/30 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                  <span>Show</span>
                  <Select value={pageSize.toString()} onValueChange={(val) => { setPageSize(parseInt(val)); setCurrentPage(1); }}>
                      <SelectTrigger className="w-20 h-8">
                          <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="10000">All</SelectItem>
                      </SelectContent>
                  </Select>
                  <span>records</span>
              </div>
              <span className="hidden sm:inline">Showing {Math.min(filtered.length, (safeCurrentPage-1)*pageSize + 1)}-{Math.min(filtered.length, safeCurrentPage*pageSize)} of {filtered.length}</span>
          </div>

          <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage(safeCurrentPage - 1)}
                className="h-8"
              >
                  Prev
              </Button>
              <div className="flex items-center gap-1">
                  {visiblePages.map((page) => (
                      <Button 
                        key={page}
                        variant={safeCurrentPage === page ? "default" : "ghost"}
                        size="sm" 
                        onClick={() => setCurrentPage(page)}
                        className="h-8 w-8 p-0"
                      >
                          {page}
                      </Button>
                  ))}
                  {totalPages > 5 && <span className="text-slate-400 px-1">...</span>}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage(safeCurrentPage + 1)}
                className="h-8"
              >
                  Next
              </Button>
          </div>
      </div>
    </Card>
  )
}

export function AddTransactionButton({ categories, properties, projects, accounts, transactions = [], settings }: { categories: any[], properties: any[], projects: any[], accounts: any[], transactions?: any[], settings?: any }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"category" | "details">("category")
  const [type, setType] = useState<"INCOME" | "EXPENSE">("EXPENSE")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  
  const uniqueDescriptions = useMemo(() => {
      return Array.from(new Set(transactions.map((t: any) => t.description).filter(Boolean)))
  }, [transactions])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault()
      const formData = new FormData(e.currentTarget)
      formData.append("categoryId", selectedCategory)
      formData.append("type", type)
      const result = await addTransaction(formData)
      if (result.error) {
          toast.error(result.error)
          return
      }
      toast.success(`${type === "INCOME" ? "Income" : "Expense"} added`)
      setOpen(false)
      reset()
  }

  function reset() {
      setStep("category")
      setSelectedCategory("")
      setType("EXPENSE")
  }

  function handleCategorySelect(id: string) {
      setSelectedCategory(id)
      setStep("details")
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
        setOpen(val)
        if (!val) setTimeout(reset, 300)
    }}>
      <DialogTrigger asChild>
        <Button size="lg" className="rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700">Add Transaction +</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <TransactionForm 
            categories={categories} 
            properties={properties} 
            projects={projects}
            accounts={accounts}
            settings={settings}
            step={step} 
            setStep={setStep}
            type={type}
            setType={setType}
            selectedCategory={selectedCategory}
            handleCategorySelect={handleCategorySelect}
            onSubmit={onSubmit}
            uniqueDescriptions={uniqueDescriptions}
        />
      </DialogContent>
    </Dialog>
  )
}

function TransactionForm({ categories, properties, projects, accounts, settings, step, setStep, type, setType, selectedCategory, handleCategorySelect, onSubmit, initialData, uniqueDescriptions = [] }: any) {
  const isImported = isStatementImport(initialData?.source)
  const isEditing = Boolean(initialData)
  return (
        <>
        <DialogHeader>
          <DialogTitle>
              {isEditing ? "Edit Transaction" : step === "category" ? (
                  <div className="flex gap-4 justify-center">
                      <button type="button" disabled={isImported} onClick={() => setType("EXPENSE")} className={cn("px-4 py-1 rounded-full text-sm font-medium transition-colors", type==="EXPENSE" ? "bg-rose-100 text-rose-600" : "text-slate-400", isImported && "opacity-50 cursor-not-allowed")}>Expense</button>
                      <button type="button" disabled={isImported} onClick={() => setType("INCOME")} className={cn("px-4 py-1 rounded-full text-sm font-medium transition-colors", type==="INCOME" ? "bg-emerald-100 text-emerald-600" : "text-slate-400", isImported && "opacity-50 cursor-not-allowed")}>Income</button>
                  </div>
              ) : type === "INCOME" ? "Income Details" : "Expense Details"}
          </DialogTitle>
          {step === "details" && isImported && <p className="text-xs text-center text-amber-600 bg-amber-50 py-1 rounded">Imported Record: Amount & Date locked</p>}
          {step === "details" && !isImported && !isEditing && (
             <div className="text-center">
                 <span className="text-sm text-muted-foreground mr-2">Category: {categories.find((c:any) => c.id === selectedCategory)?.name}</span>
                 <Button type="button" variant="link" size="sm" onClick={() => setStep("category")} className="h-auto p-0 text-indigo-600">Change</Button>
             </div>
          )}
        </DialogHeader>
        
        {step === "category" ? (
             <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 py-4 max-h-[50vh] overflow-y-auto">
                 {categories.filter((c:any) => c.type === type).map((c:any) => (
                     <button
                        key={c.id}
                        type="button"
                        onClick={() => handleCategorySelect(c.id)}
                        className={cn(
                            "flex flex-col items-center justify-center p-2 rounded-lg border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md transition-all h-20 w-full",
                            c.color?.split(' ')[0]
                        )}
                     >
                         <span className="text-2xl mb-1">{c.icon || "📦"}</span>
                         <span className="text-[10px] font-medium text-slate-700 truncate w-full text-center">{c.name}</span>
                     </button>
                 ))}
             </div>
        ) : (
             <form onSubmit={onSubmit} className="grid gap-5 py-2">
                {isEditing && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-type">Type</Label>
                            <Select
                                value={type}
                                disabled={isImported}
                                onValueChange={(nextType) => {
                                    setType(nextType)
                                    const currentCategoryMatches = categories.some((category: any) => category.id === selectedCategory && category.type === nextType)
                                    if (!currentCategoryMatches) {
                                        handleCategorySelect(categories.find((category: any) => category.type === nextType)?.id || "")
                                    }
                                }}
                            >
                                <SelectTrigger id="edit-type"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="EXPENSE">Expense</SelectItem>
                                    <SelectItem value="INCOME">Income</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-category">Category</Label>
                            <Select value={selectedCategory} onValueChange={handleCategorySelect}>
                                <SelectTrigger id="edit-category"><SelectValue placeholder="Select category" /></SelectTrigger>
                                <SelectContent>
                                    {categories.filter((category: any) => category.type === type).map((category: any) => (
                                        <SelectItem key={category.id} value={category.id}>{category.icon} {category.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                <div className="grid gap-2">
                    <Label htmlFor="amount">Amount {isImported && <span className="text-xs text-muted-foreground">(Locked)</span>}</Label>
                    <div className="relative">
                        <span className={cn("absolute left-3 top-2.5 text-lg font-bold", type==="INCOME" ? "text-emerald-500" : "text-rose-500")}>{displayCurrencySymbol(settings)}</span>
                        <Input id="amount" name="amount" type="number" step="0.01" className="pl-8 text-xl font-bold h-12" required autoFocus={!isImported} defaultValue={initialData?.amount} readOnly={isImported} />
                         {isImported && <input type="hidden" name="amount" value={initialData?.amount} />}
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="date">Date</Label>
                        <Input id="date" name="date" type="date" required defaultValue={initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} readOnly={isImported} />
                         {isImported && <input type="hidden" name="date" value={initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : ''} />}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="desc">Description</Label>
                        <Input id="desc" name="description" placeholder="Type or select..." defaultValue={initialData?.description} list="descriptions-list" readOnly={isImported} className={cn(isImported && "bg-slate-100 text-slate-500 cursor-not-allowed")} />
                        <datalist id="descriptions-list">
                            {uniqueDescriptions.map((desc: string) => (
                                <option key={desc} value={desc} />
                            ))}
                        </datalist>
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="note">Note (optional)</Label>
                    <textarea
                        id="note"
                        name="note"
                        rows={3}
                        maxLength={1000}
                        placeholder="Add details, context, or anything you want to search later..."
                        defaultValue={initialData?.note || ""}
                        className="flex min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="accountId">Account</Label>
                    <Select name="accountId" defaultValue={initialData?.accountId || accounts[0]?.id} required>
                        <SelectTrigger id="accountId"><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>
                            {accounts.map((account: any) => (
                                <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {(properties.length > 0 || projects.length > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {properties.length > 0 && (
                    <div className="grid gap-2">
                        <Label htmlFor="propertyId">Property (optional)</Label>
                        <Select name="propertyId" defaultValue={initialData?.propertyId || "NONE"}>
                            <SelectTrigger id="propertyId">
                                <SelectValue placeholder="No property" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="NONE">No property</SelectItem>
                                {properties.map((property: any) => (
                                    <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    )}
                    {projects.length > 0 && (
                    <div className="grid gap-2">
                        <Label htmlFor="projectId">Project (optional)</Label>
                        <Select name="projectId" defaultValue={initialData?.projectId || "NONE"}>
                            <SelectTrigger id="projectId">
                                <SelectValue placeholder="No project" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="NONE">No project</SelectItem>
                                {projects.map((project: any) => (
                                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    )}
                    </div>
                )}

                {!isImported && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="grid gap-2">
                            <Label htmlFor="frequency" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recurrence</Label>
                            <Select name="frequency" defaultValue="NONE">
                                <SelectTrigger id="frequency" className="h-9 rounded-xl bg-white border-slate-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NONE">One-time</SelectItem>
                                    <SelectItem value="DAILY">Daily</SelectItem>
                                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                                    <SelectItem value="YEARLY">Yearly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="repeatUntil" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Repeat Until</Label>
                            <Input id="repeatUntil" name="repeatUntil" type="date" className="h-9 rounded-xl bg-white border-slate-200" />
                        </div>
                    </div>
                )}

                <div className="flex gap-3 mt-2">
                     {!isEditing && <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("category")}>Back</Button>}
                     <Button type="submit" className={cn("flex-1", type==="INCOME" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700")}>
                         {isEditing ? "Save Changes" : `Save ${type === "INCOME" ? "Income" : "Expense"}`}
                     </Button>
                </div>
            </form>
        )}
        </>
  )
}

function EditTransactionDialog({ transaction, categories, properties, projects, accounts, settings, children, uniqueDescriptions = [] }: any) {
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState<"category" | "details">("details")
    const [type, setType] = useState<"INCOME" | "EXPENSE">(transaction.type)
    const [selectedCategory, setSelectedCategory] = useState<string>(transaction.categoryId)

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        formData.append("categoryId", selectedCategory)
        formData.append("type", type)
        const result = await updateTransaction(transaction.id, formData)
        if (result.error) {
            toast.error(result.error)
            return
        }
        toast.success("Transaction updated")
        setOpen(false)
    }

    function handleCategorySelect(id: string) {
        setSelectedCategory(id)
        setStep("details")
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <TransactionForm
                    categories={categories}
                    properties={properties}
                    projects={projects}
                    accounts={accounts}
                    settings={settings}
                    step={step}
                    setStep={setStep}
                    type={type}
                    setType={setType}
                    selectedCategory={selectedCategory}
                    handleCategorySelect={handleCategorySelect}
                    onSubmit={onSubmit}
                    initialData={transaction}
                    uniqueDescriptions={uniqueDescriptions}
                />
            </DialogContent>
        </Dialog>
    )
}

export function AnalysisCharts({ transactions, categories, properties, projects, settings }: { transactions: any[], categories: any[], properties: any[], projects: any[], settings?: any }) {
    const now = new Date()
    const [startDate, setStartDate] = useState<string>(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
    const [endDate, setEndDate] = useState<string>(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0])
    
    // Default to all category IDs
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(categories.map(c => c.id)))
    const filtersRestored = useRef(false)

    useEffect(() => {
        if (filtersRestored.current) return

        const saved = readStoredFinanceFilters()
        if (!saved) {
            filtersRestored.current = true
            return
        }

        const validCategoryIds = new Set(categories.map(category => category.id))
        const restoredCategories = Array.isArray(saved.categoryIds)
            ? saved.categoryIds.filter(id => validCategoryIds.has(id))
            : categories.map(category => category.id)

        queueMicrotask(() => {
            if (saved.startDate) setStartDate(saved.startDate)
            if (saved.endDate) setEndDate(saved.endDate)
            setSelectedCategories(new Set(restoredCategories))
            filtersRestored.current = true
        })
    }, [categories])

    useEffect(() => {
        if (!filtersRestored.current) return
        saveStoredFinanceFilters({
            startDate,
            endDate,
            categoryIds: Array.from(selectedCategories),
        })
    }, [startDate, endDate, selectedCategories])

    const filteredTransactions = useMemo(
        () => filterBySharedFinanceFilters(transactions, startDate, endDate, selectedCategories).filter(transaction => transaction.reviewed !== false),
        [transactions, startDate, endDate, selectedCategories]
    )

    function toggleCategory(id: string) {
        const next = new Set(selectedCategories)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedCategories(next)
    }

    function toggleAllCategories() {
        if (selectedCategories.size === categories.length) setSelectedCategories(new Set())
        else setSelectedCategories(new Set(categories.map(c => c.id)))
    }

    // 1. Prepare Pie Chart Data (Expenses by Category)
    const categoryData = useMemo(() => {
        const catTotals = categories.map(cat => {
            const total = sumMoney(filteredTransactions
                .filter(t => t.type === 'EXPENSE' && t.categoryId === cat.id)
                .map(t => t.amount))
            return { name: cat.name, value: total }
        }).filter(d => d.value > 0).sort((a, b) => b.value - a.value)
        
        return catTotals
    }, [filteredTransactions, categories])

    const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly">("monthly")

    // Helper to get week number
    const getWeek = (date: Date) => {
        const d = new Date(date)
        d.setHours(0, 0, 0, 0)
        d.setDate(d.getDate() + 4 - (d.getDay() || 7))
        const yearStart = new Date(d.getFullYear(), 0, 1)
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    }

    // 2. Prepare Time Series Data
    const timeSeriesData = useMemo(() => {
        const dataMap: Record<string, { label: string, income: number, expense: number, net: number, sortKey: string }> = {}
        
        filteredTransactions.forEach(t => {
            const d = new Date(t.date)
            let key = ""
            let label = ""
            let sortKey = ""

            if (viewMode === "daily") {
                key = d.toISOString().split('T')[0]
                label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
                sortKey = key
            } else if (viewMode === "weekly") {
                const week = getWeek(d)
                key = `${d.getFullYear()}-W${week}`
                label = `W${week} ${d.getFullYear().toString().slice(2)}`
                sortKey = key
            } else {
                key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
                label = key
                sortKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
            }

            if (!dataMap[key]) dataMap[key] = { label, income: 0, expense: 0, net: 0, sortKey }
            if (t.type === 'INCOME') dataMap[key].income = roundMoney(dataMap[key].income + t.amount)
            else dataMap[key].expense = roundMoney(dataMap[key].expense + t.amount)
            dataMap[key].net = roundMoney(dataMap[key].income - dataMap[key].expense)
        })

        return Object.values(dataMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    }, [filteredTransactions, viewMode])

    const COLORS = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#94a3b8']

    // 3. Performance by Property
    const propertyData = useMemo(() => {
        const props: Record<string, { name: string, income: number, expense: number }> = {}
        filteredTransactions.forEach(t => {
            if (t.propertyId) {
                const pname = properties.find(p => p.id === t.propertyId)?.name || "Unknown"
                if (!props[t.propertyId]) props[t.propertyId] = { name: pname, income: 0, expense: 0 }
                if (t.type === "INCOME") props[t.propertyId].income = roundMoney(props[t.propertyId].income + t.amount)
                else props[t.propertyId].expense = roundMoney(props[t.propertyId].expense + t.amount)
            }
        })
        return Object.values(props).map(p => ({
            name: p.name,
            profit: roundMoney(p.income - p.expense)
        }))
    }, [filteredTransactions, properties])

    const projectData = useMemo(() => projects.map(project => {
        const transactionsForProject = filteredTransactions.filter(t => t.projectId === project.id)
        const expense = sumMoney(transactionsForProject.filter(t => t.type === "EXPENSE").map(t => t.amount))
        const income = sumMoney(transactionsForProject.filter(t => t.type === "INCOME").map(t => t.amount))
        return {
            id: project.id,
            name: project.name,
            count: transactionsForProject.length,
            expense,
            income,
            netCost: roundMoney(expense - income),
        }
    }).filter(project => project.count > 0).sort((a, b) => b.expense - a.expense), [filteredTransactions, projects])

    return (
        <div className="space-y-6">
            <SummaryCards transactions={filteredTransactions} settings={settings} />

            <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex flex-col gap-1">
                    <CardTitle className="text-2xl font-black text-slate-900 tracking-tight">Analysis & Insights</CardTitle>
                    <p className="text-slate-500 text-sm font-medium">{filteredTransactions.length} records in selection</p>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    {/* View Mode Switcher */}
                    <div className="flex border border-slate-200 rounded-xl p-1 bg-slate-50 shadow-inner">
                        {(['daily', 'weekly', 'monthly'] as const).map(mode => (
                            <Button 
                                key={mode} 
                                variant={viewMode === mode ? "default" : "ghost"} 
                                size="sm" 
                                className={cn("h-8 capitalize px-4 rounded-lg transition-all", viewMode === mode ? "shadow-sm bg-white text-slate-900 hover:bg-white" : "text-slate-500")}
                                onClick={() => setViewMode(mode)}
                            >
                                {mode}
                            </Button>
                        ))}
                    </div>

                    {/* Date Range Selection */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-1.5 shadow-inner">
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-0 h-7 p-0 text-xs font-bold focus-visible:ring-0 bg-transparent w-28" />
                        <span className="text-slate-400 font-bold">→</span>
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border-0 h-7 p-0 text-xs font-bold focus-visible:ring-0 bg-transparent w-28" />
                    </div>

                    {/* Category Multi-Select Checkboxes (Box Style) */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-10 px-4 gap-2 rounded-xl border-slate-200 hover:bg-slate-50 font-semibold shadow-sm">
                                <span>📂</span> Categories ({selectedCategories.size})
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[320px] p-4 rounded-3xl shadow-2xl border-0" align="end">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter by category</span>
                                    <Button variant="ghost" size="sm" onClick={toggleAllCategories} className="h-7 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 rounded-lg">
                                        {selectedCategories.size === categories.length ? "UNSELECT ALL" : "SELECT ALL"}
                                    </Button>
                                </div>
                                <div className="grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto pr-1 pt-1">
                                    {categories.map((c: any) => (
                                        <div 
                                            key={c.id} 
                                            className={cn(
                                                "relative flex flex-col items-center justify-center p-3 rounded-2xl cursor-pointer transition-all border-2",
                                                selectedCategories.has(c.id) 
                                                    ? "bg-indigo-50 border-indigo-200" 
                                                    : "bg-slate-50 border-transparent grayscale opacity-60 hover:grayscale-0 hover:opacity-100 hover:border-slate-200"
                                            )}
                                            onClick={() => toggleCategory(c.id)}
                                        >
                                            <Checkbox 
                                                checked={selectedCategories.has(c.id)} 
                                                onCheckedChange={() => toggleCategory(c.id)} 
                                                onClick={(event) => event.stopPropagation()}
                                                id={`cat-${c.id}`} 
                                                className="absolute top-2 right-2 w-4 h-4 rounded-md border-slate-300" 
                                            />
                                            <span className="text-2xl mb-1">{c.icon}</span>
                                            <span className="text-[10px] font-bold text-slate-700 text-center truncate w-full">{c.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Time Trend with Trend Line */}
                <Card className="shadow-lg border-0 animate-slide-up md:col-span-2" style={{ animationDelay: '0.1s' }}>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase">{viewMode} trend & performance</CardTitle>
                        <div className="flex items-center gap-4 text-xs font-semibold">
                            <div className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded-sm" /> Income</div>
                            <div className="flex items-center gap-1"><span className="w-3 h-3 bg-rose-500 rounded-sm" /> Expense</div>
                            <div className="flex items-center gap-1"><span className="w-3 h-3 bg-indigo-500 rounded-full" /> Net Trend</div>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={timeSeriesData}>
                                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => displayMoney(value, settings)} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    formatter={(value: any) => [displayMoney(parseFloat(value), settings), '']}
                                />
                                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.8} barSize={viewMode === 'daily' ? 10 : 30} />
                                <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} opacity={0.8} barSize={viewMode === 'daily' ? 10 : 30} />
                                <Line 
                                    type="monotone" 
                                    dataKey="net" 
                                    stroke="#6366f1" 
                                    strokeWidth={3} 
                                    dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Category Breakdown */}
                <Card className="shadow-lg border-0 animate-slide-up">
                    <CardHeader><CardTitle className="text-sm font-medium text-slate-500 uppercase">Expense Breakdown</CardTitle></CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                    {categoryData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Property Performance */}
                {propertyData.length > 0 && (
                    <Card className="shadow-lg border-0 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-slate-500 uppercase">Property Performance (Profit/Loss)</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={propertyData} layout="vertical" margin={{ left: 20 }}>
                                    <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => displayMoney(value, settings)} />
                                    <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Bar dataKey="profit" radius={[0, 4, 4, 0]} barSize={30}>
                                        {propertyData.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? "#10b981" : "#f43f5e"} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {projectData.length > 0 && (
                    <Card className="shadow-lg border-0 animate-slide-up md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-slate-500 uppercase">Project Cost Summary</CardTitle>
                            <CardDescription>Totals follow the active date and category filters.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Project</TableHead>
                                        <TableHead className="text-right">Transactions</TableHead>
                                        <TableHead className="text-right">Expenses</TableHead>
                                        <TableHead className="text-right">Income</TableHead>
                                        <TableHead className="text-right">Net Cost</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {projectData.map(project => (
                                        <TableRow key={project.id}>
                                            <TableCell className="font-bold text-slate-800">📌 {project.name}</TableCell>
                                            <TableCell className="text-right text-slate-500">{project.count}</TableCell>
                                            <TableCell className="text-right font-semibold text-rose-600">{displayMoney(project.expense, settings)}</TableCell>
                                            <TableCell className="text-right font-semibold text-emerald-600">{displayMoney(project.income, settings)}</TableCell>
                                            <TableCell className="text-right font-black text-violet-700">{displayMoney(project.netCost, settings)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}

type CSVPreviewTransaction = ImportTransaction & {
    isDuplicate: boolean
}

type InboxFile = { name: string; size: number; modifiedAt: string; hash: string; imported: boolean; error?: string }

export function CSVImport({ existingTransactions, settings, importProfiles = [], categories = [] }: { existingTransactions: any[], settings?: any, importProfiles?: any[], categories?: any[] }) {
    const [open, setOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [previewData, setPreviewData] = useState<CSVPreviewTransaction[]>([])
    const [status, setStatus] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)
    const [headers, setHeaders] = useState<string[]>([])
    const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
    const [mapping, setMapping] = useState<CSVMapping>(EMPTY_CSV_MAPPING)
    const [profileName, setProfileName] = useState("")
    const [format, setFormat] = useState<"csv" | "ofx" | "qfx">("csv")
    const [fileHash, setFileHash] = useState("")
    const [origin, setOrigin] = useState<"UPLOAD" | "NAS_INBOX">("UPLOAD")
    const [inboxFiles, setInboxFiles] = useState<InboxFile[]>([])
    const [inboxDirectory, setInboxDirectory] = useState("")
    const [isScanning, setIsScanning] = useState(false)

    function markDuplicates(items: ImportTransaction[]) {
        const knownKeys = new Set(existingTransactions.map(et => `${new Date(et.date).toISOString().split('T')[0]}-${roundMoney(et.amount)}-${et.description || ""}-${et.type}`))
        const knownExternalIds = new Set(existingTransactions.flatMap(et => et.externalId ? [et.externalId] : []))
        return items.map(item => {
            const key = `${new Date(item.date).toISOString().split('T')[0]}-${roundMoney(item.amount)}-${item.description || ""}-${item.type}`
            const isDuplicate = (item.externalId ? knownExternalIds.has(item.externalId) : false) || knownKeys.has(key)
            knownKeys.add(key)
            if (item.externalId) knownExternalIds.add(item.externalId)
            return { ...item, isDuplicate }
        })
    }
    
    function buildPreview(rows: Record<string, string>[], nextMapping: CSVMapping) {
        if (!nextMapping.dateColumn || !nextMapping.descriptionColumn || (!nextMapping.amountColumn && nextMapping.debitColumn === "NONE" && nextMapping.creditColumn === "NONE")) {
            setPreviewData([])
            setStatus("Choose date, description, and either amount or debit/credit columns.")
            return
        }
        const parsed = mapCSVRows(rows, nextMapping)
        setPreviewData(markDuplicates(parsed.transactions))
        setStatus(parsed.invalidRows ? `${parsed.invalidRows} invalid row(s) were skipped.` : `${parsed.transactions.length} rows ready for review.`)
    }

    function applyMapping(nextMapping: CSVMapping) {
        setMapping(nextMapping)
        buildPreview(rawRows, nextMapping)
    }

    async function sha256(file: File) {
        const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
        return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("")
    }

    async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return
        if (selectedFile.size > 10 * 1024 * 1024) return toast.error("Import files must be 10 MB or smaller.")
        const selectedFormat = statementFileType(selectedFile.name)
        if (!selectedFormat) return toast.error("Choose a CSV, OFX, or QFX statement.")
        setFile(selectedFile)
        setFormat(selectedFormat)
        setOrigin("UPLOAD")
        setFileHash(await sha256(selectedFile))
        setStatus("")
        const parsedFile = parseStatementText(selectedFile.name, await selectedFile.text())
        if (parsedFile.type === "csv" && parsedFile.csv) {
                const columns = parsedFile.csv.headers
                const matchingProfile = importProfiles.find(profile => {
                    const amountColumns = [profile.amountColumn, profile.debitColumn, profile.creditColumn].filter(Boolean)
                    return [profile.dateColumn, profile.descriptionColumn, ...amountColumns].every(column => columns.includes(column))
                })
                const detected: CSVMapping = matchingProfile ? {
                    dateColumn: matchingProfile.dateColumn,
                    descriptionColumn: matchingProfile.descriptionColumn,
                    amountColumn: matchingProfile.amountColumn,
                    debitColumn: matchingProfile.debitColumn || "NONE",
                    creditColumn: matchingProfile.creditColumn || "NONE",
                    typeColumn: matchingProfile.typeColumn || "NONE",
                } : detectCSVMapping(columns)
                setHeaders(columns)
                setRawRows(parsedFile.csv.rows)
                setMapping(detected)
                if (matchingProfile) setProfileName(matchingProfile.name)
                buildPreview(parsedFile.csv.rows, detected)
                if (parsedFile.csv.warnings.length) setStatus(`CSV parsing warning: ${parsedFile.csv.warnings[0]}`)
        } else {
            setHeaders([])
            setRawRows([])
            setPreviewData(markDuplicates(parsedFile.transactions))
            setStatus(`${parsedFile.transactions.length} ${selectedFormat.toUpperCase()} transactions ready for review.`)
        }
    }

    async function saveMapping() {
        const data = new FormData()
        data.set("name", profileName)
        Object.entries(mapping).forEach(([key, value]) => data.set(key, value))
        const result = await saveImportProfile(data)
        if (result.error) return toast.error(result.error)
        toast.success("Bank mapping saved")
    }

    function setPreviewCategory(index: number, categoryId: string) {
        setPreviewData(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, categoryId } : item))
    }

    function setPreviewType(index: number, type: "INCOME" | "EXPENSE") {
        setPreviewData(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, type, categoryId: undefined, reviewReason: undefined } : item))
    }

    async function createRuleFromPreview(item: CSVPreviewTransaction) {
        if (!item.categoryId) return toast.error("Choose a category first")
        const data = new FormData()
        data.set("name", `${item.description.slice(0, 40)} → category`)
        data.set("pattern", item.description)
        data.set("matchType", "CONTAINS")
        data.set("categoryId", item.categoryId)
        const result = await addCategoryRule(data)
        if (result.error) return toast.error(result.error)
        toast.success("Auto-categorization rule created")
    }

    async function scanInbox() {
        setIsScanning(true)
        const result = await scanImportInbox()
        setIsScanning(false)
        if (result.error || !result.files) return toast.error(result.error || "Inbox scan failed")
        setInboxFiles(result.files)
        setInboxDirectory(result.directory || "")
        if (!result.files.length) toast.info("No CSV, OFX, or QFX files were found in the inbox.")
    }

    async function openInboxFile(item: InboxFile) {
        setIsLoading(true)
        const result = await previewInboxFile(item.name)
        setIsLoading(false)
        if (result.error || !result.success || !result.format) return toast.error(result.error || "Preview failed")
        setFile(new File([], item.name))
        setFileHash(result.fileHash || item.hash)
        setFormat(result.format)
        setOrigin("NAS_INBOX")
        if (result.format === "csv" && result.csv) {
            const columns = result.csv.headers
            const matchingProfile = importProfiles.find(profile => {
                const amountColumns = [profile.amountColumn, profile.debitColumn, profile.creditColumn].filter(Boolean)
                return [profile.dateColumn, profile.descriptionColumn, ...amountColumns].every(column => columns.includes(column))
            })
            const detected: CSVMapping = matchingProfile ? {
                dateColumn: matchingProfile.dateColumn,
                descriptionColumn: matchingProfile.descriptionColumn,
                amountColumn: matchingProfile.amountColumn,
                debitColumn: matchingProfile.debitColumn || "NONE",
                creditColumn: matchingProfile.creditColumn || "NONE",
                typeColumn: matchingProfile.typeColumn || "NONE",
            } : detectCSVMapping(columns)
            setHeaders(columns)
            setRawRows(result.csv.rows)
            setMapping(detected)
            setProfileName(matchingProfile?.name || "")
            buildPreview(result.csv.rows, detected)
        } else {
            setHeaders([])
            setRawRows([])
            setPreviewData(markDuplicates(result.transactions || []))
            setStatus(`${result.transactions?.length || 0} ${result.format.toUpperCase()} transactions ready for review.`)
        }
    }

    function removeDuplicatesFromPreview() {
        setPreviewData(prev => prev.filter(p => !p.isDuplicate));
        toast.info("Duplicates removed from import list");
    }

    async function handleUpload() {
        if (previewData.length === 0) return
        setIsLoading(true)
        setStatus("Uploading...")
        
        const res = await importTransactions(previewData, {
            filename: file?.name,
            fileHash: fileHash || undefined,
            origin,
            format,
        })
        setIsLoading(false)

        if (res.success) {
            const skipped = res.skipped || 0
            toast.success(res.alreadyImported ? "This exact file was already imported." : `Imported ${res.count} transactions${skipped ? `; skipped ${skipped} duplicates` : ""}`)
            setOpen(false)
            setFile(null)
            setPreviewData([])
            setStatus("")
            setFileHash("")
        } else {
            toast.error(res.error || "Upload failed")
            setStatus(`Error: ${res.error || "Upload failed"}`)
        }
    }

    return (
        <Dialog open={open} onOpenChange={value => { setOpen(value); if (value && !file) void scanInbox() }}>
            <DialogTrigger asChild><Button variant="outline">Import Statements</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[950px] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <DialogTitle>Import Bank Statements</DialogTitle>
                        <DialogDescription>Upload CSV, OFX, or QFX, or select a statement from the NAS inbox. Yellow rows are duplicates.</DialogDescription>
                    </div>
                    {file && previewData.some(p => p.isDuplicate) && (
                        <Button variant="outline" size="sm" onClick={removeDuplicatesFromPreview} className="text-amber-600 border-amber-200 hover:bg-amber-50">
                            Remove All Duplicates
                        </Button>
                    )}
                </DialogHeader>
                <div className="flex-1 overflow-y-auto py-4">
                    {!file ? (
                        <div className="space-y-5">
                        <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
                            <div className="text-4xl">📄</div>
                            <p className="text-sm text-muted-foreground">CSV with automatic or saved mappings, plus standard OFX/QFX statements</p>
                            <Input type="file" accept=".csv,.ofx,.qfx,text/csv,application/x-ofx" onChange={onFileChange} className="max-w-sm mx-auto" />
                        </div>
                        <div className="rounded-2xl border p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div><p className="font-semibold text-sm">NAS import inbox</p><p className="text-xs text-muted-foreground break-all">{inboxDirectory || "Configured by IMPORT_INBOX_DIR"}</p></div>
                                <Button type="button" variant="outline" onClick={scanInbox} disabled={isScanning}>{isScanning ? "Scanning…" : "Scan folder"}</Button>
                            </div>
                            {inboxFiles.length > 0 && <div className="divide-y rounded-xl border overflow-hidden">{inboxFiles.map(item => (
                                <div key={`${item.name}-${item.hash}`} className="flex items-center justify-between gap-3 p-3 bg-white">
                                    <div className="min-w-0"><p className="text-sm font-medium truncate">{item.name}</p><p className="text-xs text-muted-foreground">{(item.size / 1024).toFixed(1)} KB · {new Date(item.modifiedAt).toLocaleString()} {item.imported ? "· Already imported" : ""}</p>{item.error && <p className="text-xs text-rose-600">{item.error}</p>}</div>
                                    <Button type="button" size="sm" variant={item.imported ? "ghost" : "outline"} disabled={Boolean(item.error) || isLoading} onClick={() => openInboxFile(item)}>{item.imported ? "Review" : "Preview"}</Button>
                                </div>
                            ))}</div>}
                        </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm"><span className="font-semibold truncate">{file.name}</span><span className="rounded-full bg-indigo-50 text-indigo-700 px-2 py-1 text-xs font-bold">{format.toUpperCase()} · {origin === "NAS_INBOX" ? "NAS inbox" : "Upload"}</span></div>
                        {format === "csv" && (
                        <div className="rounded-2xl border bg-slate-50 p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {([['dateColumn', 'Date'], ['descriptionColumn', 'Description'], ['amountColumn', 'Combined amount'], ['debitColumn', 'Debit / money out'], ['creditColumn', 'Credit / money in'], ['typeColumn', 'Type (optional)']] as const).map(([key, label]) => (
                                    <div key={key} className="grid gap-1"><Label className="text-[10px] uppercase text-slate-500">{label}</Label><Select value={mapping[key] || "NONE"} onValueChange={value => applyMapping({ ...mapping, [key]: value === "NONE" && key === "amountColumn" ? "" : value })}><SelectTrigger className="bg-white"><SelectValue placeholder="Choose column" /></SelectTrigger><SelectContent>{!['dateColumn', 'descriptionColumn'].includes(key) && <SelectItem value="NONE">Not used</SelectItem>}{headers.map(header => <SelectItem key={header} value={header}>{header}</SelectItem>)}</SelectContent></Select></div>
                                ))}
                            </div>
                            <div className="flex gap-2"><Input value={profileName} onChange={event => setProfileName(event.target.value)} placeholder="Bank profile name, e.g. Chase Checking" /><Button type="button" variant="outline" onClick={saveMapping} disabled={!profileName || !mapping.dateColumn || !mapping.descriptionColumn || (!mapping.amountColumn && mapping.debitColumn === "NONE" && mapping.creditColumn === "NONE")}>Save Mapping</Button></div>
                        </div>
                        )}
                        {previewData.some(item => item.reviewReason) && (
                            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950">
                                <p className="font-bold">⚠ {previewData.filter(item => item.reviewReason).length} transaction(s) need Money In / Money Out confirmation</p>
                                <p className="text-sm mt-1">Review the highlighted Type controls below. Payments and transfers cannot always be inferred safely from a bank CSV.</p>
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><b>{previewData.filter(item => item.type === "INCOME").length}</b><br/>Money In</div>
                            <div className="rounded-lg bg-rose-50 p-2 text-rose-700"><b>{previewData.filter(item => item.type === "EXPENSE").length}</b><br/>Money Out</div>
                            <div className="rounded-lg bg-amber-50 p-2 text-amber-700"><b>{previewData.filter(item => item.reviewReason).length}</b><br/>Need confirmation</div>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-24">Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="w-36">Money direction</TableHead>
                                    <TableHead className="w-48">Category / Rule</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {previewData.map((p, i) => (
                                    <TableRow key={i} className={cn(p.isDuplicate && "bg-amber-50 text-amber-900")}>
                                        <TableCell className="text-xs">{formatDate(p.date)}</TableCell>
                                        <TableCell>
                                            <div className="text-sm font-medium">{p.description}</div>
                                            {p.isDuplicate && <span className="text-[10px] font-bold uppercase">Potential Duplicate</span>}
                                            {p.reviewReason && <div className="mt-1 text-xs font-semibold text-amber-700">⚠ {p.reviewReason}</div>}
                                        </TableCell>
                                        <TableCell>
                                            <Select value={p.type} onValueChange={value => setPreviewType(i, value as "INCOME" | "EXPENSE")}><SelectTrigger className={cn("h-9 font-semibold", p.reviewReason && "border-amber-400 ring-2 ring-amber-100")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EXPENSE">↓ Money Out</SelectItem><SelectItem value="INCOME">↑ Money In</SelectItem></SelectContent></Select>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Select value={p.categoryId || "NONE"} onValueChange={value => setPreviewCategory(i, value === "NONE" ? "" : value)}><SelectTrigger className="h-8 min-w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Use rules</SelectItem>{categories.filter(category => category.type === p.type).map(category => <SelectItem key={category.id} value={category.id}>{category.icon} {category.name}</SelectItem>)}</SelectContent></Select>
                                                {p.categoryId && <Button type="button" variant="ghost" size="xs" title="Create a rule from this correction" onClick={() => createRuleFromPreview(p)}>Save rule</Button>}
                                            </div>
                                        </TableCell>
                                        <TableCell className={cn("text-right font-bold text-sm", p.type === "INCOME" ? "text-emerald-600" : "text-rose-600")}>
                                            {p.type === "INCOME" ? "+" : "-"}{displayMoney(p.amount, settings)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                    )}
                </div>
                {file && (
                    <div className="pt-4 border-t space-y-4">
                         {status && <p className={cn("text-center font-medium py-2 rounded text-sm", status.includes("Error") ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600")}>{status}</p>}
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => {setFile(null); setPreviewData([]); setFileHash(""); setStatus("")}} disabled={isLoading}>Back</Button>
                            <Button onClick={handleUpload} disabled={isLoading || previewData.length === 0} className="flex-1 bg-slate-900 text-white">
                                {isLoading ? "Importing..." : `Confirm Import (${previewData.length} records)`}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}

function RemoveDuplicatesDialog({ transactions, settings }: { transactions: any[], settings?: any }) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    // Calculate duplicates
    const seen = new Set()
    const duplicateRecords = transactions.filter(t => {
        const key = `${new Date(t.date).toISOString().split('T')[0]}-${t.amount}-${t.description}-${t.type}`
        if (seen.has(key)) {
            return true
        }
        seen.add(key)
        return false
    })

    async function handleRemove() {
        setIsLoading(true)
        const res = await removeDuplicates()
        setIsLoading(false)
        if (res.success) toast.success(`Removed ${res.count} duplicates`)
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50">Cleanup Duplicates</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Cleanup Duplicate Transactions</DialogTitle>
                    <DialogDescription>
                        {duplicateRecords.length > 0 
                            ? `We found ${duplicateRecords.length} transactions that appear to be exact duplicates.` 
                            : "No exact duplicates found."}
                    </DialogDescription>
                </DialogHeader>
                
                {duplicateRecords.length > 0 && (
                    <div className="flex-1 overflow-y-auto my-4 border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {duplicateRecords.map((t) => (
                                    <TableRow key={t.id} className="text-slate-500 bg-slate-50">
                                        <TableCell className="text-xs">{formatDate(t.date)}</TableCell>
                                        <TableCell className="text-sm">{t.description}</TableCell>
                                        <TableCell className="text-right text-sm">{displayMoney(t.amount, settings)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <div className="flex gap-3 justify-between items-center mt-6 py-4 border-t border-slate-100">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 text-[10px] font-bold uppercase tracking-wider">Danger: Reset All Data</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[400px]">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black text-rose-600">Factory Reset?</DialogTitle>
                                <DialogDescription className="font-medium">
                                    This permanently deletes your transactions, transfers, accounts, projects, properties, recurring schedules, import rules, and preferences. Categories are kept. This cannot be undone.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex gap-3 justify-end mt-4">
                                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                                <Button variant="destructive" onClick={async () => { await resetAllData(); setOpen(false); toast.success("All data cleared"); }}>Yes, Delete Everything</Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading} className="rounded-xl">Cancel</Button>
                        {duplicateRecords.length > 0 && (
                            <Button variant="destructive" onClick={handleRemove} disabled={isLoading} className="rounded-xl shadow-lg shadow-rose-100">
                                {isLoading ? "Removing..." : `Delete ${duplicateRecords.length} Duplicates`}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function DeleteTransactionDialog({ onDelete, children }: { onDelete: () => void, children: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Delete Transaction</DialogTitle>
                    <DialogDescription>Are you sure you want to delete this transaction? This action cannot be undone.</DialogDescription>
                </DialogHeader>
                <div className="flex gap-3 justify-end mt-4">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={() => { onDelete(); setOpen(false); }}>Delete</Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function DeleteTransactionsDialog({ onConfirm, count, children }: { onConfirm: () => void, count: number, children: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Bulk Delete</DialogTitle>
                    <DialogDescription>Are you sure you want to delete {count} selected transactions? This action cannot be undone.</DialogDescription>
                </DialogHeader>
                <div className="flex gap-3 justify-end mt-4">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={() => { onConfirm(); setOpen(false); }}>Delete All</Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function ManageProperties({ properties, trigger }: { properties: any[], trigger?: React.ReactNode }) {
    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const form = e.currentTarget
        const formData = new FormData(form)
        const result = await addProperty(formData)
        if (result.error) {
            toast.error(result.error)
            return
        }
        form.reset()
        toast.success("Property added")
    }
    return (
        <Dialog>
            <DialogTrigger asChild>{trigger || <Button variant="outline">Property</Button>}</DialogTrigger>
            <DialogContent className="sm:max-w-[400px] rounded-2xl">
                 <DialogHeader>
                    <DialogTitle className="text-xl font-black">My Real Estate</DialogTitle>
                    <DialogDescription className="font-medium text-slate-500">Add or manage your rental properties</DialogDescription>
                 </DialogHeader>
                 <div className="space-y-6 pt-2">
                     <form onSubmit={onSubmit} className="flex gap-2 bg-slate-50 p-3 rounded-2xl">
                         <Input name="name" placeholder="E.g. Sunshine Villa" required className="bg-white border-0 focus-visible:ring-indigo-500 rounded-xl" />
                         <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100">Add</Button>
                     </form>
                     <div className="space-y-2">
                         {properties.length === 0 && <p className="text-center py-8 text-slate-400 text-xs font-semibold">No properties registered yet.</p>}
                         {properties.map(p => (
                             <div key={p.id} className="bg-white border border-slate-100 p-3 rounded-xl flex justify-between items-center group hover:border-indigo-100 hover:bg-indigo-50/30 transition-all">
                                 <span className="font-bold text-slate-700">{p.name}</span>
                                 <span className="text-[10px] font-black text-indigo-400 group-hover:text-indigo-600">ACTIVE</span>
                             </div>
                         ))}
                     </div>
                 </div>
            </DialogContent>
        </Dialog>
    )
}

export function ManageProjects({ projects, trigger, settings }: { projects: any[], trigger?: React.ReactNode, settings?: any }) {
    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const form = e.currentTarget
        const result = await addProject(new FormData(form))
        if (result.error) {
            toast.error(result.error)
            return
        }
        form.reset()
        toast.success("Project created")
    }

    return (
        <Dialog>
            <DialogTrigger asChild>{trigger || <Button variant="outline">Projects</Button>}</DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black">My Projects</DialogTitle>
                    <DialogDescription>Group related transactions and track their total cost.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 pt-2">
                    <form onSubmit={onSubmit} className="grid gap-3 bg-slate-50 p-4 rounded-2xl">
                        <Input name="name" maxLength={100} placeholder="E.g. New Home Move" required className="bg-white border-0" />
                        <Input name="description" maxLength={300} placeholder="Optional project description" className="bg-white border-0" />
                        <div className="grid grid-cols-3 gap-2">
                            <Input name="budget" type="number" min="0" step="0.01" placeholder="Budget" className="bg-white border-0" />
                            <Input name="startDate" type="date" aria-label="Project start date" className="bg-white border-0" />
                            <Input name="endDate" type="date" aria-label="Project end date" className="bg-white border-0" />
                        </div>
                        <Button type="submit" className="bg-violet-600 hover:bg-violet-700">Create Project</Button>
                    </form>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {projects.length === 0 && <p className="text-center py-8 text-slate-400 text-xs font-semibold">No projects yet.</p>}
                        {projects.map(project => (
                            <div key={project.id} className="bg-white border border-slate-100 p-3 rounded-xl">
                                <div className="font-bold text-slate-800">📌 {project.name}</div>
                                {project.description && <div className="text-xs text-slate-500 mt-1">{project.description}</div>}
                                {project.budget !== null && <div className="text-xs font-semibold text-violet-600 mt-1">Budget: {displayMoney(project.budget, settings)}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function ManageCategories({ categories, trigger }: { categories: any[], trigger?: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    const [type, setType] = useState("EXPENSE")

      async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault()
      const formData = new FormData(e.currentTarget)
      const result = await addCategory(formData)
      if (result.error) {
          toast.error(result.error)
          return
      }
      toast.success("Category added")
      setOpen(false)
  }
    return (
        <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
            {trigger || <Button variant="outline">Categories</Button>}
        </DialogTrigger>
        <DialogContent>
            <DialogHeader><DialogTitle>Manage Categories</DialogTitle><DialogDescription>Add or view categories</DialogDescription></DialogHeader>
            <form onSubmit={onSubmit} className="grid gap-4 py-4">
                 <div className="flex gap-4 justify-center mb-2">
                    <Label className="flex items-center gap-2 cursor-pointer">
                        <Input type="radio" name="type" value="EXPENSE" checked={type === "EXPENSE"} onChange={() => setType("EXPENSE")} className="w-4 h-4" /> Expense
                    </Label>
                    <Label className="flex items-center gap-2 cursor-pointer">
                        <Input type="radio" name="type" value="INCOME" checked={type === "INCOME"} onChange={() => setType("INCOME")} className="w-4 h-4" /> Income
                    </Label>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="icon" className="text-right">Icon</Label>
                    <div className="col-span-3 flex gap-2">
                         <Select name="icon" defaultValue="📦">
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {["🍔","🚗","🛍️","🎬","💊","🧾","🏠","📦","✈️","🎮","🔧","🎓","💰","🔑"].map(i => (
                                    <SelectItem key={i} value={i}>{i}</SelectItem>
                                ))}
                            </SelectContent>
                         </Select>
                    </div>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" name="name" className="col-span-3" required />
                 </div>
                 <Button type="submit">Add Category</Button>
            </form>
            <div className="mt-4">
                <h4 className="font-semibold mb-2">Existing {type === "EXPENSE" ? "Expenses" : "Incomes"}:</h4>
                <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
                    {categories.filter(c => c.type === type).map(c => <span key={c.id} className="bg-slate-100 px-2 py-1 rounded text-sm border flex items-center gap-1">{c.icon} {c.name}</span>)}
                </div>
            </div>
        </DialogContent>
        </Dialog>
    )
}

function ManageCategoryRules({ categories, rules, trigger }: { categories: any[], rules: any[], trigger: React.ReactNode }) {
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = event.currentTarget
        const result = await addCategoryRule(new FormData(form))
        if (result.error) return toast.error(result.error)
        form.reset()
        toast.success("Rule added")
    }

    return (
        <Dialog>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader><DialogTitle>Auto-categorization Rules</DialogTitle><DialogDescription>Rules are applied in priority order when a CSV is imported.</DialogDescription></DialogHeader>
                <form onSubmit={submit} className="grid gap-3 rounded-2xl bg-slate-50 p-4">
                    <div className="grid grid-cols-2 gap-3"><Input name="name" placeholder="Rule name" required /><Input name="pattern" placeholder="Description text, e.g. COSTCO" required /></div>
                    <div className="grid grid-cols-2 gap-3">
                        <Select name="matchType" defaultValue="CONTAINS"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CONTAINS">Contains</SelectItem><SelectItem value="STARTS_WITH">Starts with</SelectItem><SelectItem value="EXACT">Exact match</SelectItem></SelectContent></Select>
                        <Select name="categoryId" required><SelectTrigger><SelectValue placeholder="Assign category" /></SelectTrigger><SelectContent>{categories.map(category => <SelectItem key={category.id} value={category.id}>{category.icon} {category.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <Button type="submit">Add Rule</Button>
                </form>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                    {rules.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No rules yet.</p>}
                    {rules.map(rule => <div key={rule.id} className="flex items-center justify-between rounded-xl border p-3 text-sm"><div><div className="font-semibold">{rule.name}</div><div className="text-xs text-slate-500">{rule.matchType.replaceAll("_", " ")}: “{rule.pattern}”</div></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{rule.category.icon} {rule.category.name}</span></div>)}
                </div>
            </DialogContent>
        </Dialog>
    )
}

function ManagePreferences({ settings, trigger }: { settings: any, trigger: React.ReactNode }) {
    const [open, setOpen] = useState(false)

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const result = await updateUserSettings(new FormData(event.currentTarget))
        if (result.error) return toast.error(result.error)
        toast.success("Preferences saved")
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Financial Preferences</DialogTitle><DialogDescription>These settings are stored in SQLite and apply on every device.</DialogDescription></DialogHeader>
                <form onSubmit={submit} className="grid gap-4">
                    <div className="grid gap-2"><Label>Monthly Budget</Label><Input name="monthlyBudget" type="number" min="0" step="0.01" defaultValue={settings?.monthlyBudget ?? 2000} required /></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2"><Label>Currency</Label><Select name="currency" defaultValue={settings?.currency || "USD"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["USD", "CAD", "EUR", "GBP", "AUD", "CNY", "JPY"].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
                        <div className="grid gap-2"><Label>Number Format</Label><Select name="locale" defaultValue={settings?.locale || "en-US"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en-US">English (US)</SelectItem><SelectItem value="en-CA">English (Canada)</SelectItem><SelectItem value="en-GB">English (UK)</SelectItem><SelectItem value="zh-CN">中文（中国）</SelectItem></SelectContent></Select></div>
                    </div>
                    <div className="grid gap-2"><Label>Timezone</Label><Select name="timezone" defaultValue={settings?.timezone || "America/New_York"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="America/New_York">Eastern Time</SelectItem><SelectItem value="America/Chicago">Central Time</SelectItem><SelectItem value="America/Denver">Mountain Time</SelectItem><SelectItem value="America/Los_Angeles">Pacific Time</SelectItem><SelectItem value="UTC">UTC</SelectItem><SelectItem value="Asia/Shanghai">China Standard Time</SelectItem></SelectContent></Select></div>
                    <Button type="submit">Save Preferences</Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export function UserSettings({ session, categories, properties, projects, userSettings, categoryRules = [] }: { session: any, categories: any[], properties: any[], projects: any[], userSettings?: any, categoryRules?: any[] }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="rounded-full w-10 h-10 p-0 overflow-hidden border-2 border-indigo-100 hover:border-indigo-500 transition-all shadow-sm">
                    <div className="w-full h-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-lg">
                        {session.user.name?.charAt(0).toUpperCase()}
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 rounded-3xl shadow-2xl border-0 overflow-hidden" align="end">
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-black backdrop-blur-md">
                        {session.user.name?.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="font-bold text-lg">{session.user.name}</h3>
                    <p className="text-indigo-100 text-xs opacity-80">Personal Account</p>
                </div>
                <div className="p-4 space-y-1">
                    <div className="p-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-2">Management</span>
                        <div className="grid gap-1">
                            <ManagePreferences
                                settings={userSettings}
                                trigger={<Button variant="ghost" className="w-full justify-start text-slate-700 hover:bg-slate-50 rounded-xl gap-3 text-xs font-semibold"><span>⚙️</span> Financial Preferences</Button>}
                            />
                            <ManageProperties 
                                properties={properties} 
                                trigger={
                                    <Button variant="ghost" className="w-full justify-start text-slate-700 hover:bg-slate-50 rounded-xl gap-3 text-xs font-semibold">
                                        <span>🏠</span> Manage Properties
                                    </Button>
                                } 
                            />
                            <ManageCategories 
                                categories={categories} 
                                trigger={
                                    <Button variant="ghost" className="w-full justify-start text-slate-700 hover:bg-slate-50 rounded-xl gap-3 text-xs font-semibold">
                                        <span>📂</span> Manage Categories
                                    </Button>
                                } 
                            />
                            <ManageCategoryRules
                                categories={categories}
                                rules={categoryRules}
                                trigger={<Button variant="ghost" className="w-full justify-start text-slate-700 hover:bg-slate-50 rounded-xl gap-3 text-xs font-semibold"><span>✨</span> Auto-categorization Rules</Button>}
                            />
                            <ManageProjects
                                projects={projects}
                                settings={userSettings}
                                trigger={
                                    <Button variant="ghost" className="w-full justify-start text-slate-700 hover:bg-slate-50 rounded-xl gap-3 text-xs font-semibold">
                                        <span>📌</span> Manage Projects
                                    </Button>
                                }
                            />
                        </div>
                    </div>
                    <div className="border-t border-slate-100 p-2">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-2">Account Details</span>
                         <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2">
                             <div className="flex justify-between">
                                 <span className="text-slate-500">Username</span>
                                 <span className="font-bold text-slate-900">{session.user.name}</span>
                             </div>
                             <div className="flex justify-between">
                                 <span className="text-slate-500">Status</span>
                                 <span className="font-black text-emerald-600">PREMIUM</span>
                             </div>
                         </div>
                    </div>
                    <div className="px-4">
                        <Button variant="outline" onClick={() => window.location.assign("/api/backup")} className="w-full justify-start rounded-xl gap-3 text-xs font-semibold">
                            <span>💾</span> Download JSON Backup
                        </Button>
                    </div>
                    <div className="p-4 pt-2">
                        <Button variant="ghost" onClick={() => signOut({ callbackUrl: window.location.origin })} className="w-full justify-start text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl gap-3">
                            <span>🔓</span> Sign Out
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export function MonthlyReportDialog({ transactions, startDate, endDate, settings }: { transactions: any[], startDate: string, endDate: string, settings?: any }) {
    const [open, setOpen] = useState(false)
    const income = sumMoney(transactions.filter(t => t.type === "INCOME").map(t => t.amount))
    const expense = sumMoney(transactions.filter(t => t.type === "EXPENSE").map(t => t.amount))
    const balance = roundMoney(income - expense)

    const categorySummaries = transactions.reduce((acc: any, t) => {
        const catName = t.category?.name || "Uncategorized"
        if (!acc[catName]) acc[catName] = { name: catName, income: 0, expense: 0, count: 0 }
        if (t.type === "INCOME") acc[catName].income = roundMoney(acc[catName].income + t.amount)
        else acc[catName].expense = roundMoney(acc[catName].expense + t.amount)
        acc[catName].count++
        return acc
    }, {})

    const sortedCats = Object.values(categorySummaries)
        .sort((a: any, b: any) => (b.income + b.expense) - (a.income + a.expense))

    const handlePrint = () => {
        window.print()
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2 shadow-sm bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100 transition-colors font-semibold">
                    <span>📊</span> Monthly Report
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col p-0 border-0">
                <DialogHeader className="sr-only">
                    <DialogTitle>Monthly Financial Report</DialogTitle>
                    <DialogDescription>Detailed breakdown of income and expenses for the selected period.</DialogDescription>
                </DialogHeader>
                <div id="monthly-report" className="flex-1 overflow-y-auto p-8 bg-white print:p-0">
                    <div className="flex justify-between items-start mb-8 border-b pb-6">
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Financial Report</h2>
                            <p className="text-slate-500 font-medium mt-1">{formatDate(startDate)} — {formatDate(endDate)}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-bold text-indigo-600 uppercase tracking-widest">iCost Summary</div>
                            <div className="text-xs text-slate-400 mt-1">Generated: {new Date().toLocaleDateString()}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6 mb-10">
                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm">
                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Income</div>
                            <div className="text-2xl font-black text-emerald-700">{displayMoney(income, settings)}</div>
                        </div>
                        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 shadow-sm">
                            <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Total Expense</div>
                            <div className="text-2xl font-black text-rose-700">{displayMoney(expense, settings)}</div>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Net Balance</div>
                            <div className="text-2xl font-black text-slate-900">{displayMoney(balance, settings)}</div>
                        </div>
                    </div>

                    <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4">Category Breakdown</h3>
                    <div className="border rounded-2xl overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="font-bold text-slate-700">Category</TableHead>
                                    <TableHead className="text-right font-bold text-slate-700">Income</TableHead>
                                    <TableHead className="text-right font-bold text-slate-700">Expense</TableHead>
                                    <TableHead className="text-right font-bold text-slate-700">Transactions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedCats.map((cat: any) => (
                                    <TableRow key={cat.name} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="font-semibold text-slate-900">{cat.name}</TableCell>
                                        <TableCell className="text-right text-emerald-600 font-bold">{displayMoney(cat.income, settings)}</TableCell>
                                        <TableCell className="text-right text-rose-600 font-bold">{displayMoney(cat.expense, settings)}</TableCell>
                                        <TableCell className="text-right text-slate-500 font-medium">{cat.count}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-10 pt-6 border-t text-center text-[10px] text-slate-400 font-medium italic">
                        This report was automatically generated by iCost - Your Personal Finance Assistant.
                    </div>
                </div>
                <div className="p-4 bg-slate-50 border-t flex justify-between print:hidden">
                    <Button variant="ghost" className="font-bold text-slate-500 hover:text-slate-900" onClick={() => setOpen(false)}>Close Report</Button>
                    <Button onClick={handlePrint} className="bg-slate-900 text-white font-bold gap-2 px-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
                        <span>🖨️</span> Print PDF
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
