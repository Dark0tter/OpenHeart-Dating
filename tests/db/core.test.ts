import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => [] as { to: string; subject: string }[]);
const emailWorks = vi.hoisted(() => ({ value: true }));
vi.mock("@/lib/email", () => ({
  emailConfigured: () => true,
  sendEmail: async (e: { to: string; subject: string }) => {
    if (!emailWorks.value) return false;
    sent.push({ to: e.to, subject: e.subject });
    return true;
  },
}));

import { prisma } from "@/lib/prisma";
import { sendLike } from "@/lib/matching";
import { blockUser } from "@/lib/safety";
import { rateLimit } from "@/lib/rate-limit";
import { runJobs, CHECKIN_GRACE_MS } from "@/lib/jobs";
import {
  applyProviderDecision,
  finishVerification,
  retryProviderDeletions,
} from "@/lib/verification";
import { banUser, emailBanHash, identityBanHash, isBanned } from "@/lib/bans";
import { deleteAccount } from "@/lib/account-deletion";
import { orderedPair } from "@/lib/utils";
import { dailyDigest, staffAlerts } from "@/lib/staff-alerts";
import { pickSponsorPlacement, recordSponsorEvent } from "@/lib/sponsors";
import { busy, canCall, expireCalls, RING_MS } from "@/lib/calls";
import { resetStaffTwoStep, setStaffRole } from "@/lib/staff-roles";
import {
  base32Decode,
  beginTwoStep,
  confirmTwoStep,
  currentStep,
  hotp,
  verifySecondStep,
} from "@/lib/two-step";
import {
  cleanUpWaitlist,
  confirmWaitlist,
  joinWaitlist,
  leaveWaitlist,
  liveMembersIn,
  notifyCity,
  UNCONFIRMED_TTL_MS,
} from "@/lib/waitlist";
import { createSponsorInquiry } from "@/lib/sponsor-inquiries";
import { currentAnnouncements } from "@/lib/announcements";
import { cityStats } from "@/lib/owner-stats";
import {
  endSupporter,
  grantSupporter,
  isSupporter,
  supporterBadges,
} from "@/lib/supporter";

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
  emailWorks.value = true;
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

  it("blocking ends the match and likes but keeps messages for reports", async () => {
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
      1,
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

  it("keeps retrying and tells the member when the alert email fails", async () => {
    const user = await makeUser("Kai");
    const now = new Date();
    const c = await prisma.safetyCheckIn.create({
      data: {
        userId: user.id,
        meetingWith: "Sam",
        place: "Bar",
        startsAt: new Date(now.getTime() - 3 * 60 * MIN),
        checkInBy: new Date(now.getTime() - CHECKIN_GRACE_MS - MIN),
        contactName: "Lee",
        contactEmail: "lee@test.local",
        remindedAt: now,
      },
    });
    emailWorks.value = false;
    await runJobs(now);
    let row = await prisma.safetyCheckIn.findUniqueOrThrow({
      where: { id: c.id },
    });
    expect(row.status).toBe("active");
    expect(row.alertFailedAt).not.toBeNull();
    expect(
      await prisma.notification.count({
        where: { userId: user.id, title: { contains: "couldn't reach Lee" } },
      }),
    ).toBe(1);

    emailWorks.value = true;
    await runJobs(new Date(now.getTime() + 6 * MIN));
    row = await prisma.safetyCheckIn.findUniqueOrThrow({ where: { id: c.id } });
    expect(row.status).toBe("alerted");
    expect(sent.filter((e) => e.to === "lee@test.local")).toHaveLength(1);
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

describe("provider data deletion", () => {
  function fakeFetch(status: number) {
    const urls: string[] = [];
    const impl = (async (url: string) => {
      urls.push(url);
      return new Response(null, { status });
    }) as unknown as typeof fetch;
    return { impl, urls };
  }

  async function pendingCheck() {
    const user = await makeUser();
    const reference = `didit_ref_${user.id}`;
    await prisma.verification.create({
      data: {
        userId: user.id,
        status: "PENDING",
        provider: "didit",
        providerReference: reference,
      },
    });
    return { user, reference };
  }

  it("deletes the provider's copy as soon as the result arrives", async () => {
    vi.stubEnv("DIDIT_API_KEY", "test-key");
    const { user, reference } = await pendingCheck();
    const sessionId = randomUUID();
    const ok = fakeFetch(204);
    await finishVerification(
      "didit",
      {
        reference,
        sessionId,
        outcome: "VERIFIED_ADULT",
        identity: { first: "Ana", last: "Lee", birthdate: "1990-05-01" },
      },
      ok.impl,
    );
    const v = await prisma.verification.findUniqueOrThrow({
      where: { userId: user.id },
    });
    expect(v.status).toBe("VERIFIED_ADULT");
    expect(v.providerSessionId).toBe(sessionId);
    expect(v.providerDataDeletedAt).not.toBeNull();
    expect(ok.urls).toEqual([
      `https://verification.didit.me/v3/session/${sessionId}/delete/`,
    ]);
    vi.unstubAllEnvs();
  });

  it("keeps retrying a failed deletion until the provider confirms", async () => {
    vi.stubEnv("DIDIT_API_KEY", "test-key");
    const { user, reference } = await pendingCheck();
    const sessionId = randomUUID();
    await finishVerification(
      "didit",
      {
        reference,
        sessionId,
        outcome: "REJECTED",
        identity: { first: null, last: null, birthdate: null },
      },
      fakeFetch(500).impl,
    );
    const failed = await prisma.verification.findUniqueOrThrow({
      where: { userId: user.id },
    });
    expect(failed.providerDataDeletedAt).toBeNull();

    const later = new Date(Date.now() + 16 * MIN);
    const ok = fakeFetch(204);
    await retryProviderDeletions(later, ok.impl);
    const done = await prisma.verification.findUniqueOrThrow({
      where: { userId: user.id },
    });
    expect(done.providerDataDeletedAt).not.toBeNull();
    expect(ok.urls).toContain(
      `https://verification.didit.me/v3/session/${sessionId}/delete/`,
    );
    vi.unstubAllEnvs();
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

  it("blocks a banned person from verifying a new account", async () => {
    const first = await makeUser();
    const hash = identityBanHash("Jo", "Doe", "1990-01-01");
    await prisma.verification.create({
      data: { userId: first.id, status: "VERIFIED_ADULT", identityHash: hash },
    });
    await banUser(first.id, "test");
    expect(await isBanned(emailBanHash(first.email))).toBe(true);

    const second = await makeUser();
    await prisma.verification.create({
      data: {
        userId: second.id,
        status: "PENDING",
        provider: "persona",
        providerReference: `ref_${second.id}`,
      },
    });
    const v = await applyProviderDecision({
      providerReference: `ref_${second.id}`,
      outcome: "VERIFIED_ADULT",
      identityHash: identityBanHash("JO", "Doe", "1990-01-01"),
    });
    expect(v?.status).toBe("REJECTED");
    expect(v?.banEvasion).toBe(true);
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: second.id },
    });
    expect(after.accountStatus).toBe("SUSPENDED");
    expect(await isBanned(emailBanHash(second.email))).toBe(true);
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

describe("supporters", () => {
  it("can be granted, shown or hidden, and ended", async () => {
    const u = await makeUser();
    expect(await isSupporter(u.id)).toBe(false);
    await grantSupporter({ userId: u.id, months: 1, note: "test" });
    expect(await isSupporter(u.id)).toBe(true);
    expect((await supporterBadges([u.id])).has(u.id)).toBe(true);

    await prisma.subscription.update({
      where: { userId: u.id },
      data: { showBadge: false },
    });
    expect((await supporterBadges([u.id])).has(u.id)).toBe(false);

    await prisma.user.update({
      where: { id: u.id },
      data: { adPreference: "NONE" },
    });
    await prisma.sponsorPlacement.deleteMany();
    const p = await prisma.sponsorPlacement.create({
      data: {
        sponsorName: "Test sponsor",
        title: "Hello",
        linkUrl: "https://example.org",
        targetKinkSlugs: [],
        targetGoalSlugs: [],
        contentTier: "STANDARD",
        approvedAt: new Date(),
      },
    });
    expect(await pickSponsorPlacement(u.id, ["STANDARD"])).toBeNull();
    expect(
      (await pickSponsorPlacement(u.id, ["STANDARD"], { app: true }))?.id,
    ).toBe(p.id);

    await endSupporter(u.id);
    expect(await isSupporter(u.id)).toBe(false);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.adPreference).toBe("GENERIC");
  });
});

describe("account deletion", () => {
  it("keeps a held account until the hold is lifted, then finishes", async () => {
    const reporter = await makeUser();
    const user = await makeUser();
    const report = await prisma.report.create({
      data: {
        reporterId: reporter.id,
        reportedUserId: user.id,
        reason: "UNDERAGE",
        legalHold: true,
      },
    });
    await deleteAccount(prisma, user.id);
    const held = await prisma.user.findUnique({ where: { id: user.id } });
    expect(held?.accountStatus).toBe("DELETED");
    expect(await prisma.profile.count({ where: { userId: user.id } })).toBe(0);

    await runJobs(new Date());
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);

    await prisma.report.update({
      where: { id: report.id },
      data: { legalHold: false },
    });
    await runJobs(new Date());
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(0);
  });
});

describe("retention clean-up", () => {
  it("erases deleted posts after 30 days unless the author is under review", async () => {
    const author = await makeUser();
    const reported = await makeUser();
    const old = new Date(Date.now() - 31 * DAY);
    const gone = await prisma.post.create({
      data: { authorId: author.id, body: "bye", deletedAt: old },
    });
    const recent = await prisma.post.create({
      data: { authorId: author.id, body: "hi", deletedAt: new Date() },
    });
    const kept = await prisma.post.create({
      data: { authorId: reported.id, body: "evidence", deletedAt: old },
    });
    await prisma.report.create({
      data: {
        reporterId: author.id,
        reportedUserId: reported.id,
        reason: "HARASSMENT",
      },
    });

    await runJobs(new Date());
    expect(await prisma.post.count({ where: { id: gone.id } })).toBe(0);
    expect(await prisma.post.count({ where: { id: recent.id } })).toBe(1);
    expect(await prisma.post.count({ where: { id: kept.id } })).toBe(1);
  });

  it("removes sign-ups that never confirmed their email and went quiet", async () => {
    const longAgo = new Date(Date.now() - 40 * DAY);
    const abandoned = await makeUser();
    await prisma.user.update({
      where: { id: abandoned.id },
      data: { createdAt: longAgo, lastActiveAt: longAgo },
    });
    const confirmed = await makeUser();
    await prisma.user.update({
      where: { id: confirmed.id },
      data: {
        createdAt: longAgo,
        lastActiveAt: longAgo,
        emailVerified: longAgo,
      },
    });
    const fresh = await makeUser();

    await runJobs(new Date());
    expect(await prisma.user.count({ where: { id: abandoned.id } })).toBe(0);
    expect(await prisma.user.count({ where: { id: confirmed.id } })).toBe(1);
    expect(await prisma.user.count({ where: { id: fresh.id } })).toBe(1);
  });
});

describe("staff roles", () => {
  async function verified(name = "Staffer") {
    const user = await makeUser(name);
    await prisma.verification.create({
      data: { userId: user.id, status: "VERIFIED_ADULT", provider: "persona" },
    });
    return user;
  }
  async function owner() {
    const user = await verified("Owner");
    return prisma.user.update({
      where: { id: user.id },
      data: { role: "OWNER" },
    });
  }

  it("lets only the owner promote, and only verified members", async () => {
    const boss = await owner();
    const admin = await prisma.user.update({
      where: { id: (await verified()).id },
      data: { role: "ADMIN" },
    });
    const member = await verified("New mod");
    const unverified = await makeUser();

    expect(
      await setStaffRole({
        actor: admin,
        userId: member.id,
        role: "MODERATOR",
        reason: "",
      }),
    ).toMatchObject({ ok: false });
    expect(
      await setStaffRole({
        actor: boss,
        userId: unverified.id,
        role: "MODERATOR",
        reason: "",
      }),
    ).toMatchObject({ ok: false });
    expect(
      await setStaffRole({
        actor: boss,
        userId: member.id,
        role: "OWNER",
        reason: "",
      }),
    ).toMatchObject({ ok: false });

    const res = await setStaffRole({
      actor: boss,
      userId: member.id,
      role: "MODERATOR",
      reason: "",
    });
    expect(res.ok).toBe(true);
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: member.id },
    });
    expect(after.role).toBe("MODERATOR");
    const log = await prisma.modAction.findFirst({
      where: { targetUserId: member.id, action: "role_moderator" },
    });
    expect(log?.actorId).toBe(boss.id);
    expect(
      await prisma.notification.count({
        where: { userId: member.id, type: "staff_alert" },
      }),
    ).toBe(1);
  });

  it("needs a reason to demote, and never touches the owner", async () => {
    const boss = await owner();
    const otherOwner = await owner();
    const mod = await prisma.user.update({
      where: { id: (await verified()).id },
      data: { role: "MODERATOR" },
    });

    expect(
      await setStaffRole({
        actor: boss,
        userId: mod.id,
        role: "MEMBER",
        reason: "  ",
      }),
    ).toMatchObject({ ok: false });
    expect(
      await setStaffRole({
        actor: boss,
        userId: otherOwner.id,
        role: "MEMBER",
        reason: "x",
      }),
    ).toMatchObject({ ok: false });
    expect(
      await setStaffRole({
        actor: boss,
        userId: boss.id,
        role: "MEMBER",
        reason: "x",
      }),
    ).toMatchObject({ ok: false });

    const res = await setStaffRole({
      actor: boss,
      userId: mod.id,
      role: "MEMBER",
      reason: "Shared report details",
    });
    expect(res.ok).toBe(true);
    const log = await prisma.modAction.findFirst({
      where: { targetUserId: mod.id, action: "role_member" },
    });
    expect(log?.note).toContain("Shared report details");
  });
});

describe("owner city counts", () => {
  it("groups spellings of the same city and skips closed accounts", async () => {
    const country = `Testland ${randomUUID().slice(0, 8)}`;
    const place = (city: string, c = country) => ({
      city,
      state: "TX",
      country: c,
    });
    const a = await makeUser();
    const b = await makeUser();
    const c = await makeUser();
    const gone = await makeUser();
    await prisma.profile.update({
      where: { userId: a.id },
      data: place("Austin"),
    });
    await prisma.profile.update({
      where: { userId: b.id },
      data: place(" austin "),
    });
    await prisma.profile.update({
      where: { userId: c.id },
      data: place("Dallas", country.toUpperCase()),
    });
    await prisma.profile.update({
      where: { userId: gone.id },
      data: place("Austin"),
    });
    await prisma.user.update({
      where: { id: gone.id },
      data: { accountStatus: "SUSPENDED" },
    });

    const rows = await cityStats({ country });
    expect(rows).toHaveLength(2);
    const austin = rows.find((r) => r.city?.toLowerCase() === "austin");
    expect(austin?.members).toBe(2);
    expect(rows.find((r) => r.city === "Dallas")?.members).toBe(1);
  });
});

describe("two-step sign-in", () => {
  const codeAt = (secret: string, nowMs: number) =>
    hotp(base32Decode(secret), currentStep(nowMs));

  it("turns on only with a working code, then accepts each code once", async () => {
    const user = await makeUser();
    const now = Date.now();
    const { secret } = await beginTwoStep(user.id, user.email);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.totpSecret).not.toContain(secret);
    expect(stored.totpEnabledAt).toBeNull();

    expect(await confirmTwoStep(user.id, "000000", now)).toBeNull();
    const codes = await confirmTwoStep(user.id, codeAt(secret, now), now);
    expect(codes).toHaveLength(10);
    const on = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(on.totpEnabledAt).not.toBeNull();
    expect(on.sessionVersion).toBe(stored.sessionVersion + 1);

    expect(
      await verifySecondStep(user.id, codeAt(secret, now), now),
    ).toBeNull();
    const later = now + 60_000;
    expect(await verifySecondStep(user.id, codeAt(secret, later), later)).toBe(
      "totp",
    );
    expect(
      await verifySecondStep(user.id, codeAt(secret, later), later),
    ).toBeNull();

    expect(await verifySecondStep(user.id, codes![0], later)).toBe("recovery");
    expect(
      await verifySecondStep(user.id, codes![0].toUpperCase(), later),
    ).toBeNull();
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(after.recoveryCodes).toHaveLength(9);
  });

  it("lets the owner reset a moderator who lost their phone", async () => {
    const boss = await prisma.user.update({
      where: { id: (await makeUser("Owner")).id },
      data: { role: "OWNER" },
    });
    const mod = await prisma.user.update({
      where: { id: (await makeUser("Mod")).id },
      data: { role: "MODERATOR" },
    });
    const { secret } = await beginTwoStep(mod.id, mod.email);
    await confirmTwoStep(mod.id, codeAt(secret, Date.now()));

    expect(
      await resetStaffTwoStep({ actor: mod, userId: boss.id, reason: "x" }),
    ).toMatchObject({ ok: false });
    expect(
      await resetStaffTwoStep({ actor: boss, userId: mod.id, reason: "" }),
    ).toMatchObject({ ok: false });
    expect(
      await resetStaffTwoStep({
        actor: boss,
        userId: mod.id,
        reason: "Lost phone",
      }),
    ).toMatchObject({ ok: true });
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: mod.id },
    });
    expect(after.totpEnabledAt).toBeNull();
    expect(after.totpSecret).toBeNull();
  });
});

