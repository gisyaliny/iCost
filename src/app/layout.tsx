import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "sonner";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Category, Property } from "@prisma/client";
import { projectView, settingsView } from "@/lib/finance-view";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "iCost - Family Expense Tracker",
  description: "Track your family expenses easily.",
  applicationName: "iCost",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  
  let categories: Category[] = [];
  let properties: Property[] = [];
  let projects: Array<{ id: string; name: string; description: string | null; budget: number | null; startDate: Date | null; endDate: Date | null; status: string; isArchived: boolean; createdAt: Date; userId: string }> = [];
  let userSettings: { monthlyBudget: number; currency: string; locale: string; timezone: string } | null = null;
  let categoryRules: Array<{ id: string; name: string; pattern: string; matchType: string; category: Category }> = [];
  
  if (session?.user?.id) {
    categories = await prisma.category.findMany();
    properties = await prisma.property.findMany({
      where: { userId: session.user.id, isArchived: false }
    });
    const projectRows = await prisma.project.findMany({
      where: { userId: session.user.id, isArchived: false },
      orderBy: { createdAt: "desc" }
    });
    projects = projectRows.map(projectView);
    const userSettingsRow = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { monthlyBudgetCents: true, currency: true, locale: true, timezone: true }
    });
    userSettings = userSettingsRow ? settingsView(userSettingsRow) : null;
    categoryRules = await prisma.categoryRule.findMany({
      where: { userId: session.user.id, isEnabled: true },
      include: { category: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }]
    });
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <Navbar session={session} categories={categories} properties={properties} projects={projects} userSettings={userSettings} categoryRules={categoryRules} />
          <main className="container mx-auto px-0 py-3 sm:p-4">
             {children}
          </main>
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  );
}
