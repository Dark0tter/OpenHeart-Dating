import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ageFromDob(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}

export function isAdult(dob: Date): boolean {
  return ageFromDob(dob) >= 18;
}

/** Haversine distance in km */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Rounded so repeated checks from different spots can't pinpoint someone's
 * home: under 2 km shows "Nearby", then whole km to 10, then steps of 5.
 */
export function approxDistanceLabel(km: number): string {
  if (km < 2) return "Nearby";
  if (km < 10) return `About ${Math.round(km)} km away`;
  if (km < 500) return `About ${Math.round(km / 5) * 5} km away`;
  return "Far away";
}

/** Coarse activity so exact online habits aren't exposed. */
export function activityLabel(lastActiveAt: Date): string {
  const hours = (Date.now() - lastActiveAt.getTime()) / 3_600_000;
  if (hours < 24) return "Active today";
  if (hours < 24 * 7) return "Active this week";
  if (hours < 24 * 30) return "Active this month";
  return "Active a while ago";
}

export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