describe("city waiting list", () => {
  async function liveIn(city: string, state: string | null) {
    const user = await makeUser();
    await prisma.profile.update({
      where: { userId: user.id },
      data: { city, state, isActive: true },
    });
    await prisma.verification.create({
      data: { userId: user.id, status: "VERIFIED_ADULT", provider: "persona" },
    });
    return user;
  }

  it("needs a confirmed email, emails once the city is ready, then forgets them", async () => {
    const city = `Testville ${randomUUID().slice(0, 6)}`;
    const email = `${randomUUID()}@test.local`;
    await joinWaitlist({ email, city, state: "OR", country: null });
    expect(
      sent.some((m) => m.to === email && m.subject.includes("Confirm")),
    ).toBe(true);
    const entry = await prisma.waitlistEntry.findUniqueOrThrow({
      where: { email },
    });

    expect((await notifyCity(city, "OR")).sent).toBe(0);
    expect(await confirmWaitlist(entry.token)).toBe(true);

    await liveIn(city, "Oregon");
    await liveIn(city.toUpperCase(), "or");
    await liveIn(city, null);
    expect(await liveMembersIn(city, "OR")).toBe(2);
    expect(await liveMembersIn(city, null)).toBe(3);

    sent.length = 0;
    const res = await notifyCity(city, "or");
    expect(res.sent).toBe(1);
    expect(sent[0]?.subject).toContain("ready");
    expect(
      await prisma.waitlistEntry.findUnique({ where: { email } }),
    ).toBeNull();
  });

  it("removes people who ask, and unconfirmed sign-ups after a week", async () => {
    const a = `${randomUUID()}@test.local`;
    const b = `${randomUUID()}@test.local`;
    await joinWaitlist({
      email: a,
      city: "Leaveton",
      state: null,
      country: null,
    });
    await joinWaitlist({
      email: b,
      city: "Leaveton",
      state: null,
      country: null,
    });
    const entryA = await prisma.waitlistEntry.findUniqueOrThrow({
      where: { email: a },
    });
    expect(await leaveWaitlist(entryA.token)).toBe(true);
    expect(
      await prisma.waitlistEntry.findUnique({ where: { email: a } }),
    ).toBeNull();

    await cleanUpWaitlist(new Date(Date.now() + UNCONFIRMED_TTL_MS + 60_000));
    expect(
      await prisma.waitlistEntry.findUnique({ where: { email: b } }),
    ).toBeNull();
  });
});

