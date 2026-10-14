import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/session";
import { sendLike } from "@/lib/matching";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";

const schema = z.object({
  toUserId: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await requireMember();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await limitFor("likesPerUser", user.id);
  if (!limited.ok) {
    return tooManyRequests(limited, "You've reached today's like limit.");
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await sendLike(user.id, parsed.data.toUserId);
    if (result.newMatch && result.match) {
      const link = `/messages/${result.match.id}`;
      await notify(parsed.data.toUserId, {
        type: "match",
        title: `You matched with ${user.profile?.displayName ?? "someone"}!`,
        body: "Say hi — messaging is free.",
        link,
        email: true,
      });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Like failed" },
      { status: 400 },
    );
  }
}
