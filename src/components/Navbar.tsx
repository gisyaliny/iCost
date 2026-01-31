"use client"


import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { UserSettings } from "./DashboardComponents"

export function Navbar({ session: serverSession, categories, properties }: { session: any, categories: any[], properties: any[] }) {
  const { data: clientSession } = useSession()
  const session = clientSession || serverSession
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
      <div className="flex h-16 items-center px-4 container mx-auto justify-between">
        <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold group-hover:scale-110 transition-transform">i</div>
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
            <UserSettings session={session} categories={categories} properties={properties} />
          ) : (
            <Link href="/login">
              <Button>Login</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
