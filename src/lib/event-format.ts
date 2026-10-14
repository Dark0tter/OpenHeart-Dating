export type EventKindId = "MUNCH" | "SOCIAL" | "CLASS" | "ONLINE";

export const KIND_SHORT: Record<EventKindId, string> = {
  MUNCH: "Munch",
  SOCIAL: "Social",
  CLASS: "Class",
  ONLINE: "Online",
};

/** Formatted in the viewer's own time zone. */
export function formatWhen(startsAt: string, endsAt?: string | null) {
  const s = new Date(startsAt);
  const date = s.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = s.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (!endsAt) return `${date} · ${time}`;
  const e = new Date(endsAt);
  const end =
    e.toDateString() === s.toDateString()
      ? e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : e.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
  return `${date} · ${time} – ${end}`;
}
