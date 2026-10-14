import { notFound } from "next/navigation";
import { isAppRequest } from "@/lib/content-policy";
import { SupporterPanel } from "@/components/supporter-panel";

// Store rules: donations live on the website only, never inside the apps.
export default async function SupporterPage() {
  if (await isAppRequest()) notFound();
  return <SupporterPanel />;
}
