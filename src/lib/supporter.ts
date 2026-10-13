import { prisma } from "@/lib/prisma";

export async function isSupporter(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub || sub.plan !== "supporter" || sub.status !== "active") return false;
  return !sub.currentPeriodEnd || sub.currentPeriodEnd > new Date();
}
