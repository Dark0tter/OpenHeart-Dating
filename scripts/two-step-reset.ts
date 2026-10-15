/**
 * Turns off two-step sign-in for an account that lost its phone and recovery
 * codes, and signs it out everywhere. Run from a trusted machine only.
 *   npm run two-step:reset -- you@example.com
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const [email] = process.argv.slice(2);
  if (!email) {
    console.error("Usage: npm run two-step:reset -- <email>");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: {
        totpSecret: null,
        totpEnabledAt: null,
        totpLastStep: null,
        recoveryCodes: [],
        sessionVersion: { increment: 1 },
      },
      select: { id: true, email: true },
    });
    await prisma.modAction.create({
      data: {
        actorId: null,
        action: "two_step_reset",
        targetUserId: user.id,
        note: "Reset from the command line",
      },
    });
    console.log(
      `Two-step sign-in is off for ${user.email}. They'll set it up again on next sign-in.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
