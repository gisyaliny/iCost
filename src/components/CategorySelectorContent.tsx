// This component is internal to DashboardComponents.tsx but extracted for state management
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function CategorySelectorContent({ categories, selectedCategories, toggleCategory, toggleAllCategories }: any) {
    const [search, setSearch] = useState("")
    const [activeTab, setActiveTab] = useState<"EXPENSE" | "INCOME">("EXPENSE")

    const filteredCats = categories.filter((c: any) => {
        const matchesTab = c.type === activeTab
        const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase())
        return matchesTab && matchesSearch
    })

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter by category</span>
                <Button variant="ghost" size="sm" onClick={toggleAllCategories} className="h-7 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 rounded-lg">
                    {selectedCategories.size === categories.length ? "UNSELECT ALL" : "SELECT ALL"}
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-xl">
                <button 
                    onClick={() => setActiveTab("EXPENSE")}
                    className={cn(
                        "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                        activeTab === "EXPENSE" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    Expenses
                </button>
                <button 
                    onClick={() => setActiveTab("INCOME")}
                    className={cn(
                        "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                        activeTab === "INCOME" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    Income
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Input 
                    placeholder="Search category..." 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 text-xs bg-slate-50 border-slate-200"
                />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1 pt-1">
                {filteredCats.length === 0 ? (
                    <div className="col-span-3 text-center py-8 text-xs text-slate-400 italic">No categories found</div>
                ) : (
                    filteredCats.map((c: any) => (
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
                    ))
                )}
            </div>
        </div>
    )
}
