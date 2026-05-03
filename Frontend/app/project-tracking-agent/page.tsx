"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { getAccessToken } from "@/lib/api";
import { useAgentTimer } from "@/lib/hooks/use-agent-timer";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { usageApi } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type MsgSender = "ai" | "user";
type MsgKind = "text" | "voice";

interface ActionMeta {
  action?: string | null;
  project?: string | null;
  task?: string | null;
  new_status?: string | null;
  actor?: string | null;
  log_id?: string | null;
  available_projects?: Array<{ key: string; name: string; id: string; url: string }>;
  isVoice?: boolean;
  audioUrl?: string | null;
}

interface Msg {
  id: string;
  sender: MsgSender;
  kind: MsgKind;
  text: string;
  time: string;
  meta?: ActionMeta;
}

type RecordState = "idle" | "recording" | "processing";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
function fmtSecs(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  TRACK_STATUS:    { label: "Status Check",   color: "#38bdf8" },
  UPDATE_TASK:     { label: "Task Updated",   color: "#4ade80" },
  CREATE_TASK:     { label: "Task Created",   color: "#a78bfa" },
  ASSIGN_TASK:     { label: "Task Assigned",  color: "#fb923c" },
  SET_REMINDER:    { label: "Reminder Set",   color: "#fbbf24" },
  SEARCH_TASKS:    { label: "Search Result",  color: "#38bdf8" },
  TEAM_WORKLOAD:   { label: "Workload View",  color: "#f472b6" },
  REPORT_BLOCKER:  { label: "Blocker Filed",  color: "#f87171" },
  VIEW_DASHBOARD:  { label: "Dashboard",      color: "#818cf8" },
  ADD_COMMENT:     { label: "Comment Added",  color: "#34d399" },
  LIST_REMINDERS:  { label: "Reminders",      color: "#fbbf24" },
  CANCEL_REMINDER: { label: "Reminder Removed", color: "#f87171" },
  GET_HELP:        { label: "Help",           color: "#94a3b8" },
};

