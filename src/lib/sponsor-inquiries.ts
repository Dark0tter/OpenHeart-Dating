import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { notify } from "@/lib/notify";
import { SUPPORT_EMAIL } from "@/lib/constants/site";

export const inquirySchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  website: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null)
    .refine(
      (v) => !v || /^https?:\/\//i.test(v),
      "Website must start with http:// or https://",
    ),
  city: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || null),
  message: z.string().trim().min(10).max(3000),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

/** Saves a business's sponsor inquiry, thanks them, and tells the owner. */
export async function createSponsorInquiry(input: InquiryInput) {
  const inquiry = await prisma.sponsorInquiry.create({ data: input });

  await sendEmail({
    to: input.email,
    subject: "Thanks for your interest in sponsoring OpenHeart",
    paragraphs: [
      `Hi ${input.contactName}, thanks for getting in touch about ${input.businessName}. A person will reply to this address, usually within a few days.`,
      "OpenHeart never shares member data with sponsors. You'd receive anonymous daily totals of views and clicks only.",
    ],
  });

  const owners = await prisma.user.findMany({
    where: { role: "OWNER", accountStatus: "ACTIVE" },
    select: { id: true },
  });
  for (const o of owners) {
    await notify(o.id, {
      type: "staff_alert",
      title: `Sponsor inquiry from ${input.businessName}`,
      body: input.city ? `For ${input.city}` : undefined,
      link: "/owner/ads#inquiries",
    });
  }
  if (SUPPORT_EMAIL) {
    await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `[Sponsor inquiry] ${input.businessName}`,
      paragraphs: [
        `From: ${input.contactName} <${input.email}>`,
        `Website: ${input.website ?? "none"} · City: ${input.city ?? "not given"}`,
        input.message,
      ],
    });
  }
  return inquiry;
}
