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
import { BarChart3, Folder, List, Repeat, Sparkles } from "lucide-react"

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
    { href: "/", label: "Transactions", icon: List },
    { href: "/projects", label: "Projects", icon: Folder },
    { href: "/recurring", label: "Recurring", icon: Repeat },
    { href: "/rules", label: "Rules", icon: Sparkles },
    { href: "/analysis", label: "Analysis", icon: BarChart3 },
  ]

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200/70 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:h-16">
        <Link href="/" className="flex items-center gap-2 group">
            <Image src="/icon.png" alt="iCost" width={36} height={36} priority className="h-9 w-9 rounded-xl object-cover shadow-sm transition-transform group-hover:scale-105" />
            <span className="font-black text-xl tracking-tight text-slate-900">iCost</span>
        </Link>
        <div className="ml-10 hidden flex-1 items-center gap-1 lg:flex">
          {navItems.map(item => <Link key={item.href} href={item.href} className={cn("rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200", pathname === item.href ? "bg-slate-900 text-white shadow-md shadow-slate-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900")}>{item.label}</Link>)}
        </div>

        <div className="flex items-center gap-2">
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
        <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden">
          {navItems.map(item => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className={cn("mx-0.5 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition", active ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 active:bg-slate-100")}>
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </nav>
  )
}
