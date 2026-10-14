"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CommunityTabs } from "@/components/community-tabs";

type Room = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  memberCount: number;
  joined: boolean;
  invited: boolean;
  matchesProfile: boolean;
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [restricted, setRestricted] = useState(false);

  async function load() {
    const res = await fetch("/api/rooms");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not load rooms.");
      return;
    }
    setRooms(data.rooms);
    setRestricted(Boolean(data.contentRestricted));
  }

  useEffect(() => {
    load();
  }, []);

  async function join(room: Room) {
    const res = await fetch(`/api/rooms/${room.id}/membership`, {
      method: "POST",
    });
    if (res.ok) load();
  }

  async function leave(room: Room) {
    const res = await fetch(`/api/rooms/${room.id}/membership`, {
      method: "DELETE",
    });
    if (res.ok) load();
  }

  async function decline(room: Room) {
    const res = await fetch(`/api/rooms/${room.id}/invite`, {
      method: "DELETE",
    });
    if (res.ok) load();
  }

  const invites = rooms.filter((r) => r.invited);
  const mine = rooms.filter((r) => r.joined);
  const others = rooms.filter((r) => !r.joined && !r.invited);

  return (
    <div>
      <CommunityTabs />
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Rooms
      </h1>
      <p className="mt-1 text-sm text-ink/70">
        Group chats for shared interests. When you add interests to your
        profile, you&apos;re invited to matching rooms. If you click with
        someone, ask to talk privately.
      </p>
      {restricted && (
        <p className="mt-2 text-sm text-ink/70">
          More rooms are available on the OpenHeart website.
        </p>
      )}
      {error && (
        <p className="mt-4 text-sm text-coral-deep">
          {error}{" "}
          <Link href="/onboarding" className="underline">
            Finish your profile
          </Link>
        </p>
      )}

      {invites.length > 0 && (
        <Section title="Invites for you">
          {invites.map((r) => (
            <RoomRow key={r.id} room={r}>
              <Button type="button" size="sm" onClick={() => join(r)}>
                Join
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => decline(r)}
              >
                No thanks
              </Button>
            </RoomRow>
          ))}
        </Section>
      )}

      {mine.length > 0 && (
        <Section title="Your rooms">
          {mine.map((r) => (
            <RoomRow key={r.id} room={r} href={`/rooms/${r.id}`}>
              <Link href={`/rooms/${r.id}`}>
                <Button type="button" size="sm">
                  Open
                </Button>
              </Link>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => leave(r)}
              >
                Leave
              </Button>
            </RoomRow>
          ))}
        </Section>
      )}

      {others.length > 0 && (
        <Section title="Other groups you can join">
          {others.map((r) => (
            <RoomRow key={r.id} room={r}>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => join(r)}
              >
                Join
              </Button>
            </RoomRow>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium uppercase tracking-wide text-sage">
        {title}
      </h2>
      <ul className="mt-3 divide-y divide-forest/10">{children}</ul>
    </section>
  );
}

function RoomRow({
  room,
  href,
  children,
}: {
  room: Room;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-4">
      <div>
        {href ? (
          <Link href={href} className="font-medium text-forest hover:underline">
            {room.name}
          </Link>
        ) : (
          <span className="font-medium text-ink">{room.name}</span>
        )}
        {room.matchesProfile && !room.joined && room.kind !== "GENERAL" && (
          <span className="ml-2 rounded bg-mist px-1.5 py-0.5 text-[11px] text-forest">
            Matches your profile
          </span>
        )}
        <p className="text-sm text-ink/70">
          {room.description} · {room.memberCount}{" "}
          {room.memberCount === 1 ? "member" : "members"}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">{children}</div>
    </li>
  );
}
