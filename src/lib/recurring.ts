import { prisma } from "@/lib/prisma"

function nextOccurrence(current: Date, anchor: Date, frequency: string, interval = 1) {
  const next = new Date(current)
  if (frequency === "DAILY") next.setUTCDate(next.getUTCDate() + interval)
  else if (frequency === "WEEKLY") next.setUTCDate(next.getUTCDate() + (7 * interval))
  else if (frequency === "MONTHLY") {
    const monthIndex = next.getUTCMonth() + interval
    const year = next.getUTCFullYear() + Math.floor(monthIndex / 12)
    const month = ((monthIndex % 12) + 12) % 12
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    next.setUTCFullYear(year, month, Math.min(anchor.getUTCDate(), lastDay))
  } else if (frequency === "YEARLY") {
    const year = next.getUTCFullYear() + interval
    const lastDay = new Date(Date.UTC(year, anchor.getUTCMonth() + 1, 0)).getUTCDate()
    next.setUTCFullYear(year, anchor.getUTCMonth(), Math.min(anchor.getUTCDate(), lastDay))
  } else return null
  return next
}

export async function postDueRecurringTransactions(userId: string) {
  const today = new Date()
  today.setUTCHours(23, 59, 59, 999)
  const schedules = await prisma.recurringSchedule.findMany({
    where: { userId, isActive: true, autoPost: true, nextDate: { lte: today } },
    include: { transactions: { orderBy: { date: "asc" }, take: 1, select: { date: true } } },
  })

  for (const schedule of schedules) {
    const anchor = schedule.transactions[0]?.date || schedule.nextDate
    let dueDate = schedule.nextDate
    let generated = 0

    while (dueDate <= today && generated < 366) {
      const expectedTime = dueDate.getTime()
      const result = await prisma.$transaction(async tx => {
        const current = await tx.recurringSchedule.findUnique({ where: { id: schedule.id } })
        if (!current?.isActive || current.nextDate.getTime() !== expectedTime) return null
        if (current.endDate && current.nextDate > current.endDate) {
          await tx.recurringSchedule.update({ where: { id: current.id }, data: { isActive: false } })
          return null
        }

        await tx.transaction.create({
          data: {
            amountCents: current.amountCents,
            description: current.description,
            note: current.note,
            date: current.nextDate,
            type: current.type,
            source: "RECURRING",
            reviewed: true,
            userId: current.userId,
            categoryId: current.categoryId,
            propertyId: current.propertyId,
            projectId: current.projectId,
            accountId: current.accountId,
            recurringScheduleId: current.id,
          },
        })

        const nextDate = nextOccurrence(current.nextDate, anchor, current.frequency, current.interval)
        const isActive = Boolean(nextDate && (!current.endDate || nextDate <= current.endDate))
        await tx.recurringSchedule.update({
          where: { id: current.id },
          data: { nextDate: nextDate || current.nextDate, isActive },
        })
        return nextDate
      })

      if (!result) break
      dueDate = result
      generated += 1
    }
  }
}
