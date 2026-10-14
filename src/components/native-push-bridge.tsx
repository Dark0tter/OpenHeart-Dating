"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { startNativePush } from "@/lib/native-app";

/** Inside the iPhone/Android app: keeps the device registered and opens tapped notifications. */
export function NativePushBridge() {
  const router = useRouter();
  useEffect(() => startNativePush((path) => router.push(path)), [router]);
  return null;
}
