"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addTransaction, deleteTransaction, addCategory, importTransactions, addProperty, deleteTransactions, resetAllData } from "@/app/actions"
import { Checkbox } from "@/components/ui/checkbox"
import { useRef, useState, useMemo } from "react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import Papa from "papaparse"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, Line, ComposedChart, Area } from 'recharts'
import { updateTransaction, removeDuplicates } from "@/app/actions"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Progress } from "@/components/ui/progress"


export function SummaryCards({ transactions }: { transactions: any[] }) {
  const [budget, setBudget] = useState(2000) // Default budget
  const [isEditingBudget, setIsEditingBudget] = useState(false)

  const income = transactions.filter(t => t.type === "INCOME").reduce((sum, t) => sum + t.amount, 0)
  const expense = transactions.filter(t => t.type === "EXPENSE").reduce((sum, t) => sum + t.amount, 0)
  const balance = income - expense

  const budgetProgress = Math.min((expense / budget) * 100, 100)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="bg-white shadow-lg border-0 animate-slide-up overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Income</CardTitle>
          <div className="text-emerald-500 bg-emerald-50 p-1.5 rounded-full">↑</div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black text-emerald-600">${income.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </CardContent>
      </Card>
      <Card className="bg-white shadow-lg border-0 animate-slide-up overflow-hidden" style={{ animationDelay: '0.1s' }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Expenses</CardTitle>
          <div className="text-rose-500 bg-rose-50 p-1.5 rounded-full">↓</div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black text-rose-600">${expense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="mt-4 space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                  <span>Monthly Budget</span>
                  <span onClick={() => setIsEditingBudget(true)} className="cursor-pointer hover:text-slate-600">
                      {isEditingBudget ? (
                          <Input 
                            type="number" 
                            defaultValue={budget} 
                            autoFocus 
                            onBlur={(e) => { setBudget(parseFloat(e.target.value) || 0); setIsEditingBudget(false); }}
                            onKeyDown={(e) => { if(e.key==='Enter') { setBudget(parseFloat(e.currentTarget.value) || 0); setIsEditingBudget(false); } }}
                            className="h-4 w-16 text-right p-0 border-0 focus-visible:ring-0"
                          />
                      ) : `$${budget}`}
                  </span>
              </div>
              <Progress value={budgetProgress} className={cn("h-1.5", budgetProgress > 90 ? "bg-rose-100" : "bg-slate-100")} />
              <div className="text-[10px] text-slate-400 text-right">{budgetProgress.toFixed(0)}% used</div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-white shadow-lg border-0 animate-slide-up overflow-hidden">
         <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Net Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("text-3xl font-black", balance >= 0 ? "text-slate-900" : "text-rose-600")}>
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function TransactionDashboard({ transactions, categories, totalCount }: { transactions: any[], categories: any[], totalCount?: number }) {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const [startDate, setStartDate] = useState<string>(firstDay.toISOString().split('T')[0])
    const [endDate, setEndDate] = useState<string>(lastDay.toISOString().split('T')[0])
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(categories.map(c => c.id)))
    const [search, setSearch] = useState("")

    // 1. Filter by Date Range
    const dateFiltered = useMemo(() => transactions.filter(t => {
        const d = new Date(t.date).toISOString().split('T')[0]
        return d >= startDate && d <= endDate
    }), [transactions, startDate, endDate])

    // 2. Filter by Category & Search
    const filtered = useMemo(() => {
        let list = dateFiltered.filter(e => selectedCategories.has(e.categoryId))
        if (search.trim() !== "") {
            list = list.filter(t => t.description?.toLowerCase().includes(search.toLowerCase()))
        }
        return list
    }, [dateFiltered, selectedCategories, search])

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

    return (
        <div className="space-y-8">
            <SummaryCards transactions={filtered} />
            <TransactionList 
                transactions={transactions} 
                categories={categories} 
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
                totalCount={totalCount}
            />
        </div>
    )
}

