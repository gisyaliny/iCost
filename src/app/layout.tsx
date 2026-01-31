import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "sonner";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "iCost - Family Expense Tracker",
  description: "Track your family expenses easily.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  
  let categories: any[] = [];
  let properties: any[] = [];
  
  if (session?.user?.id) {
    categories = await prisma.category.findMany();
    properties = await prisma.property.findMany({
      where: { userId: session.user.id }
    });
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <Navbar session={session} categories={categories} properties={properties} />
          <main className="container mx-auto p-4">
             {children}
          </main>
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  );
}
