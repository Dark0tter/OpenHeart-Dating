import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { AccountStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { limitFor } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { passesBotCheck } from "@/lib/bot-check";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  botToken: z.string().optional(),
});

class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

class BotCheckFailed extends CredentialsSignin {
  code = "bot_check";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        botToken: {},
      },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        const ip = await clientIp(request);

        const [byEmail, byIp] = await Promise.all([
          limitFor("loginPerEmail", email),
          limitFor("loginPerIp", ip),
        ]);
        if (!byEmail.ok || !byIp.ok) throw new RateLimited();
        if (!(await passesBotCheck(parsed.data.botToken, ip))) {
          throw new BotCheckFailed();
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { profile: true },
        });
        if (!user || user.accountStatus === AccountStatus.DELETED) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.profile?.displayName ?? user.email,
          sv: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.sv = user.sv ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.sv = token.sv ?? 0;
      }
      return session;
    },
  },
});
