"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Flag,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { useRealtime } from "@/components/realtime";
import { cn } from "@/lib/utils";

type Phase =
  "idle" | "outgoing" | "incoming" | "connecting" | "active" | "ended";
type Signal = { kind: "offer" | "answer" | "ice"; data: string };
type CallInfo = {
  id: string;
  matchId: string;
  video: boolean;
  role: "caller" | "callee";
  other: { userId: string; displayName: string };
};
type CallState = CallInfo & {
  status: string;
  signals: Signal[];
  iceServers: RTCIceServer[];
};

const RING_MS = 45_000;

const END_TEXT: Record<string, { caller: string; callee: string }> = {
  declined: { caller: "They can't talk right now.", callee: "Call declined." },
  missed: { caller: "No answer.", callee: "Missed call." },
  ended: { caller: "Call ended.", callee: "Call ended." },
};

const CallContext = createContext<{
  startCall: (
    matchId: string,
    video: boolean,
    otherName: string,
  ) => Promise<string | null>;
  inCall: boolean;
}>({ startCall: async () => null, inCall: false });

export function useCalls() {
  return useContext(CallContext);
}

function mediaFor(video: boolean): MediaStreamConstraints {
  return {
    audio: { echoCancellation: true, noiseSuppression: true },
    video: video
      ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
      : false,
  };
}

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Voice and video calls between matches. Audio and video travel directly
 * between the two devices (WebRTC); the server only passes the connection
 * setup along and never sees or records the call.
 */
