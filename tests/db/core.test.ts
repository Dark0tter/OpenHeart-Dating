import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => [] as { to: string; subject: string }[]);
vi.mock("@/lib/email", () => ({
  emailConfigured: () => true,
  sendEmail: async (e: { to: string; subject: string }) => {
    sent.push({ to: e.to, subject: e.subject });
    return true;
  },
}));

import { prisma } from "@/lib/prisma";
import { sendLike } from "@/lib/matching";
import { blockUser } from "@/lib/safety";
import { rateLimit } from "@/lib/rate-limit";
import { runJobs, CHECKIN_GRACE_MS } from "@/lib/jobs";
import { applyProviderDecision } from "@/lib/verification";
import { orderedPair } from "@/lib/utils";
import { dailyDigest, staffAlerts } from "@/lib/staff-alerts";
import { pickSponsorPlacement, recordSponsorEvent } from "@/lib/sponsors";
import { busy, canCall, expireCalls, RING_MS } from "@/lib/calls";

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

async function makeUser(name = "Test") {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@test.local`,
      passwordHash: "x",
      dateOfBirth: new Date("1990-01-01"),
      profile: { create: { displayName: name } },
    },
  });
  return user;
}

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(() => {
  sent.length = 0;
});

describe("likes and matches", () => {
  it("matches only when the like is mutual", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const first = await sendLike(a.id, b.id);
    expect(first.isMatch).toBe(false);
    const second = await sendLike(b.id, a.id);
    expect(second.isMatch).toBe(true);
    expect(second.newMatch).toBe(true);
  });

  it("refuses likes between blocked people", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await blockUser(b.id, a.id);
    await expect(sendLike(a.id, b.id)).rejects.toThrow();
  });

  it("blocking removes the match, likes and messages", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await sendLike(a.id, b.id);
    const { match } = await sendLike(b.id, a.id);
    await prisma.message.create({
      data: { matchId: match!.id, senderId: a.id, body: "hi" },
    });
    await blockUser(a.id, b.id);
    const [ua, ub] = orderedPair(a.id, b.id);
    const after = await prisma.match.findUnique({
      where: { userAId_userBId: { userAId: ua, userBId: ub } },
    });
    expect(after?.unmatchedAt).not.toBeNull();
    expect(await prisma.message.count({ where: { matchId: match!.id } })).toBe(
      0,
    );
    expect(
      await prisma.like.count({
        where: { OR: [{ fromUserId: a.id }, { fromUserId: b.id }] },
      }),
    ).toBe(0);
  });
});

describe("rate limiting", () => {
  it("allows up to the limit, then refuses", async () => {
    const id = randomUUID();
    const results = [];
    for (let i = 0; i < 4; i++)
      results.push(await rateLimit("test", id, 3, 3600));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[3].retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("date check-ins", () => {
  it("reminds the member, then alerts the contact after the grace period", async () => {
    const user = await makeUser("Robin");
    const now = new Date();
    const c = await prisma.safetyCheckIn.create({
      data: {
        userId: user.id,
        meetingWith: "Sam",
        place: "Cafe",
        startsAt: new Date(now.getTime() - 3 * 60 * MIN),
        checkInBy: new Date(now.getTime() - MIN),
        contactName: "Alex",
        contactEmail: "alex@test.local",
      },
    });

    await runJobs(now);
    let row = await prisma.safetyCheckIn.findUniqueOrThrow({
      where: { id: c.id },
    });
    expect(row.remindedAt).not.toBeNull();
    expect(row.status).toBe("active");
    expect(
      await prisma.notification.count({
        where: { userId: user.id, link: "/safety/check-in" },
      }),
    ).toBe(1);
    expect(sent.filter((e) => e.to === "alex@test.local")).toHaveLength(0);

    await runJobs(new Date(now.getTime() + CHECKIN_GRACE_MS));
    row = await prisma.safetyCheckIn.findUniqueOrThrow({ where: { id: c.id } });
    expect(row.status).toBe("alerted");
    const alerts = sent.filter((e) => e.to === "alex@test.local");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].subject).toContain("Robin");

    // Running again doesn't email twice.
    await runJobs(new Date(now.getTime() + CHECKIN_GRACE_MS + MIN));
    expect(sent.filter((e) => e.to === "alex@test.local")).toHaveLength(1);
  });

  it("does nothing once the member says they're safe", async () => {
    const user = await makeUser();
    const now = new Date();
    await prisma.safetyCheckIn.create({
      data: {
        userId: user.id,
        meetingWith: "Sam",
        place: "Park",
        startsAt: new Date(now.getTime() - 2 * 60 * MIN),
        checkInBy: new Date(now.getTime() - 60 * MIN),
        contactName: "Jo",
        contactEmail: "jo@test.local",
        status: "safe",
        endedAt: now,
      },
    });
    await runJobs(now);
    expect(sent.filter((e) => e.to === "jo@test.local")).toHaveLength(0);
  });
});

describe("unmatched conversation clean-up", () => {
  it("deletes messages 30 days after an unmatch unless a report holds them", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const c = await makeUser();
    const [x1, x2] = orderedPair(a.id, b.id);
    const [y1, y2] = orderedPair(a.id, c.id);
    const old = new Date(Date.now() - 31 * DAY);
    const plain = await prisma.match.create({
      data: { userAId: x1, userBId: x2, unmatchedAt: old },
    });
    const reported = await prisma.match.create({
      data: { userAId: y1, userBId: y2, unmatchedAt: old },
    });
    await prisma.message.createMany({
      data: [
        { matchId: plain.id, senderId: a.id, body: "one" },
        { matchId: reported.id, senderId: c.id, body: "threat" },
      ],
    });
    await prisma.report.create({
      data: { reporterId: a.id, reportedUserId: c.id, reason: "THREATS" },
    });

    await runJobs();
    expect(await prisma.message.count({ where: { matchId: plain.id } })).toBe(
      0,
    );
    expect(
      await prisma.message.count({ where: { matchId: reported.id } }),
    ).toBe(1);
  });
});

describe("age verification decisions", () => {
  it("marks a verified adult", async () => {
    const user = await makeUser();
    await prisma.verification.create({
      data: {
        userId: user.id,
        status: "PENDING",
        provider: "persona",
        providerReference: `ref_${user.id}`,
      },
    });
    const v = await applyProviderDecision({
      providerReference: `ref_${user.id}`,
      outcome: "VERIFIED_ADULT",
    });
    expect(v?.status).toBe("VERIFIED_ADULT");
    expect(v?.verifiedAt).not.toBeNull();
  });

  it("suspends and reports someone found to be under 18", async () => {
    const user = await makeUser();
    await prisma.verification.create({
      data: {
        userId: user.id,
        status: "PENDING",
        provider: "persona",
        providerReference: `ref_${user.id}`,
      },
    });
    await applyProviderDecision({
      providerReference: `ref_${user.id}`,
      outcome: "REJECTED",
      underage: true,
    });
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(after.accountStatus).toBe("SUSPENDED");
    expect(after.sessionVersion).toBe(1);
    expect(
      await prisma.report.count({
        where: { reportedUserId: user.id, reason: "UNDERAGE" },
      }),
    ).toBe(1);
  });

  it("ignores unknown references", async () => {
    expect(
      await applyProviderDecision({
        providerReference: "nope",
        outcome: "VERIFIED_ADULT",
      }),
    ).toBeNull();
  });
});

// Runs last: it appoints a staff member, who then receives every alert.
describe("staff alerts", () => {
  it("alerts staff once about an urgent report", async () => {
    const admin = await makeUser("Admin");
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: "ADMIN" },
    });
    const target = await makeUser();
    const report = await prisma.report.create({
      data: { reportedUserId: target.id, reason: "THREATS", priority: "HIGH" },
    });

    await staffAlerts(new Date());
    const toAdmin = sent.filter((e) => e.to === admin.email);
    expect(toAdmin).toHaveLength(1);
    expect(toAdmin[0].subject.toLowerCase()).toContain("urgent");
    const row = await prisma.report.findUniqueOrThrow({
      where: { id: report.id },
    });
    expect(row.staffAlertedAt).not.toBeNull();
    expect(
      await prisma.notification.count({
        where: { userId: admin.id, type: "staff_alert" },
      }),
    ).toBe(1);

    await staffAlerts(new Date());
    expect(sent.filter((e) => e.to === admin.email)).toHaveLength(1);
  });

  it("doesn't alert about ordinary reports", async () => {
    const target = await makeUser();
    await prisma.report.create({
      data: { reportedUserId: target.id, reason: "SPAM" },
    });
    await staffAlerts(new Date());
    expect(sent).toHaveLength(0);
  });

  it("sends the daily summary once a day, after the set hour", async () => {
    expect((await dailyDigest(new Date("2099-01-01T12:00:00Z"))).sent).toBe(
      false,
    );
    expect((await dailyDigest(new Date("2099-01-01T14:00:00Z"))).sent).toBe(
      true,
    );
    expect(sent.some((e) => e.subject.includes("Daily summary"))).toBe(true);
    expect((await dailyDigest(new Date("2099-01-01T20:00:00Z"))).sent).toBe(
      false,
    );
    expect((await dailyDigest(new Date("2099-01-02T14:00:00Z"))).sent).toBe(
      true,
    );
  });
});

describe("sponsors", () => {
  const ALL = ["STANDARD", "ADULT_TEXT", "WEB_ONLY"] as const;

  async function placement(data: {
    approved: boolean;
    tier: "STANDARD" | "WEB_ONLY";
  }) {
    return prisma.sponsorPlacement.create({
      data: {
        sponsorName: "Test sponsor",
        title: "Hello",
        linkUrl: "https://example.org",
        targetKinkSlugs: [],
        targetGoalSlugs: [],
        contentTier: data.tier,
        approvedAt: data.approved ? new Date() : null,
        dailyCap: 3,
      },
    });
  }

  it("never shows unapproved listings, and the apps only get ones approved for everyone", async () => {
    await prisma.sponsorPlacement.deleteMany();
    await placement({ approved: false, tier: "STANDARD" });
    expect(await pickSponsorPlacement(null, [...ALL])).toBeNull();

    const web = await placement({ approved: true, tier: "WEB_ONLY" });
    expect((await pickSponsorPlacement(null, [...ALL]))?.id).toBe(web.id);
    expect(
      await pickSponsorPlacement(null, [...ALL], { app: true }),
    ).toBeNull();

    const everyone = await placement({ approved: true, tier: "STANDARD" });
    expect(
      (await pickSponsorPlacement(null, [...ALL], { app: true }))?.id,
    ).toBe(everyone.id);
  });

  it("respects the per-person daily limit", async () => {
    await prisma.sponsorPlacement.deleteMany();
    const p = await placement({ approved: true, tier: "STANDARD" });
    expect(
      await pickSponsorPlacement(null, [...ALL], { seen: { [p.id]: 3 } }),
    ).toBeNull();
    expect(
      await pickSponsorPlacement(null, [...ALL], {
        app: true,
        seen: { [p.id]: 2 },
      }),
    ).toBeNull();
    expect(
      (await pickSponsorPlacement(null, [...ALL], { seen: { [p.id]: 2 } }))?.id,
    ).toBe(p.id);
  });

  it("keeps anonymous daily totals", async () => {
    await prisma.sponsorPlacement.deleteMany();
    const p = await placement({ approved: true, tier: "STANDARD" });
    const now = new Date("2026-10-14T12:00:00Z");
    await recordSponsorEvent(p.id, "view", false, now);
    await recordSponsorEvent(p.id, "view", true, now);
    await recordSponsorEvent(p.id, "click", true, now);
    const rows = await prisma.sponsorDailyStat.findMany({
      where: { placementId: p.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ views: 2, appViews: 1, clicks: 1 });
  });
});

describe("calls", () => {
  async function matched() {
    const a = await makeUser("Caller");
    const b = await makeUser("Callee");
    await sendLike(a.id, b.id);
    const { match } = await sendLike(b.id, a.id);
    return { a, b, matchId: match!.id };
  }

  it("needs both people to have messaged, and respects 'no calls'", async () => {
    const { a, b, matchId } = await matched();
    expect(await canCall(a.id, matchId)).toMatchObject({
      ok: false,
      status: 403,
    });

    await prisma.message.create({
      data: { matchId, senderId: a.id, body: "hi" },
    });
    expect((await canCall(a.id, matchId)).ok).toBe(false);
    await prisma.message.create({
      data: { matchId, senderId: b.id, body: "hey" },
    });
    expect(await canCall(a.id, matchId)).toEqual({ ok: true, otherId: b.id });

    await prisma.user.update({
      where: { id: b.id },
      data: { allowCalls: false },
    });
    expect(await canCall(a.id, matchId)).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("isn't possible for strangers", async () => {
    const { matchId } = await matched();
    const stranger = await makeUser();
    expect(await canCall(stranger.id, matchId)).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("marks unanswered calls as missed and tells the person called", async () => {
    const { a, b, matchId } = await matched();
    const call = await prisma.call.create({
      data: { matchId, callerId: a.id, calleeId: b.id },
    });
    expect(await busy([b.id])).toBe(true);
    await expireCalls(new Date(Date.now() + RING_MS + 1000));
    const after = await prisma.call.findUniqueOrThrow({
      where: { id: call.id },
    });
    expect(after.status).toBe("missed");
    expect(
      await prisma.notification.count({
        where: { userId: b.id, type: "call" },
      }),
    ).toBe(1);
    expect(await busy([a.id, b.id])).toBe(false);
  });

  it("ends a live call when someone blocks", async () => {
    const { a, b, matchId } = await matched();
    const call = await prisma.call.create({
      data: {
        matchId,
        callerId: a.id,
        calleeId: b.id,
        status: "active",
        answeredAt: new Date(),
      },
    });
    await blockUser(b.id, a.id);
    const after = await prisma.call.findUniqueOrThrow({
      where: { id: call.id },
    });
    expect(after.status).toBe("ended");
  });
});
