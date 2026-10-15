/**
 * Sets an account's role. This is the only way to make someone OWNER (the
 * owner then promotes and demotes staff from /owner/staff).
 *   npm run staff:set -- you@example.com OWNER
 */
import { PrismaClient, UserRole } from "@prisma/client";

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !role || !(role in UserRole)) {
    console.error(
      "Usage: npm run staff:set -- <email> <MEMBER|MODERATOR|ADMIN|OWNER>",
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
