/**
 * Makes an existing account a moderator or admin (or back to member).
 *   npm run staff:set -- someone@example.com MODERATOR
 */
import { PrismaClient, UserRole } from "@prisma/client";

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !role || !(role in UserRole)) {
    console.error(
      "Usage: npm run staff:set -- <email> <MEMBER|MODERATOR|ADMIN>",
    );
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { role: role as UserRole },
      select: { email: true, role: true },
    });
    console.log(`${user.email} is now ${user.role}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