describe("sponsor inquiries", () => {
  it("saves the inquiry, thanks the business, and tells the owner", async () => {
    const boss = await prisma.user.update({
      where: { id: (await makeUser("Owner")).id },
      data: { role: "OWNER" },
    });
    const email = `${randomUUID()}@biz.test`;
    await createSponsorInquiry({
      businessName: "Rainbow Books",
      contactName: "Sam",
      email,
      website: null,
      city: "Austin",
      message: "We'd like a month in Austin.",
    });
    expect(
      await prisma.sponsorInquiry.count({ where: { email, status: "NEW" } }),
    ).toBe(1);
    expect(sent.some((m) => m.to === email)).toBe(true);
    expect(
      await prisma.notification.count({
        where: { userId: boss.id, type: "staff_alert" },
      }),
    ).toBe(1);
  });
});

describe("announcements", () => {
  it("shows current ones, and hides website-only ones in the apps", async () => {
    const now = new Date();
    const hour = 3600_000;
    const make = (data: {
      message: string;
      websiteOnly?: boolean;
      startsAt?: Date;
      endsAt?: Date;
    }) => prisma.announcement.create({ data });
    const live = await make({ message: "live" });
    const webOnly = await make({ message: "web", websiteOnly: true });
    const ended = await make({
      message: "ended",
      endsAt: new Date(now.getTime() - hour),
    });
    const future = await make({
      message: "future",
      startsAt: new Date(now.getTime() + hour),
    });

    const web = (await currentAnnouncements({ app: false }, now)).map(
      (a) => a.id,
    );
    const app = (await currentAnnouncements({ app: true }, now)).map(
      (a) => a.id,
    );
    expect(web).toEqual(expect.arrayContaining([live.id, webOnly.id]));
    expect(web).not.toContain(ended.id);
    expect(web).not.toContain(future.id);
    expect(app).toContain(live.id);
    expect(app).not.toContain(webOnly.id);
    await prisma.announcement.deleteMany({
      where: { id: { in: [live.id, webOnly.id, ended.id, future.id] } },
    });
  });
});