export function CallProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [info, setInfo] = useState<CallInfo | null>(null);
  const [endText, setEndText] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const phaseRef = useRef<Phase>("idle");
  const callId = useRef<string | null>(null);
  const role = useRef<"caller" | "callee">("caller");
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const iceServers = useRef<RTCIceServer[]>([]);
  const waitingSignals = useRef<Signal[]>([]);
  const waitingIce = useRef<RTCIceCandidateInit[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const post = useCallback(
    (id: string, path: string, body: unknown) =>
      fetch(`/api/calls/${id}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }),
    [],
  );

  const teardown = useCallback(
    (text: string) => {
      if (ringTimer.current) clearTimeout(ringTimer.current);
      if (endTimer.current) clearTimeout(endTimer.current);
      pc.current?.close();
      pc.current = null;
      local.current?.getTracks().forEach((t) => t.stop());
      local.current = null;
      callId.current = null;
      waitingSignals.current = [];
      waitingIce.current = [];
      setLocalStream(null);
      setRemoteStream(null);
      setMuted(false);
      setCameraOff(false);
      setSeconds(0);
      setEndText(text);
      setPhase("ended");
      endTimer.current = setTimeout(() => {
        setPhase("idle");
        setInfo(null);
      }, 2500);
    },
    [setPhase],
  );

  const flushIce = useCallback(async () => {
    const conn = pc.current;
    if (!conn?.remoteDescription) return;
    for (const c of waitingIce.current.splice(0)) {
      await conn.addIceCandidate(c).catch(() => {});
    }
  }, []);

  const applySignals = useCallback(
    async (signals: Signal[]) => {
      const conn = pc.current;
      const id = callId.current;
      if (!conn || !id) {
        waitingSignals.current.push(...signals);
        return;
      }
      for (const s of signals) {
        try {
          if (s.kind === "offer" && role.current === "callee") {
            await conn.setRemoteDescription({ type: "offer", sdp: s.data });
            await flushIce();
            const answer = await conn.createAnswer();
            await conn.setLocalDescription(answer);
            await post(id, "/signal", { kind: "answer", data: answer.sdp });
          } else if (s.kind === "answer" && role.current === "caller") {
            await conn.setRemoteDescription({ type: "answer", sdp: s.data });
            await flushIce();
          } else if (s.kind === "ice") {
            const c = JSON.parse(s.data) as RTCIceCandidateInit;
            if (conn.remoteDescription) await conn.addIceCandidate(c);
            else waitingIce.current.push(c);
          }
        } catch {
          // A bad or late signal shouldn't break the call.
        }
      }
    },
    [flushIce, post],
  );

  const makePeer = useCallback(
    (id: string) => {
      const conn = new RTCPeerConnection({ iceServers: iceServers.current });
      conn.onicecandidate = (e) => {
        if (e.candidate) {
          post(id, "/signal", {
            kind: "ice",
            data: JSON.stringify(e.candidate.toJSON()),
          }).catch(() => {});
        }
      };
      conn.ontrack = (e) => {
        setRemoteStream(e.streams[0] ?? new MediaStream([e.track]));
      };
      conn.onconnectionstatechange = () => {
        if (conn.connectionState === "connected") setPhase("active");
        if (conn.connectionState === "failed" && callId.current === id) {
          post(id, "", { action: "end" }).catch(() => {});
          teardown(
            "Couldn't connect — the network may be blocking calls. Try Wi-Fi or mobile data.",
          );
        }
      };
      local.current
        ?.getTracks()
        .forEach((t) => conn.addTrack(t, local.current!));
      pc.current = conn;
      return conn;
    },
    [post, setPhase, teardown],
  );

  const fetchCall = useCallback(async (id: string) => {
    const res = await fetch(`/api/calls/${id}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as CallState) : null;
  }, []);

  /** Picks up status changes and connection messages for the current call. */
  const sync = useCallback(
    (id: string) => {
      queue.current = queue.current.then(async () => {
        if (callId.current !== id) return;
        const data = await fetchCall(id).catch(() => null);
        if (!data || callId.current !== id) return;
        if (!["ringing", "active"].includes(data.status)) {
          teardown(END_TEXT[data.status]?.[role.current] ?? "Call ended.");
          return;
        }
        if (data.status === "active" && phaseRef.current === "outgoing") {
          if (ringTimer.current) clearTimeout(ringTimer.current);
          setPhase("connecting");
        }
        if (phaseRef.current === "incoming") {
          waitingSignals.current.push(...data.signals);
        } else {
          await applySignals(data.signals);
        }
      });
    },
    [applySignals, fetchCall, setPhase, teardown],
  );

  const showIncoming = useCallback(
    async (id: string) => {
      if (phaseRef.current !== "idle" && phaseRef.current !== "ended") return;
      const data = await fetchCall(id).catch(() => null);
      if (!data || data.role !== "callee" || data.status !== "ringing") return;
      if (phaseRef.current !== "idle" && phaseRef.current !== "ended") return;
      if (endTimer.current) clearTimeout(endTimer.current);
      callId.current = id;
      role.current = "callee";
      iceServers.current = data.iceServers;
      waitingSignals.current = [...data.signals];
      setInfo(data);
      setPhase("incoming");
      navigator.vibrate?.([400, 200, 400]);
    },
    [fetchCall, setPhase],
  );

  useRealtime(
    (e) => {
      if (e.type !== "call") return;
      if (e.callId === callId.current) sync(e.callId);
      else showIncoming(e.callId);
    },
    {
      onPoll: () => {
        if (callId.current) sync(callId.current);
      },
      pollMs: 2500,
    },
  );

  // Opened from an "Incoming call" notification: check for a ringing call.
  useEffect(() => {
    fetch("/api/calls", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ringing?: string[] } | null) => {
        if (d?.ringing?.[0]) showIncoming(d.ringing[0]);
      })
      .catch(() => {});
  }, [showIncoming]);

  // Leaving the site hangs up.
  useEffect(() => {
    const leave = () => {
      if (callId.current) {
        post(callId.current, "", { action: "end" }).catch(() => {});
      }
    };
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [post]);

  useEffect(() => {
    if (phase !== "active") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (localVideo.current) localVideo.current.srcObject = localStream;
  }, [localStream, phase]);
  useEffect(() => {
    if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream;
    if (remoteAudio.current) remoteAudio.current.srcObject = remoteStream;
  }, [remoteStream, phase]);

  const startCall = useCallback(
    async (matchId: string, video: boolean, otherName: string) => {
      if (phaseRef.current !== "idle" && phaseRef.current !== "ended") {
        return "You're already on a call.";
      }
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
        return "Calls aren't supported on this browser.";
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(mediaFor(video));
      } catch {
        return video
          ? "Allow camera and microphone access to make a video call."
          : "Allow microphone access to make a call.";
      }
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, video }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        stream.getTracks().forEach((t) => t.stop());
        return (data.error as string) ?? "Couldn't start the call.";
      }
      if (endTimer.current) clearTimeout(endTimer.current);
      const id = data.callId as string;
      callId.current = id;
      role.current = "caller";
      iceServers.current = data.iceServers;
      local.current = stream;
      setLocalStream(stream);
      setInfo({
        id,
        matchId,
        video,
        role: "caller",
        other: { userId: "", displayName: otherName },
      });
      setPhase("outgoing");
      fetchCall(id).then((d) => d && setInfo(d));

      const conn = makePeer(id);
      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      await post(id, "/signal", { kind: "offer", data: offer.sdp });
      ringTimer.current = setTimeout(() => {
        if (callId.current === id && phaseRef.current === "outgoing") {
          post(id, "", { action: "end" }).catch(() => {});
          teardown("No answer.");
        }
      }, RING_MS);
      return null;
    },
    [fetchCall, makePeer, post, setPhase, teardown],
  );

  async function accept() {
    const id = callId.current;
    if (!id || !info) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(mediaFor(info.video));
    } catch {
      post(id, "", { action: "decline" }).catch(() => {});
      teardown(
        info.video
          ? "Allow camera and microphone access to answer video calls."
          : "Allow microphone access to answer calls.",
      );
      return;
    }
    const res = await post(id, "", { action: "accept" });
    if (!res.ok) {
      stream.getTracks().forEach((t) => t.stop());
      teardown("This call has ended.");
      return;
    }
    local.current = stream;
    setLocalStream(stream);
    setPhase("connecting");
    makePeer(id);
    const waiting = waitingSignals.current.splice(0);
    queue.current = queue.current.then(() => applySignals(waiting));
    sync(id);
  }

  function decline() {
    const id = callId.current;
    if (id) post(id, "", { action: "decline" }).catch(() => {});
    teardown("Call declined.");
  }

  function hangUp() {
    const id = callId.current;
    if (id) post(id, "", { action: "end" }).catch(() => {});
    teardown("Call ended.");
  }

  function toggleMute() {
    const next = !muted;
    local.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }

  function toggleCamera() {
    const next = !cameraOff;
    local.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCameraOff(next);
  }

  function report() {
    const userId = info?.other.userId;
    hangUp();
    if (userId) router.push(`/settings?report=${userId}#report`);
  }

  const inCall = phase !== "idle" && phase !== "ended";
  const name = info?.other.displayName ?? "Your match";
  const statusText =
    phase === "outgoing"
      ? "Ringing…"
      : phase === "connecting"
        ? "Connecting…"
        : fmt(seconds);

  return (
    <CallContext.Provider value={{ startCall, inCall }}>
      {children}

      {phase === "incoming" && info && (
        <div
          role="alertdialog"
          aria-label={`Incoming call from ${name}`}
          className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-2xl bg-forest p-4 text-cream shadow-2xl"
        >
          <p className="text-sm text-cream/80">
            Incoming {info.video ? "video" : "voice"} call
          </p>
          <p className="font-[family-name:var(--font-fraunces)] text-2xl">
            {name}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={decline}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-coral-deep font-medium text-cream"
            >
              <PhoneOff aria-hidden className="h-5 w-5" /> Decline
            </button>
            <button
              type="button"
              onClick={accept}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-sage font-medium text-forest"
            >
              {info.video ? (
                <Video aria-hidden className="h-5 w-5" />
              ) : (
                <Phone aria-hidden className="h-5 w-5" />
              )}
              Answer
            </button>
          </div>
        </div>
      )}

      {inCall && phase !== "incoming" && info && (
        <div
          role="dialog"
          aria-label={`Call with ${name}`}
          className="fixed inset-0 z-50 flex flex-col bg-forest text-cream"
        >
          {info.video ? (
            <video
              ref={remoteVideo}
              autoPlay
              playsInline
              className="absolute inset-0 h-full w-full bg-black object-cover"
            />
          ) : (
            <audio ref={remoteAudio} autoPlay />
          )}
          {info.video && (
            <video
              ref={localVideo}
              autoPlay
              playsInline
              muted
              className={cn(
                "absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] z-10 h-36 w-28 rounded-xl border border-cream/30 bg-black object-cover [transform:scaleX(-1)]",
                cameraOff && "opacity-0",
              )}
            />
          )}

          <div className="relative z-10 px-6 pt-[calc(2rem+env(safe-area-inset-top))]">
            <p className="font-[family-name:var(--font-fraunces)] text-3xl drop-shadow">
              {name}
            </p>
            <p aria-live="polite" className="mt-1 text-cream/85 drop-shadow">
              {statusText}
            </p>
          </div>

          {!info.video && (
            <div className="relative z-10 flex flex-1 items-center justify-center">
              <span
                aria-hidden
                className="flex h-32 w-32 items-center justify-center rounded-full bg-sage/40 font-[family-name:var(--font-fraunces)] text-5xl"
              >
                {name.slice(0, 1).toUpperCase()}
              </span>
            </div>
          )}

          <div className="relative z-10 mt-auto flex items-center justify-center gap-5 px-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={toggleMute}
              aria-pressed={muted}
              aria-label={muted ? "Unmute" : "Mute"}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-cream/20 backdrop-blur"
            >
              {muted ? <MicOff aria-hidden /> : <Mic aria-hidden />}
            </button>
            {info.video && (
              <button
                type="button"
                onClick={toggleCamera}
                aria-pressed={cameraOff}
                aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-cream/20 backdrop-blur"
              >
                {cameraOff ? <VideoOff aria-hidden /> : <Video aria-hidden />}
              </button>
            )}
            <button
              type="button"
              onClick={hangUp}
              aria-label="Hang up"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-coral-deep"
            >
              <PhoneOff aria-hidden />
            </button>
            <button
              type="button"
              onClick={report}
              aria-label="Hang up and report"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-cream/20 backdrop-blur"
            >
              <Flag aria-hidden />
            </button>
          </div>
        </div>
      )}

      {phase === "ended" && (
        <p
          role="status"
          className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-full bg-forest px-4 py-2 text-center text-sm text-cream shadow-lg"
        >
          {endText}
        </p>
      )}
    </CallContext.Provider>
  );
}