export function TransactionList({ 
    transactions, 
    categories, 
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
    toggleAllCategories,
    totalCount
}: any) {
    const router = useRouter()
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
    const [editingField, setEditingField] = useState<"amount" | "category" | "description" | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const editInputRef = useRef<HTMLInputElement>(null)

    function toggleSelect(id: string) {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedIds(next)
    }

    function toggleSelectAll() {
        if (selectedIds.size === paginatedTransactions.length) setSelectedIds(new Set())
        else setSelectedIds(new Set(paginatedTransactions.map((t: any) => t.id)))
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

    function startEdit(id: string, field: "amount" | "category" | "description", t: any) {
        if (field === "amount" && t.source === 'CSV_IMPORT') return // Locked
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
        formData.append("description", t.description) // Keep existing
        formData.append("categoryId", t.categoryId)   // Keep existing 
        formData.append("type", t.type)
        formData.append("date", new Date(t.date).toISOString().split('T')[0])
        
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

        await updateTransaction(id, formData)
        setEditingId(null)
        setEditingField(null)
    }

    async function saveCategory(id: string, catId: string, t: any) {
         const formData = new FormData()
         formData.append("categoryId", catId)
         formData.append("amount", t.amount.toString())
         formData.append("description", t.description)
         formData.append("type", t.type)
         formData.append("date", new Date(t.date).toISOString().split('T')[0])

         await updateTransaction(id, formData)
         setEditingId(null)
         setEditingField(null)
    }

    function handleExport() {
        const headers = ["Date", "Description", "Category", "Amount", "Type", "Source"]
        const csvRows = filtered.map((t: any) => [
            new Date(t.date).toLocaleDateString(),
            t.description,
            t.category?.name || "Uncategorized",
            t.amount,
            t.type,
            t.source
        ].join(","))
        
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...csvRows].join("\n")
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `iCost_Export_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success("CSV Exported")
    }

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)

    const sortedTransactions = useMemo(() => {
        let sortableItems = [...filtered]
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
    }, [filtered, sortConfig])

    function handleSort(key: string) {
        let direction: 'asc' | 'desc' = 'asc'
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    // 4. Paginate
    const totalPages = Math.ceil(sortedTransactions.length / pageSize)
    const paginatedTransactions = sortedTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize)

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
                            <DeleteTransactionsDialog onConfirm={handleBatchDelete} count={selectedIds.size}>
                                <Button variant="outline" size="sm" className="text-red-600 border-red-100 hover:bg-red-50 h-9">
                                    Delete {selectedIds.size} selected
                                </Button>
                            </DeleteTransactionsDialog>
                        )}
                        <MonthlyReportDialog transactions={filtered} startDate={startDate} endDate={endDate} />
                        <Button variant="outline" size="sm" onClick={handleExport} className="h-9 gap-2 shadow-sm bg-white">
                            <span>📤</span> Export CSV
                        </Button>
                        <RemoveDuplicatesDialog transactions={transactions} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-4 border-t border-slate-200/60">
                    <div className="md:col-span-5 relative group">
                        <Input 
                            placeholder="Search description..." 
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
                                                    id={`list-cat-${c.id}`} 
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
            </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                  <Checkbox checked={selectedIds.size === paginatedTransactions.length && paginatedTransactions.length > 0} onCheckedChange={toggleSelectAll} />
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
              <TableRow key={t.id} style={{ animationDelay: `${idx * 0.05}s` }} className={cn("animate-slide-up bg-white group transition-all duration-300", selectedIds.has(t.id) ? "bg-indigo-50/50" : "hover:bg-slate-50")}>
                <TableCell>
                    <Checkbox checked={selectedIds.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} />
                </TableCell>
                <TableCell className="font-medium text-xs text-slate-500 whitespace-nowrap">{new Date(t.date).toLocaleDateString()}</TableCell>
                <TableCell onClick={() => startEdit(t.id, 'description', t)}>
                    {editingId === t.id && editingField === 'description' ? (
                        <Input 
                            defaultValue={t.description} 
                            autoFocus 
                            className="h-8 w-full"
                            list="descriptions-list-inline"
                            onBlur={(e) => saveDescription(t.id, e.target.value, t)}
                            onKeyDown={(e) => { if(e.key === 'Enter') saveDescription(t.id, e.currentTarget.value, t) }}
                        />
                    ) : (
                        <div className="flex flex-col cursor-pointer hover:underline decoration-dotted group/desc" title={t.description}>
                            <div className="font-medium truncate max-w-[200px] lg:max-w-[400px]">{t.description || "No description"}</div>
                            {t.source === 'CSV_IMPORT' && <span className="text-[10px] w-fit bg-blue-50 text-blue-600 px-1 rounded">IMPORTED</span>}
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
                <TableCell className={cn("text-right font-semibold", t.type === 'INCOME' ? "text-emerald-600" : "text-rose-600")} onClick={() => startEdit(t.id, 'amount', t)}>
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
                    ) : (
                        <span title={t.source==='CSV_IMPORT' ? "Locked" : "Click to edit"} className={cn("cursor-pointer", t.source !== 'CSV_IMPORT' && "hover:underline decoration-dashed")}>
                            {t.type === 'INCOME' ? '+' : '-'}${t.amount.toFixed(2)}
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
                <TableCell className="text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <EditTransactionDialog transaction={t} categories={categories} properties={[]} uniqueDescriptions={uniqueDescriptions}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-500 transition-colors">✎</Button>
                    </EditTransactionDialog>
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
              <span className="hidden sm:inline">Showing {Math.min(filtered.length, (currentPage-1)*pageSize + 1)}-{Math.min(filtered.length, currentPage*pageSize)} of {filtered.length}</span>
          </div>

          <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="h-8"
              >
                  Prev
              </Button>
              <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                      <Button 
                        key={i} 
                        variant={currentPage === i + 1 ? "default" : "ghost"} 
                        size="sm" 
                        onClick={() => setCurrentPage(i + 1)}
                        className="h-8 w-8 p-0"
                      >
                          {i + 1}
                      </Button>
                  ))}
                  {totalPages > 5 && <span className="text-slate-400 px-1">...</span>}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === totalPages || totalPages === 0} 
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="h-8"
              >
                  Next
              </Button>
          </div>
      </div>
    </Card>
  )
}

export function AddTransactionButton({ categories, properties, transactions = [] }: { categories: any[], properties: any[], transactions?: any[] }) {
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
      await addTransaction(formData)
      toast.success(`${type === "INCOME" ? "Income" : "Expense"} added`)
      setOpen(false)
      reset()
  }

  function reset() {
      setStep("category")
      setSelectedCategory("initial") // Reset to standard state
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

function TransactionForm({ categories, properties, step, setStep, type, setType, selectedCategory, handleCategorySelect, onSubmit, initialData, uniqueDescriptions = [] }: any) {
  const isImported = initialData?.source === 'CSV_IMPORT'
  return (
        <>
        <DialogHeader>
          <DialogTitle>
              {step === "category" ? (
                  <div className="flex gap-4 justify-center">
                      <button type="button" disabled={isImported} onClick={() => setType("EXPENSE")} className={cn("px-4 py-1 rounded-full text-sm font-medium transition-colors", type==="EXPENSE" ? "bg-rose-100 text-rose-600" : "text-slate-400", isImported && "opacity-50 cursor-not-allowed")}>Expense</button>
                      <button type="button" disabled={isImported} onClick={() => setType("INCOME")} className={cn("px-4 py-1 rounded-full text-sm font-medium transition-colors", type==="INCOME" ? "bg-emerald-100 text-emerald-600" : "text-slate-400", isImported && "opacity-50 cursor-not-allowed")}>Income</button>
                  </div>
              ) : type === "INCOME" ? "Income Details" : "Expense Details"}
          </DialogTitle>
          {step === "details" && isImported && <p className="text-xs text-center text-amber-600 bg-amber-50 py-1 rounded">Imported Record: Amount & Date locked</p>}
          {step === "details" && !isImported && (
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
                <div className="grid gap-2">
                    <Label htmlFor="amount">Amount {isImported && <span className="text-xs text-muted-foreground">(Locked)</span>}</Label>
                    <div className="relative">
                        <span className={cn("absolute left-3 top-2.5 text-lg font-bold", type==="INCOME" ? "text-emerald-500" : "text-rose-500")}>$</span>
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
                        <Input id="desc" name="description" placeholder="Type or select..." defaultValue={initialData?.description} list="descriptions-list" />
                        <datalist id="descriptions-list">
                            {uniqueDescriptions.map((desc: string) => (
                                <option key={desc} value={desc} />
                            ))}
                        </datalist>
                    </div>
                </div>

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
                     <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("category")}>Back</Button>
                     <Button type="submit" className={cn("flex-1", type==="INCOME" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700")}>
                         Save {type === "INCOME" ? "Income" : "Expense"}
                     </Button>
                </div>
            </form>
        )}
        </>
  )
}

function EditTransactionDialog({ transaction, categories, properties, children, uniqueDescriptions = [] }: any) {
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState<"category" | "details">("details")
    const [type, setType] = useState<"INCOME" | "EXPENSE">(transaction.type)
    const [selectedCategory, setSelectedCategory] = useState<string>(transaction.categoryId)

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        formData.append("categoryId", selectedCategory)
        formData.append("type", type)
        await updateTransaction(transaction.id, formData)
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

export function AnalysisCharts({ transactions, categories, properties }: { transactions: any[], categories: any[], properties: any[] }) {
    const now = new Date()
    const [startDate, setStartDate] = useState<string>(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
    const [endDate, setEndDate] = useState<string>(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0])
    
    // Default to all category IDs
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(categories.map(c => c.id)))

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const d = new Date(t.date).toISOString().split('T')[0]
            const inDateRange = d >= startDate && d <= endDate
            const inCategories = selectedCategories.has(t.categoryId)
            return inDateRange && inCategories
        })
    }, [transactions, startDate, endDate, selectedCategories])

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
            const total = filteredTransactions
                .filter(t => t.type === 'EXPENSE' && t.categoryId === cat.id)
                .reduce((sum, t) => sum + t.amount, 0)
            return { name: cat.name, value: total }
        }).filter(d => d.value > 0).sort((a, b) => b.value - a.value)
        
        return catTotals
    }, [filteredTransactions, categories])

    const totalIncome = useMemo(() => filteredTransactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0), [filteredTransactions])
    const totalExpense = useMemo(() => filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0), [filteredTransactions])
    const netProfit = totalIncome - totalExpense

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
                label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
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
            if (t.type === 'INCOME') dataMap[key].income += t.amount
            else dataMap[key].expense += t.amount
            dataMap[key].net = dataMap[key].income - dataMap[key].expense
        })

        return Object.values(dataMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    }, [filteredTransactions, viewMode])

    const COLORS = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#94a3b8']

    // 3. Performance by Property
    const propertyData = useMemo(() => {
        const props: Record<string, { name: string, income: number, expense: number }> = {}
        transactions.forEach(t => {
            if (t.propertyId) {
                const pname = properties.find(p => p.id === t.propertyId)?.name || "Unknown"
                if (!props[t.propertyId]) props[t.propertyId] = { name: pname, income: 0, expense: 0 }
                if (t.type === "INCOME") props[t.propertyId].income += t.amount
                else props[t.propertyId].expense += t.amount
            }
        })
        return Object.values(props).map(p => ({
            name: p.name,
            profit: p.income - p.expense
        }))
    }, [transactions, properties])

    return (
        <div className="space-y-6">
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <Card className="bg-white/50 border-0 shadow-sm p-4 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl">↑</div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Period Income</p>
                        <p className="text-xl font-black text-slate-900">${totalIncome.toLocaleString()}</p>
                    </div>
                </Card>
                <Card className="bg-white/50 border-0 shadow-sm p-4 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center text-xl">↓</div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Period Expense</p>
                        <p className="text-xl font-black text-slate-900">${totalExpense.toLocaleString()}</p>
                    </div>
                </Card>
                <Card className={cn("border-0 shadow-sm p-4 rounded-2xl flex items-center gap-4", netProfit >= 0 ? "bg-indigo-50/30" : "bg-rose-50/30")}>
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-xl", netProfit >= 0 ? "bg-indigo-100 text-indigo-600" : "bg-rose-100 text-rose-600")}>
                        {netProfit >= 0 ? "✓" : "!"}
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Net Savings / Profit</p>
                        <p className={cn("text-xl font-black", netProfit >= 0 ? "text-indigo-600" : "text-rose-600")}>
                            ${Math.abs(netProfit).toLocaleString()}
                        </p>
                    </div>
                </Card>
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
                                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    formatter={(value: any) => [`$${parseFloat(value).toFixed(2)}`, '']}
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
                                    <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
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
            </div>
        </div>
    )
}

export function CSVImport({ existingTransactions }: { existingTransactions: any[] }) {
    const [open, setOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [previewData, setPreviewData] = useState<any[]>([])
    const [status, setStatus] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)
    
    function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files?.[0]) {
            const selectedFile = e.target.files[0]
            setFile(selectedFile)
            setStatus("")
            
            Papa.parse(selectedFile, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const parsed = results.data.map((row: any) => {
                        // Normalize keys for case-insensitive and trimmed matching
                        const normalizedRow: Record<string, string> = {};
                        Object.keys(row).forEach(k => {
                            normalizedRow[k.trim().toLowerCase()] = row[k];
                        });

                        const findVal = (candidates: string[]) => {
                            const foundKey = Object.keys(normalizedRow).find(k => candidates.includes(k));
                            return foundKey ? normalizedRow[foundKey] : "";
                        }
                        
                        // Lowercase candidates for matching
                        const dateVal = findVal(['posting date', 'transaction date', 'date', 'date (utc)', 'trans_date']);
                        const descVal = findVal(['transaction description', 'description', 'descriptio', 'memo', 'trans_desc', 'payee', 'details']); 
                        const amountVal = findVal(['amount', 'value', 'amount (usd)', 'trans_amount']);
                        
                        const dateRaw = dateVal || new Date().toISOString();
                        const descBase = descVal || 'Imported Transaction'; 
                        
                        // Robust Amount Parsing
                        let amountStr = (amountVal || '0').toString().trim();
                        let isNegative = false;
                        
                        // Detect accounting negative format ($100.00) or (100.00)
                        if (amountStr.startsWith('(') && amountStr.endsWith(')')) {
                            isNegative = true;
                        }
                        // Detect logic negative signs
                        if (amountStr.includes('-')) {
                            isNegative = true;
                        }

                        // Remove all non-numeric characters except dot and minus (though we handle minus manually)
                        // This removes $, ,, (, )
                        const cleanAmountStr = amountStr.replace(/[^0-9.]/g, '');
                        
                        let rawAmount = parseFloat(cleanAmountStr);
                        if (isNaN(rawAmount)) rawAmount = 0;
                        if (isNegative) rawAmount = -Math.abs(rawAmount);

                        const amount = Math.abs(rawAmount);
                        
                        // Clean description
                        let desc = descBase;
                        // Avoid generic bank descriptions if possible
                        if (['DEBIT', 'CREDIT', 'ACH DEBIT', 'ACH CREDIT'].some(s => descBase.toUpperCase().includes(s)) && normalizedRow['description']) {
                             const altDesc = normalizedRow['description'];
                             if (altDesc && altDesc.length > desc.length) desc = altDesc;
                        }
                        
                        // Type detection
                        const typeVal = (normalizedRow['details'] || normalizedRow['type'] || "").toUpperCase();
                        let type = rawAmount >= 0 ? "INCOME" : "EXPENSE";
                        
                        // Override type if explicit keywords found
                        if (typeVal.includes('DEBIT')) type = "EXPENSE";
                        if (typeVal.includes('CREDIT')) type = "INCOME";
                        // If amount is negative, it's an expense (accounting standard usually)
                        if (rawAmount < 0) type = "EXPENSE";

                        // Check for potential duplicate
                        const isDuplicate = existingTransactions.some(et => 
                            new Date(et.date).toISOString().split('T')[0] === new Date(dateRaw).toISOString().split('T')[0] &&
                            et.amount === amount &&
                            et.description === desc &&
                            et.type === type
                        )

                        return { date: dateRaw, description: desc, amount, type, isDuplicate }
                    }).filter(t => t.amount !== 0)
                    setPreviewData(parsed)
                }
            })
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
        
        const res = await importTransactions(previewData)
        setIsLoading(false)

        if (res.success) {
            toast.success(`Imported ${res.count} transactions`)
            setOpen(false)
            setFile(null)
            setPreviewData([])
            setStatus("")
        } else {
            toast.error(res.error || "Upload failed")
            setStatus(`Error: ${res.error || "Upload failed"}`)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="outline">Import CSV</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <DialogTitle>Import Bank CSV</DialogTitle>
                        <DialogDescription>Review transactions before confirming. Yellow rows indicate potential duplicates.</DialogDescription>
                    </div>
                    {file && previewData.some(p => p.isDuplicate) && (
                        <Button variant="outline" size="sm" onClick={removeDuplicatesFromPreview} className="text-amber-600 border-amber-200 hover:bg-amber-50">
                            Remove All Duplicates
                        </Button>
                    )}
                </DialogHeader>
                <div className="flex-1 overflow-y-auto py-4">
                    {!file ? (
                        <div className="border-2 border-dashed rounded-lg p-12 text-center space-y-4">
                            <div className="text-4xl">📄</div>
                            <p className="text-sm text-muted-foreground">Supports Chase, PNC, and Standard CSV formats</p>
                            <Input type="file" accept=".csv" onChange={onFileChange} className="max-w-xs mx-auto" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-24">Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {previewData.map((p, i) => (
                                    <TableRow key={i} className={cn(p.isDuplicate && "bg-amber-50 text-amber-900")}>
                                        <TableCell className="text-xs">{new Date(p.date).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <div className="text-sm font-medium">{p.description}</div>
                                            {p.isDuplicate && <span className="text-[10px] font-bold uppercase">Potential Duplicate</span>}
                                        </TableCell>
                                        <TableCell className={cn("text-right font-bold text-sm", p.type === "INCOME" ? "text-emerald-600" : "text-rose-600")}>
                                            {p.type === "INCOME" ? "+" : "-"}${p.amount.toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
                {file && (
                    <div className="pt-4 border-t space-y-4">
                         {status && <p className={cn("text-center font-medium py-2 rounded text-sm", status.includes("Error") ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600")}>{status}</p>}
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => {setFile(null); setPreviewData([])}} disabled={isLoading}>Cancel</Button>
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

function RemoveDuplicatesDialog({ transactions }: { transactions: any[] }) {
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
                                        <TableCell className="text-xs">{new Date(t.date).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-sm">{t.description}</TableCell>
                                        <TableCell className="text-right text-sm">${t.amount.toFixed(2)}</TableCell>
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
                                    This will PERMANENTLY delete ALL your transactions. This cannot be undone. 
                                    Categories and properties will be kept.
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
        const formData = new FormData(e.currentTarget)
        await addProperty(formData)
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

export function ManageCategories({ categories, trigger }: { categories: any[], trigger?: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    const [type, setType] = useState("EXPENSE")

      async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault()
      const formData = new FormData(e.currentTarget)
      await addCategory(formData)
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

export function UserSettings({ session, categories, properties }: { session: any, categories: any[], properties: any[] }) {
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

export function MonthlyReportDialog({ transactions, startDate, endDate }: { transactions: any[], startDate: string, endDate: string }) {
    const [open, setOpen] = useState(false)
    const income = transactions.filter(t => t.type === "INCOME").reduce((sum, t) => sum + t.amount, 0)
    const expense = transactions.filter(t => t.type === "EXPENSE").reduce((sum, t) => sum + t.amount, 0)
    const balance = income - expense

    const categorySummaries = transactions.reduce((acc: any, t) => {
        const catName = t.category?.name || "Uncategorized"
        if (!acc[catName]) acc[catName] = { name: catName, income: 0, expense: 0, count: 0 }
        if (t.type === "INCOME") acc[catName].income += t.amount
        else acc[catName].expense += t.amount
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
                            <p className="text-slate-500 font-medium mt-1">{new Date(startDate).toLocaleDateString()} — {new Date(endDate).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-bold text-indigo-600 uppercase tracking-widest">iCost Summary</div>
                            <div className="text-xs text-slate-400 mt-1">Generated: {new Date().toLocaleDateString()}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6 mb-10">
                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm">
                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Income</div>
                            <div className="text-2xl font-black text-emerald-700">${income.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 shadow-sm">
                            <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Total Expense</div>
                            <div className="text-2xl font-black text-rose-700">${expense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Net Balance</div>
                            <div className="text-2xl font-black text-slate-900">${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
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
                                        <TableCell className="text-right text-emerald-600 font-bold">${cat.income.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-rose-600 font-bold">${cat.expense.toLocaleString()}</TableCell>
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
