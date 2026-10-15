import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";
import { appUrl } from "@/lib/request";

export const dynamic = "force-dynamic";

/**
 * Everything we hold about the signed-in member, as JSON. Other people's
 * private data (their messages to you aside) isn't included, and reports
 * filed about you are withheld to protect reporters.
 */
export async function GET() {
  const user = await currentAccount();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await limitFor("exportsPerUser", user.id);
  if (!limited.ok) return tooManyRequests(limited);

  const id = user.id;
  const [
    profile,
    matches,
    likesSent,
    messageRequests,
    blocks,
    follows,
    posts,
    roomMessages,
    consentGrants,
    consentRequests,
    events,
    rsvps,
    reportsFiled,
    notifications,
    supportTickets,
    appeals,
    checkIns,
    selfies,
    calls,
    roomMemberships,
    roomInvites,
    roomBans,
    subscription,
    pushSubscriptions,
    deviceTokens,
  ] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: id },
      include: {
        identityTags: { include: { tag: true } },
        orientationTags: { include: { tag: true } },
        goalTags: { include: { tag: true } },
        relationshipStyleTags: { include: { tag: true } },
        seekingIdentityTags: { include: { tag: true } },
        seekingOrientationTags: { include: { tag: true } },
        bodyTags: { include: { tag: true } },
        ethnicityTags: { include: { tag: true } },
        accessibilityTags: { include: { tag: true } },
        kinks: { include: { kink: { select: { name: true } } } },
        prompts: true,
        photos: {
          select: { id: true, visibility: true, status: true, createdAt: true },
        },
      },
    }),
    prisma.match.findMany({
      where: { OR: [{ userAId: id }, { userBId: id }] },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            senderId: true,
            body: true,
            imageUrl: true,
            voiceUrl: true,
            safetyFlag: true,
            createdAt: true,
            readAt: true,
          },
        },
      },
    }),
    prisma.like.findMany({ where: { fromUserId: id } }),
    prisma.messageRequest.findMany({
      where: { OR: [{ fromUserId: id }, { toUserId: id }] },
    }),
    prisma.block.findMany({ where: { blockerId: id } }),
    prisma.follow.findMany({ where: { followerId: id } }),
    prisma.post.findMany({ where: { authorId: id } }),
    prisma.roomMessage.findMany({
      where: { senderId: id },
      select: { roomId: true, body: true, createdAt: true, deletedAt: true },
    }),
    prisma.consentGrant.findMany({
      where: { OR: [{ granterId: id }, { viewerId: id }] },
    }),
    prisma.consentRequest.findMany({
      where: { OR: [{ requesterId: id }, { ownerId: id }] },
    }),
    prisma.event.findMany({ where: { hostId: id } }),
    prisma.eventRsvp.findMany({ where: { userId: id } }),
    prisma.report.findMany({
      where: { reporterId: id },
      select: {
        reportedUserId: true,
        reason: true,
        details: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.notification.findMany({ where: { userId: id } }),
    prisma.supportTicket.findMany({ where: { userId: id } }),
    prisma.appeal.findMany({ where: { userId: id } }),
    prisma.safetyCheckIn.findMany({ where: { userId: id } }),
    prisma.selfieVerification.findMany({
      where: { userId: id },
      select: { status: true, createdAt: true, reviewedAt: true },
    }),
    prisma.call.findMany({
      where: { OR: [{ callerId: id }, { calleeId: id }] },
      select: {
        matchId: true,
        callerId: true,
        calleeId: true,
        video: true,
        status: true,
        createdAt: true,
        answeredAt: true,
        endedAt: true,
      },
    }),
    prisma.roomMembership.findMany({ where: { userId: id } }),
    prisma.roomInvite.findMany({ where: { userId: id } }),
    prisma.roomBan.findMany({ where: { userId: id } }),
    prisma.subscription.findUnique({
      where: { userId: id },
      select: {
        plan: true,
        status: true,
        currentPeriodEnd: true,
        showBadge: true,
        createdAt: true,
      },
    }),
    prisma.pushSubscription.findMany({
      where: { userId: id },
      select: { createdAt: true },
    }),
    prisma.deviceToken.findMany({
      where: { userId: id },
      select: { platform: true, createdAt: true, lastSeenAt: true },
    }),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    note: `Photos can be downloaded individually while signed in at ${appUrl()}/api/photos/<id>. ID documents are never stored by Kindred Kinks.`,
    account: {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      dateOfBirth: user.dateOfBirth,
      accountStatus: user.accountStatus,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      termsAcceptedAt: user.termsAcceptedAt,
      photoVerifiedAt: user.photoVerifiedAt,
      twoStepSignInSince: user.totpEnabledAt,
      ageVerification: user.verification
        ? {
            status: user.verification.status,
            provider: user.verification.provider,
            verifiedAt: user.verification.verifiedAt,
          }
        : null,
      preferences: {
        adPreference: user.adPreference,
        showOnline: user.showOnline,
        appAdultContent: user.appAdultContent,
        notifyEmail: user.notifyEmail,
        readReceipts: user.readReceipts,
        allowCalls: user.allowCalls,
        themeMode: user.themeMode,
        themeFlag: user.themeFlag,
      },
    },
    profile,
    conversations: matches.map((m) => ({
      matchId: m.id,
      withUserId: m.userAId === id ? m.userBId : m.userAId,
      createdAt: m.createdAt,
      unmatchedAt: m.unmatchedAt,
      messages: m.messages.map((msg) => ({
        ...msg,
        fromYou: msg.senderId === id,
      })),
    })),
    likesSent,
    messageRequests,
    blocks,
    follows,
    posts,
    roomMessages,
    consentGrants,
    consentRequests,
    eventsHosted: events,
    eventRsvps: rsvps,
    reportsFiled,
    notifications,
    supportTickets,
    appeals,
    safetyCheckIns: checkIns,
    selfieVerifications: selfies,
    calls,
    roomMemberships,
    roomInvites,
    roomBans,
    supporter: subscription,
    notificationDevices: {
      browsers: pushSubscriptions,
      phones: deviceTokens,
    },
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="kindredkinks-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