// ─────────────────────────────────────────────────────────────
// GLOBAL CSS
// ─────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #05080f;
    --surface: #0b101c;
    --surface2: #111827;
    --border: rgba(255,255,255,0.07);
    --border-hi: rgba(255,255,255,0.14);
    --text: #e8edf8;
    --muted: rgba(232,237,248,0.38);
    --dim: rgba(232,237,248,0.22);

    --cyan: #00e5ff;
    --green: #00ffa3;
    --violet: #9b6dff;
    --amber: #ffc940;
    --rose: #ff4d6d;
    --sky: #38bdf8;

    --ai-bubble: rgba(0,229,255,0.055);
    --ai-border: rgba(0,229,255,0.13);
    --user-bubble: rgba(155,109,255,0.1);
    --user-border: rgba(155,109,255,0.22);

    --rec: #ff4d6d;
    --rec-glow: rgba(255,77,109,0.4);
  }

  html, body { height: 100%; background: var(--bg); color: var(--text); font-family: 'Syne', sans-serif; overflow: hidden; }

  .scroller { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.07) transparent; }
  .scroller::-webkit-scrollbar { width: 3px; }
  .scroller::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }

  @keyframes grid-pan    { from{background-position:0 0} to{background-position:44px 44px} }
  @keyframes pulse-slow  { 0%,100%{opacity:0.5} 50%{opacity:1} }
  @keyframes spin        { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes msg-pop     { from{opacity:0;transform:translateY(14px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes dot         { 0%,80%,100%{transform:translateY(0);opacity:0.3} 40%{transform:translateY(-4px);opacity:1} }
  @keyframes glow-line   { 0%,100%{opacity:0.4} 50%{opacity:1} }
  @keyframes tag-in      { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
  @keyframes rec-pulse   { 0%,100%{box-shadow:0 0 0 0 var(--rec-glow),0 0 16px var(--rec-glow)} 50%{box-shadow:0 0 0 10px transparent,0 0 28px var(--rec-glow)} }
  @keyframes wave-bar    { 0%,100%{transform:scaleY(0.2)} 50%{transform:scaleY(1)} }
  @keyframes slide-up    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fade-in     { from{opacity:0} to{opacity:1} }
  @keyframes audio-ring  { 0%{box-shadow:0 0 0 0 rgba(0,229,255,0.5)} 100%{box-shadow:0 0 0 14px transparent} }

  .msg-pop  { animation: msg-pop  0.28s cubic-bezier(0.34,1.4,0.64,1) both; }
  .tag-in   { animation: tag-in   0.2s ease both; }
  .slide-up { animation: slide-up 0.3s cubic-bezier(0.34,1.2,0.64,1) both; }

  button { cursor: pointer; border: none; background: none; font-family: 'Syne', sans-serif; }
  input, textarea { font-family: 'Syne', sans-serif; font-size: 16px !important; }
  input:focus, textarea:focus { outline: none; }
  * { -webkit-tap-highlight-color: transparent; }

  .rec-btn-active {
    animation: rec-pulse 1.4s ease-in-out infinite !important;
  }

  .wave-bar {
    width: 3px;
    border-radius: 99px;
    background: var(--rec);
    transform-origin: bottom;
  }
  .wave-bar:nth-child(1) { animation: wave-bar 0.8s ease-in-out 0.0s infinite; }
  .wave-bar:nth-child(2) { animation: wave-bar 0.8s ease-in-out 0.1s infinite; }
  .wave-bar:nth-child(3) { animation: wave-bar 0.8s ease-in-out 0.2s infinite; }
  .wave-bar:nth-child(4) { animation: wave-bar 0.8s ease-in-out 0.05s infinite; }
  .wave-bar:nth-child(5) { animation: wave-bar 0.8s ease-in-out 0.15s infinite; }
  .wave-bar:nth-child(6) { animation: wave-bar 0.8s ease-in-out 0.25s infinite; }
  .wave-bar:nth-child(7) { animation: wave-bar 0.8s ease-in-out 0.0s infinite; }

  .audio-playing {
    animation: audio-ring 1s ease-out infinite;
  }

  @media (max-width: 640px) {
    .msg-bubble { max-width: 87% !important; }
    .msg-text   { font-size: 13px !important; padding: 10px 13px !important; }
  }

  /* Mobile mic: larger tap target */
  @media (max-width: 640px) {
    .mic-btn { width: 52px !important; height: 52px !important; border-radius: 16px !important; font-size: 20px !important; }
    .send-btn { width: 52px !important; height: 52px !important; border-radius: 16px !important; }
    .input-wrap { border-radius: 14px !important; }
    .footer-row { gap: 6px !important; }
    .rec-badge { display: none !important; }
  }
`;

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

function GridBg() {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:0,pointerEvents:"none" }}>
      <div style={{
        position:"absolute",inset:0,
        backgroundImage:"linear-gradient(rgba(0,229,255,0.028) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,0.028) 1px,transparent 1px)",
        backgroundSize:"44px 44px",
        animation:"grid-pan 8s linear infinite",
      }} />
      <div style={{ position:"absolute",width:700,height:700,top:-200,right:-200,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,229,255,0.06),transparent 65%)",filter:"blur(60px)" }} />
      <div style={{ position:"absolute",width:600,height:600,bottom:-180,left:-150,borderRadius:"50%",background:"radial-gradient(circle,rgba(155,109,255,0.07),transparent 65%)",filter:"blur(60px)" }} />
      <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 90% 90% at 50% 50%,transparent 40%,rgba(5,8,15,0.65) 100%)" }} />
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="msg-pop" style={{ display:"flex",alignItems:"flex-end",gap:9 }}>
      <AgentAvatar pulse />
      <div style={{
        padding:"12px 16px",
        background:"var(--ai-bubble)",border:"1px solid var(--ai-border)",
        borderRadius:"4px 18px 18px 18px",
        display:"flex",gap:5,alignItems:"center",
      }}>
        {[0,0.15,0.3].map((d,i)=>(
          <div key={i} style={{ width:6,height:6,borderRadius:"50%",background:"var(--cyan)",animation:`dot 1.2s ease-in-out ${d}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

function AgentAvatar({ pulse=false }: { pulse?: boolean }) {
  return (
    <div style={{
      width:32,height:32,borderRadius:10,flexShrink:0,
      background:"linear-gradient(135deg,rgba(0,229,255,0.15),rgba(155,109,255,0.15))",
      border:`1.5px solid ${pulse ? "rgba(0,229,255,0.5)" : "rgba(0,229,255,0.2)"}`,
      display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,
      boxShadow: pulse ? "0 0 16px rgba(0,229,255,0.2)" : "none",
      animation: pulse ? "pulse-slow 2s ease-in-out infinite" : "none",
    }}>⬡</div>
  );
}

function UserAvatar() {
  return (
    <div style={{
      width:32,height:32,borderRadius:10,flexShrink:0,
      background:"linear-gradient(135deg,rgba(155,109,255,0.2),rgba(56,189,248,0.15))",
      border:"1.5px solid rgba(155,109,255,0.3)",
      display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,
      fontFamily:"'JetBrains Mono',monospace",color:"var(--violet)",fontWeight:600,
    }}>U</div>
  );
}

function ActionTag({ action }: { action: string }) {
  const cfg = ACTION_LABELS[action] || { label: action, color: "#94a3b8" };
  return (
    <span className="tag-in" style={{
      display:"inline-flex",alignItems:"center",gap:4,
      padding:"2px 8px",borderRadius:99,
      background:`${cfg.color}15`,border:`1px solid ${cfg.color}30`,
      fontSize:10,fontFamily:"'JetBrains Mono',monospace",
      color:cfg.color,letterSpacing:"0.06em",fontWeight:500,
    }}>
      <span style={{ width:5,height:5,borderRadius:"50%",background:cfg.color,flexShrink:0,display:"inline-block" }} />
      {cfg.label}
    </span>
  );
}

function MetaBlock({ meta }: { meta: ActionMeta }) {
  const pairs = [
    meta.project   && ["Project", meta.project],
    meta.task      && ["Task",    meta.task],
    meta.new_status && ["Status", meta.new_status],
  ].filter(Boolean) as [string, string][];
  if (!pairs.length) return null;
  return (
    <div style={{
      display:"flex",flexWrap:"wrap",gap:6,marginTop:6,
      padding:"7px 10px",
      background:"rgba(255,255,255,0.025)",border:"1px solid var(--border)",borderRadius:8,
    }}>
      {pairs.map(([k,v])=>(
        <div key={k} style={{ display:"flex",gap:4,alignItems:"center",fontSize:11,fontFamily:"'JetBrains Mono',monospace" }}>
          <span style={{ color:"var(--dim)" }}>{k}:</span>
          <span style={{ color:"var(--text)",fontWeight:500 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function VoiceBadge() {
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:4,
      padding:"2px 8px",borderRadius:99,
      background:"rgba(255,77,109,0.1)",border:"1px solid rgba(255,77,109,0.25)",
      fontSize:10,fontFamily:"'JetBrains Mono',monospace",
      color:"var(--rec)",letterSpacing:"0.06em",fontWeight:500,
    }}>
      🎙 voice
    </span>
  );
}

function AudioPlayButton({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <button
      onClick={toggle}
      className={playing ? "audio-playing" : ""}
      style={{
        marginTop:8,
        display:"inline-flex",alignItems:"center",gap:7,
        padding:"7px 14px",borderRadius:99,
        background: playing ? "rgba(0,229,255,0.12)" : "rgba(0,229,255,0.06)",
        border:`1px solid ${playing ? "rgba(0,229,255,0.4)" : "rgba(0,229,255,0.2)"}`,
        color: playing ? "var(--cyan)" : "var(--muted)",
        fontSize:12,fontFamily:"'JetBrains Mono',monospace",
        transition:"all 0.2s",
      }}
    >
      <span style={{ fontSize:14 }}>{playing ? "⏸" : "▶"}</span>
      {playing ? "Playing…" : "Play response"}
    </button>
  );
}

// Waveform animation shown while recording
function RecordingWave() {
  return (
    <div style={{ display:"flex",alignItems:"center",gap:3,height:28 }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="wave-bar" style={{ height: [14,20,26,22,18,24,16][i] }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function ProjectTrackerPage() {
  const { user } = useAuth();

  const { data: limitCheck, isLoading: limitLoading } = useQuery({
    queryKey: ['limit-check', 'project-tracking-agent'],
    queryFn: () => usageApi.checkLimit('project-tracking-agent'),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const isBlocked = limitCheck?.is_blocked === true;
  useAgentTimer("project-tracking-agent", !isBlocked);

  const sessionId = useRef(`session_web_${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<Msg[]>([{
    id: uid(), sender:"ai", kind:"text", time: nowTime(),
    text:"👋 Hello! I'm your **Project Tracking Agent**. I can help you:\n\n• Check project & task status\n• Update task progress\n• Assign & create tasks\n• Set reminders & escalations\n• View team workload\n• Search & filter tasks\n\nWhat would you like to do? You can type or tap the mic to speak.",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle"|"connected"|"error">("idle");

  // voice recording
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const recTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // project session state
  const lastProjectKeyRef  = useRef<string | null>(null);
  const lastProjectNameRef = useRef<string | null>(null);
  const availableProjectsRef = useRef<Array<{ key: string; name: string; id: string; url: string }>>([]);
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  useEffect(()=>{
    messagesEndRef.current?.scrollIntoView({ behavior:"smooth" });
  },[messages, loading]);

  const addMsg = useCallback((sender: MsgSender, text: string, meta?: ActionMeta, kind: MsgKind = "text") => {
    setMessages(prev => [...prev, { id:uid(), sender, kind, text, time:nowTime(), meta }]);
  },[]);

  // ── Text send ─────────────────────────────────────────────
  const send = useCallback(async (overrideText?: string) => {
    const t = (overrideText ?? input).trim();
    if (!t || loading) return;
    if (!overrideText) setInput("");

    addMsg("user", t);
    setLoading(true);
    setConnectionStatus("idle");

    const history = [...historyRef.current];
    historyRef.current = [...history, { role: "user", content: t }];

    try {
      const token = getAccessToken();
      const base = (process.env.NEXT_PUBLIC_API_URL || "https://backend.lifescienceaiagents.com").replace(/\/$/, "");
      const res = await fetch(`${base}/api/v1/agents/project-tracking-agent/execute/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: t,
          session_id: sessionId.current,
          company_id: user?.id ?? sessionId.current,
          userId: user?.id,
          userName: user?.email,
          userEmail: user?.email,
          channel: "web",
          conversationHistory: history,
          last_project_key: lastProjectKeyRef.current,
          last_project_name: lastProjectNameRef.current,
          available_projects: availableProjectsRef.current,
        }),
      });

      const envelope = await res.json();

      if (res.status === 401 || envelope.error?.code === "TOKEN_NOT_VALID") {
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user");
          document.cookie = "access_token=; path=/; max-age=0";
          window.location.href = "/login";
        }
        return;
      }

      if (!res.ok || envelope.success === false) {
        addMsg("ai", envelope.error?.message || "Something went wrong. Please try again.");
        setConnectionStatus("error");
        historyRef.current = history;
        return;
      }

      const data = envelope.data ?? envelope;
      const reply = data.reply || data.message || "Done.";

      if (data.session_id) sessionId.current = data.session_id;
      if (data.last_project_key)  lastProjectKeyRef.current  = data.last_project_key;
      if (data.last_project_name) lastProjectNameRef.current = data.last_project_name;
      if (Array.isArray(data.available_projects) && data.available_projects.length > 0) {
        availableProjectsRef.current = data.available_projects;
      }

      setConnectionStatus("connected");
      addMsg("ai", reply, {
        action:             data.intent ?? data.action,
        project:            data.last_project_name ?? data.project,
        task:               data.task,
        new_status:         data.new_status,
        actor:              data.actor,
        log_id:             data.log_id,
        available_projects: data.available_projects,
      });
      historyRef.current = [...historyRef.current, { role: "assistant", content: reply }];
    } catch (err) {
      console.error("[project-tracker]", err);
      addMsg("ai", "⚠️ Connection failed. Please check your network and try again.");
      setConnectionStatus("error");
      historyRef.current = history;
    } finally {
      setLoading(false);
    }
  }, [input, loading, addMsg, user]);

  // ── Voice recording ───────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (loading || recordState !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const mr = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start(100);
      mediaRecorderRef.current = mr;

      setRecordState("recording");
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch {
      addMsg("ai", "⚠️ Microphone access denied. Please allow microphone permission and try again.");
    }
  }, [loading, recordState, addMsg]);

  const stopRecording = useCallback(() => {
    if (recordState !== "recording") return;
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }

    const mr = mediaRecorderRef.current;
    if (!mr) return;

    mr.onstop = async () => {
      mr.stream.getTracks().forEach(t => t.stop());
      const mimeType = mr.mimeType || "audio/webm";
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      setRecordState("processing");
      await sendVoice(blob, ext);
      setRecordState("idle");
      setRecSeconds(0);
    };
    mr.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordState]);

  const sendVoice = async (blob: Blob, ext: string) => {
    setLoading(true);
    setConnectionStatus("idle");

    try {
      const token = getAccessToken();
      const base = (process.env.NEXT_PUBLIC_API_URL || "https://api.lifescienceaiagents.com").replace(/\/$/, "");

      const formData = new FormData();
      formData.append("audio", blob, `recording.${ext}`);
      formData.append("sessionId", sessionId.current);

      const res = await fetch(`${base}/api/v1/agents/project-tracking-agent/voice/`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const envelope = await res.json();

      if (res.status === 401 || envelope.error?.code === "TOKEN_NOT_VALID") {
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user");
          document.cookie = "access_token=; path=/; max-age=0";
          window.location.href = "/login";
        }
        return;
      }

      if (!res.ok || envelope.success === false) {
        addMsg("ai", envelope.error?.message || "Voice processing failed. Please try again.");
        setConnectionStatus("error");
        return;
      }

      const data = envelope.data ?? envelope;
      const transcript = data.transcript || "";
      const reply      = data.reply || data.message || "Done.";
      const audioUrl   = data.audio_url || null;

      // Show user message with transcript
      if (transcript) {
        addMsg("user", transcript, { isVoice: true }, "voice");
      }

      setConnectionStatus("connected");

      // Show AI reply with audio player
      addMsg("ai", reply, {
        isVoice: true,
        audioUrl,
        action:  data.intent ?? data.action,
        project: data.last_project_name ?? data.project,
        task:    data.task,
        new_status: data.new_status,
      }, "voice");

      // Auto-play audio response
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.play().catch(() => {});
      }

      // Keep history in sync
      if (transcript) {
        historyRef.current = [
          ...historyRef.current,
          { role: "user", content: transcript },
          { role: "assistant", content: reply },
        ];
      }
    } catch (err) {
      console.error("[project-tracker voice]", err);
      addMsg("ai", "⚠️ Voice request failed. Please try again.");
      setConnectionStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const [showVoiceComingSoon, setShowVoiceComingSoon] = useState(false);

  const handleMicClick = useCallback(() => {
    setShowVoiceComingSoon(true);
  }, []);

  // ── Render ────────────────────────────────────────────────
  const isRecording   = recordState === "recording";
  const isProcessing  = recordState === "processing";

  if (limitLoading) return null;

  if (isBlocked) return (
    <>
      <style>{CSS}</style>
      <GridBg />
      <div style={{ position:"relative", zIndex:1, height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16, padding:24, textAlign:"center" }}>
        <div style={{ fontSize:48 }}>⏱️</div>
        <h2 style={{ fontSize:22, fontWeight:700, color:"var(--rose)" }}>Time Limit Reached</h2>
        <p style={{ color:"var(--muted)", maxWidth:360 }}>
          You have used <strong style={{color:"var(--text)"}}>{limitCheck?.used_minutes} min</strong> of your <strong style={{color:"var(--text)"}}>{limitCheck?.limit_minutes} min</strong> limit for this agent.
        </p>
        <p style={{ color:"var(--muted)", fontSize:13 }}>Please contact your administrator to increase your limit.</p>
        <a href="/dashboard" style={{ marginTop:8, padding:"10px 24px", background:"rgba(255,77,109,0.15)", border:"1px solid rgba(255,77,109,0.3)", borderRadius:10, color:"var(--rose)", fontSize:14, fontWeight:600, textDecoration:"none" }}>
          Back to Dashboard
        </a>
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <GridBg />

      <div style={{
        position:"relative", zIndex:1,
        height:"100vh", maxHeight:"100dvh",
        display:"flex", flexDirection:"column",
        overflow:"hidden",
      }}>

        {/* ── HEADER ─────────────────────────────────────────── */}
        <header style={{
          flexShrink:0, height:60,
          borderBottom:"1px solid var(--border)",
          background:"rgba(5,8,15,0.82)", backdropFilter:"blur(28px)",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 max(16px,env(safe-area-inset-left)) 0 max(16px,env(safe-area-inset-right))",
          position:"relative",
        }}>
          <div style={{ position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent 5%,var(--cyan) 50%,transparent 95%)",opacity:0.25,animation:"glow-line 3s ease-in-out infinite" }} />

          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <Link href="/" style={{ textDecoration:"none" }}>
              <button style={{
                width:34,height:34,borderRadius:9,
                background:"rgba(255,255,255,0.04)",border:"1px solid var(--border-hi)",
                color:"var(--muted)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,
              }}>←</button>
            </Link>
            <div style={{ width:1,height:22,background:"var(--border-hi)" }} />
            <AgentAvatar />
            <div>
              <div style={{
                fontSize:15,fontWeight:700,letterSpacing:"-0.03em",
                background:"linear-gradient(90deg,var(--cyan),var(--violet))",
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
              }}>
                Project Tracker
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:5,marginTop:1 }}>
                <div style={{
                  width:5,height:5,borderRadius:"50%",flexShrink:0,
                  background: connectionStatus==="error" ? "var(--rose)" : "var(--green)",
                  boxShadow:`0 0 6px ${connectionStatus==="error" ? "var(--rose)" : "var(--green)"}`,
                  animation:"pulse-slow 2s ease-in-out infinite",
                }} />
                <span style={{
                  fontSize:9,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.06em",
                  textTransform:"uppercase",
                  color: loading ? "var(--amber)" : connectionStatus==="error" ? "var(--rose)" : "var(--muted)",
                }}>
                  {isRecording ? "recording…" : isProcessing ? "transcribing…" : loading ? "processing…" : connectionStatus==="error" ? "error" : "online"}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <div className="rec-badge" style={{
              padding:"4px 10px",borderRadius:99,
              background: isRecording ? "rgba(255,77,109,0.1)" : "rgba(0,229,255,0.05)",
              border:`1px solid ${isRecording ? "rgba(255,77,109,0.35)" : "rgba(0,229,255,0.13)"}`,
              fontSize:9,fontFamily:"'JetBrains Mono',monospace",
              color: isRecording ? "var(--rec)" : "rgba(0,229,255,0.6)",
              letterSpacing:"0.06em",
              whiteSpace:"nowrap",
              transition:"all 0.3s",
            }}>
              {isRecording ? `● REC ${fmtSecs(recSeconds)}` : "SESSION ACTIVE"}
            </div>
          </div>
        </header>

        {/* ── MESSAGES ───────────────────────────────────────── */}
        <div className="scroller" style={{
          flex:1,overflowY:"auto",
          padding:"20px 16px 12px",
          display:"flex",flexDirection:"column",gap:14,
        }}>
          {messages.map(msg => (
            <div key={msg.id} className="msg-pop" style={{
              display:"flex",
              flexDirection: msg.sender==="user" ? "row-reverse" : "row",
              alignItems:"flex-end",
              gap:9,
            }}>
              {msg.sender === "ai" ? <AgentAvatar /> : <UserAvatar />}

              <div className="msg-bubble" style={{
                display:"flex",flexDirection:"column",
                alignItems: msg.sender==="user" ? "flex-end" : "flex-start",
                maxWidth:"74%",
              }}>
                {/* tags above AI message */}
                {msg.sender==="ai" && (
                  <div style={{ display:"flex",gap:5,marginBottom:5,flexWrap:"wrap" }}>
                    {msg.meta?.action && <ActionTag action={msg.meta.action} />}
                    {msg.kind==="voice" && <span style={{
                      display:"inline-flex",alignItems:"center",gap:3,
                      padding:"2px 8px",borderRadius:99,
                      background:"rgba(0,229,255,0.08)",border:"1px solid rgba(0,229,255,0.2)",
                      fontSize:10,fontFamily:"'JetBrains Mono',monospace",
                      color:"var(--cyan)",letterSpacing:"0.06em",
                    }}>🔊 voice reply</span>}
                  </div>
                )}

                {/* voice badge above user message */}
                {msg.sender==="user" && msg.kind==="voice" && (
                  <div style={{ marginBottom:5 }}><VoiceBadge /></div>
                )}

                <div className="msg-text" style={{
                  padding:"11px 15px",fontSize:14,lineHeight:1.7,
                  wordBreak:"break-word",overflowWrap:"anywhere",
                  borderRadius: msg.sender==="ai" ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                  background: msg.sender==="ai" ? "var(--ai-bubble)" : "var(--user-bubble)",
                  border: msg.sender==="ai" ? "1px solid var(--ai-border)" : "1px solid var(--user-border)",
                  backdropFilter:"blur(16px)",
                  whiteSpace:"pre-wrap",
                }}>
                  {renderText(msg.text)}
                </div>

                {/* audio play button for voice replies */}
                {msg.sender==="ai" && msg.meta?.audioUrl && (
                  <AudioPlayButton url={msg.meta.audioUrl} />
                )}

                {msg.meta && (msg.meta.project || msg.meta.task || msg.meta.new_status || msg.meta.actor) && (
                  <MetaBlock meta={msg.meta} />
                )}

                {msg.sender === "ai" && msg.meta?.available_projects && msg.meta.available_projects.length > 0 && (
                  <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginTop:8 }}>
                    {msg.meta.available_projects.map((p, i) => (
                      <button
                        key={p.key}
                        onClick={() => send(`${i + 1}`)}
                        style={{
                          padding:"5px 12px",borderRadius:8,fontSize:12,fontWeight:600,
                          background:"rgba(0,212,255,0.08)",border:"1px solid rgba(0,212,255,0.25)",
                          color:"#00D4FF",cursor:"pointer",transition:"all 0.15s",
                        }}
                        onMouseEnter={e=>(e.currentTarget.style.background="rgba(0,212,255,0.18)")}
                        onMouseLeave={e=>(e.currentTarget.style.background="rgba(0,212,255,0.08)")}
                      >
                        {i + 1}. {p.name}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{
                  fontSize:9,color:"var(--dim)",marginTop:4,
                  fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.05em",
                  paddingLeft: msg.sender==="user" ? 0 : 3,
                  paddingRight: msg.sender==="user" ? 3 : 0,
                }}>
                  {msg.time}
                </div>
              </div>
            </div>
          ))}

          {loading && !isProcessing && <TypingBubble />}

          <div ref={messagesEndRef} style={{ height:4 }} />
        </div>

        {/* ── RECORDING OVERLAY ──────────────────────────────── */}
        {(isRecording || isProcessing) && (
          <div className="slide-up" style={{
            flexShrink:0,
            margin:"0 16px 0",
            padding:"14px 20px",
            borderRadius:16,
            background:"rgba(255,77,109,0.06)",
            border:"1px solid rgba(255,77,109,0.2)",
            display:"flex",alignItems:"center",justifyContent:"space-between",
            backdropFilter:"blur(20px)",
          }}>
            <div style={{ display:"flex",alignItems:"center",gap:12 }}>
              {isProcessing ? (
                <span style={{ fontSize:18, animation:"spin 0.9s linear infinite", display:"inline-block" }}>◌</span>
              ) : (
                <div style={{
                  width:10,height:10,borderRadius:"50%",
                  background:"var(--rec)",
                  animation:"pulse-slow 0.8s ease-in-out infinite",
                  boxShadow:"0 0 10px var(--rec-glow)",
                }} />
              )}
              {isRecording ? <RecordingWave /> : null}
              <div>
                <div style={{ fontSize:13,fontWeight:600,color:"var(--rec)" }}>
                  {isProcessing ? "Transcribing…" : "Recording"}
                </div>
                {isRecording && (
                  <div style={{ fontSize:11,color:"var(--muted)",fontFamily:"'JetBrains Mono',monospace",marginTop:1 }}>
                    {fmtSecs(recSeconds)} — tap stop when done
                  </div>
                )}
                {isProcessing && (
                  <div style={{ fontSize:11,color:"var(--muted)",fontFamily:"'JetBrains Mono',monospace",marginTop:1 }}>
                    Processing your voice…
                  </div>
                )}
              </div>
            </div>
            {isRecording && (
              <button
                onClick={stopRecording}
                style={{
                  padding:"7px 16px",borderRadius:99,
                  background:"rgba(255,77,109,0.15)",
                  border:"1px solid rgba(255,77,109,0.4)",
                  color:"var(--rec)",fontSize:12,fontWeight:700,
                  letterSpacing:"0.04em",
                }}
              >
                ■ STOP
              </button>
            )}
          </div>
        )}

        {/* ── INPUT FOOTER ───────────────────────────────────── */}
        <footer style={{
          flexShrink:0,
          padding:"12px 16px max(16px,env(safe-area-inset-bottom)) 16px",
          borderTop:"1px solid var(--border)",
          background:"rgba(5,8,15,0.85)",backdropFilter:"blur(28px)",
          position:"relative",
        }}>
          <div style={{
            position:"absolute",top:0,left:0,right:0,height:1,
            background:"linear-gradient(90deg,transparent 8%,rgba(0,229,255,0.1) 50%,transparent 92%)",
          }} />

          <div className="footer-row" style={{ display:"flex",gap:8,alignItems:"center" }}>

            {/* Mic button */}
            <button
              onClick={handleMicClick}
              onTouchStart={(e) => { e.preventDefault(); if (recordState === "idle" && !loading && !isProcessing) startRecording(); }}
              onTouchEnd={(e) => { e.preventDefault(); if (recordState === "recording") stopRecording(); }}
              disabled={isProcessing || loading}
              className={`mic-btn${isRecording ? " rec-btn-active" : ""}`}
              title={isRecording ? "Stop recording" : "Tap to speak"}
              aria-label={isRecording ? "Stop recording" : "Start voice input"}
              style={{
                width:46,height:46,borderRadius:14,flexShrink:0,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:18,
                background: isRecording
                  ? "rgba(255,77,109,0.2)"
                  : "rgba(255,255,255,0.04)",
                border: isRecording
                  ? "1px solid rgba(255,77,109,0.5)"
                  : "1px solid var(--border-hi)",
                color: isRecording ? "var(--rec)" : "var(--muted)",
                cursor: isProcessing || loading ? "not-allowed" : "pointer",
                transition:"all 0.2s",
                opacity: isProcessing || (loading && !isRecording) ? 0.4 : 1,
                touchAction:"manipulation",
                WebkitUserSelect:"none",
                userSelect:"none",
              }}
            >
              {isRecording ? "⏹" : "🎙"}
            </button>

            {/* Text input */}
            <div
              className="input-wrap"
              style={{
                flex:1,display:"flex",alignItems:"center",
                background:"var(--surface2)",
                border:"1.5px solid var(--border-hi)",
                borderRadius:16,overflow:"hidden",
                transition:"border-color 0.2s",
                opacity: isRecording || isProcessing ? 0.4 : 1,
                pointerEvents: isRecording || isProcessing ? "none" : "auto",
              }}
              onFocusCapture={e=>(e.currentTarget.style.borderColor="rgba(0,229,255,0.3)")}
              onBlurCapture={e=>(e.currentTarget.style.borderColor="var(--border-hi)")}
            >
              <span style={{ padding:"0 12px",fontSize:15,color:"var(--muted)",flexShrink:0,userSelect:"none" }}>⬡</span>
              <input
                ref={inputRef}
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); } }}
                placeholder={isRecording ? "Recording… tap ⏹ to stop" : "Ask about tasks, projects…"}
                disabled={loading || isRecording || isProcessing}
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="off"
                style={{
                  flex:1,height:48,padding:"0 4px 0 0",
                  background:"transparent",border:"none",
                  color:"var(--text)",fontSize:14,
                  minWidth:0,
                }}
              />
            </div>

            {/* Send button */}
            <button
              onClick={()=>send()}
              disabled={!input.trim()||loading||isRecording||isProcessing}
              className="send-btn"
              style={{
                width:46,height:46,borderRadius:14,flexShrink:0,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:18,
                background: input.trim()&&!loading&&!isRecording&&!isProcessing
                  ? "linear-gradient(135deg,rgba(0,229,255,0.22),rgba(155,109,255,0.22))"
                  : "rgba(255,255,255,0.04)",
                border: input.trim()&&!loading&&!isRecording&&!isProcessing
                  ? "1px solid rgba(0,229,255,0.35)"
                  : "1px solid var(--border)",
                color: input.trim()&&!loading&&!isRecording&&!isProcessing ? "var(--cyan)" : "var(--muted)",
                cursor: input.trim()&&!loading&&!isRecording&&!isProcessing ? "pointer" : "not-allowed",
                transition:"all 0.18s",
                touchAction:"manipulation",
              }}
            >
              {loading && !isRecording && !isProcessing
                ? <span style={{ animation:"spin 0.9s linear infinite",display:"inline-block" }}>◌</span>
                : "↑"}
            </button>
          </div>

          <div style={{
            display:"flex",justifyContent:"space-between",
            alignItems:"center",marginTop:7,
          }}>
            <span style={{
              fontSize:9,fontFamily:"'JetBrains Mono',monospace",
              color:"var(--dim)",letterSpacing:"0.05em",
            }}>
              Project Tracking Agent · 🎙 voice + ⌨ text
            </span>
            <span style={{
              fontSize:9,fontFamily:"'JetBrains Mono',monospace",
              letterSpacing:"0.05em",
              color: isRecording ? "var(--rec)" : isProcessing ? "var(--amber)" : loading ? "var(--amber)" : "var(--dim)",
              animation: isRecording||isProcessing||loading ? "pulse-slow 1s ease infinite" : "none",
            }}>
              {isRecording ? "● recording" : isProcessing ? "● transcribing" : loading ? "● thinking…" : "○ ready"}
            </span>
          </div>
        </footer>
      </div>

      {/* ── VOICE COMING SOON OVERLAY ─────────────────────────── */}
      {showVoiceComingSoon && (
        <div
          onClick={() => setShowVoiceComingSoon(false)}
          style={{
            position:"fixed",inset:0,zIndex:100,
            background:"rgba(5,8,15,0.75)",
            backdropFilter:"blur(12px)",
            display:"flex",alignItems:"center",justifyContent:"center",
            padding:24,
            animation:"fade-in 0.2s ease both",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:"linear-gradient(135deg,rgba(11,16,28,0.98),rgba(17,24,39,0.98))",
              border:"1px solid rgba(155,109,255,0.25)",
              borderRadius:24,
              padding:"40px 36px",
              maxWidth:360,
              width:"100%",
              textAlign:"center",
              boxShadow:"0 0 60px rgba(155,109,255,0.15)",
              animation:"msg-pop 0.3s cubic-bezier(0.34,1.4,0.64,1) both",
            }}
          >
            {/* icon */}
            <div style={{
              width:64,height:64,borderRadius:20,margin:"0 auto 20px",
              background:"linear-gradient(135deg,rgba(155,109,255,0.15),rgba(0,229,255,0.1))",
              border:"1.5px solid rgba(155,109,255,0.3)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:28,
              boxShadow:"0 0 30px rgba(155,109,255,0.15)",
            }}>
              🎙
            </div>

            <div style={{
              fontSize:11,fontFamily:"'JetBrains Mono',monospace",
              letterSpacing:"0.12em",textTransform:"uppercase",
              color:"var(--violet)",marginBottom:10,
            }}>
              Coming Soon
            </div>

            <div style={{
              fontSize:20,fontWeight:800,letterSpacing:"-0.03em",
              background:"linear-gradient(90deg,var(--cyan),var(--violet))",
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
              marginBottom:12,
            }}>
              Voice Mode
            </div>

            <p style={{
              fontSize:13,lineHeight:1.7,
              color:"rgba(232,237,248,0.5)",
              marginBottom:28,
            }}>
              We're working on it! Voice input for the Project Tracking Agent will be available soon.
            </p>

            {/* progress bar */}
            <div style={{
              height:3,borderRadius:99,
              background:"rgba(255,255,255,0.06)",
              overflow:"hidden",
              marginBottom:28,
            }}>
              <div style={{
                height:"100%",width:"65%",borderRadius:99,
                background:"linear-gradient(90deg,var(--violet),var(--cyan))",
                boxShadow:"0 0 10px rgba(0,229,255,0.4)",
              }} />
            </div>

            <button
              onClick={() => setShowVoiceComingSoon(false)}
              style={{
                width:"100%",padding:"12px",borderRadius:12,
                background:"linear-gradient(135deg,rgba(155,109,255,0.15),rgba(0,229,255,0.1))",
                border:"1px solid rgba(155,109,255,0.3)",
                color:"var(--text)",fontSize:14,fontWeight:600,
                cursor:"pointer",transition:"all 0.2s",
              }}
              onMouseEnter={e=>(e.currentTarget.style.background="linear-gradient(135deg,rgba(155,109,255,0.25),rgba(0,229,255,0.18))")}
              onMouseLeave={e=>(e.currentTarget.style.background="linear-gradient(135deg,rgba(155,109,255,0.15),rgba(0,229,255,0.1))")}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Text renderer — handles **bold** and newlines
// ─────────────────────────────────────────────────────────────
function renderText(text: string): React.ReactNode {
  return text.split("\n").map((line, li, arr) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={li}>
        {parts.map((p, pi) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={pi} style={{ fontWeight:700, color:"var(--text)" }}>{p.slice(2,-2)}</strong>
            : <span key={pi}>{p}</span>
        )}
        {li < arr.length - 1 && <br />}
      </span>
    );
  });
}
