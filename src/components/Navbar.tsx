"use client"


import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { UserSettings } from "./DashboardComponents"
import type { Category, Property } from "@prisma/client"
import type { Session } from "next-auth"

type NavbarProps = {
  session: Session | null
  categories: Category[]
  properties: Property[]
  projects: Array<{ id: string; name: string; description: string | null; budget: number | null; startDate: Date | null; endDate: Date | null; status: string; isArchived: boolean; createdAt: Date; userId: string }>
  userSettings: { monthlyBudget: number; currency: string; locale: string; timezone: string } | null
  categoryRules: Array<{ id: string; name: string; pattern: string; matchType: string; category: Category }>
}

export function Navbar({ session: serverSession, categories, properties, projects, userSettings, categoryRules }: NavbarProps) {
  const { data: clientSession } = useSession()
  const session = clientSession || serverSession
  const pathname = usePathname()
  const navItems = [
    { href: "/", label: "Transactions", icon: "↕" },
    { href: "/projects", label: "Projects", icon: "📌" },
    { href: "/recurring", label: "Recurring", icon: "⟳" },
    { href: "/analysis", label: "Analysis", icon: "▥" },
  ]

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
      <div className="flex h-16 items-center px-4 container mx-auto justify-between">
        <Link href="/" className="flex items-center gap-2 group">
            <Image src="/icon.png" alt="iCost" width={36} height={36} priority className="h-9 w-9 rounded-xl object-cover shadow-sm transition-transform group-hover:scale-105" />
            <span className="font-black text-xl tracking-tight text-slate-900">iCost</span>
        </Link>
        <div className="hidden md:flex items-center gap-1 flex-1 ml-10">
          <Link 
            href="/" 
            className={cn(
                "px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200",
                pathname === "/" 
                    ? "bg-slate-900 text-white shadow-md shadow-slate-200" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            )}
          >
              Transactions
          </Link>
          <Link
            href="/projects"
            className={cn(
                "px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200",
                pathname === "/projects"
                    ? "bg-slate-900 text-white shadow-md shadow-slate-200"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            )}
          >
              Projects
          </Link>
          <Link
            href="/recurring"
            className={cn(
                "px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200",
                pathname === "/recurring"
                    ? "bg-slate-900 text-white shadow-md shadow-slate-200"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            )}
          >
              Recurring
          </Link>
          <Link
            href="/analysis" 
            className={cn(
                "px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200",
                pathname === "/analysis" 
                    ? "bg-slate-900 text-white shadow-md shadow-slate-200" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            )}
          >
              Analysis
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {session ? (
            <UserSettings session={session} categories={categories} properties={properties} projects={projects} userSettings={userSettings} categoryRules={categoryRules} />
          ) : (
            <Link href="/login">
              <Button>Login</Button>
            </Link>
          )}
        </div>
      </div>
      {session && (
        <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden">
          {navItems.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className={cn("flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold", active ? "bg-slate-900 text-white" : "text-slate-500")}>
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </nav>
  )
}
