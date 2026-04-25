"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUp, PhoneOff, Mic, MicOff, MessageSquare, Phone,
  ChevronLeft, Loader2, AlertTriangle, X, CheckCircle2,
  User, Mail, FileText, Wifi
} from "lucide-react";
import { AgentAccessCheck } from "@/components/agent-access-check";

type CallState = "idle" | "listening" | "processing" | "speaking";
type Mode = "text" | "voice";

interface Msg {
  id: string;
  sender: "ai" | "user";
  type: "text";
  text: string;
  time: string;
}

interface SessionState {
  step?: string;
  sessionId?: string;
  knownName?: string;
  lastSlots?: string;
  selectedSlot?: string;
  startTime?: string;
  endTime?: string;
  showForm?: boolean;
  [key: string]: unknown;
}

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #080b14; --border: rgba(255,255,255,0.08); --border-bright: rgba(255,255,255,0.16);
    --text: #f0f4ff; --muted: rgba(240,244,255,0.4); --accent: #4fffb0;
    --accent2: #38bdf8; --accent3: #a78bfa; --danger: #ff5a6e;
  }
  html, body { height: 100%; background: var(--bg); color: var(--text); font-family: 'Space Grotesk', sans-serif; overflow: hidden; overscroll-behavior: none; }
  .chat-root { height: 100vh; height: 100dvh; }
  @keyframes slide-up { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes drift1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(60px,40px)} }
  @keyframes drift2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-50px,-40px)} }
  @keyframes drift3 { 0%,100%{transform:translate(-50%,-50%) scale(1)} 50%{transform:translate(-50%,-50%) scale(1.15)} }
  @keyframes ring-pulse { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.18);opacity:0} }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes dot-bounce { 0%,80%,100%{transform:translateY(0);opacity:0.3} 40%{transform:translateY(-5px);opacity:1} }
  @keyframes msg-in { from{opacity:0;transform:translateY(12px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes orb-idle { 0%,100%{transform:scale(1);opacity:0.5} 50%{transform:scale(1.06);opacity:0.8} }
  @keyframes orb-listen { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(1.25);opacity:0} }
  @keyframes orb-speak { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
  @keyframes orb-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes fade-in { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slide-up { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
  @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-4px)} 40%,80%{transform:translateX(4px)} }
  .msg-in { animation: msg-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
  .fade-in { animation: fade-in 0.3s ease both; }
  .slide-up { animation: slide-up 0.35s cubic-bezier(0.34,1.2,0.64,1) both; }
  .shake { animation: shake 0.4s ease; }
  .scroller { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent; -webkit-overflow-scrolling: touch; }
  .scroller::-webkit-scrollbar { width: 3px; }
  .scroller::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
  input::placeholder, textarea::placeholder { color: var(--muted); }
  input:focus, textarea:focus { outline: none; }
  button { cursor: pointer; border: none; background: none; font-family: 'Space Grotesk', sans-serif; }
  input, textarea, select { font-size: 16px !important; }
  * { -webkit-tap-highlight-color: transparent; }
  .interrupt-btn { transition: all 0.2s; }
  .interrupt-btn:hover { transform: scale(1.06); }
  .interrupt-btn:active { transform: scale(0.94); }
  @media (max-width: 600px) {
    .msg-bubble { max-width: 84% !important; }
    .msg-text { font-size: 13.5px !important; padding: 10px 14px !important; }
    .header-name { font-size: 14px !important; }
    .voice-panel { padding: 12px 16px 18px !important; gap: 10px !important; }
    .text-footer { padding: 10px 14px 14px !important; }
    .messages-area { padding: 16px 14px 10px !important; }
    .orb-wrap { width: 100px !important; height: 100px !important; }
    .live-bars { height: 28px !important; }
    .call-timer { font-size: 18px !important; }
    .mode-btn span { display: none; }
    .online-dot-label { display: none; }
    /* Booking dialog — full-width card on mobile */
    .booking-overlay { padding: 10px !important; align-items: center !important; }
    .booking-card { border-radius: 18px !important; }
    .booking-card input, .booking-card textarea { font-size: 16px !important; }
    .booking-inner { padding: 16px 16px 22px !important; }
  }
`;

function fmtSecs(s: number) {
  s = Math.floor(s || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1")
    .replace(/#{1,6}\s*/g, "").replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/gu, "")
    .replace(/https?:\/\/\S+/g, "link").replace(/\bDr\./g, "Doctor").replace(/\bMr\./g, "Mister")
    .replace(/\bMs\./g, "Miss").replace(/\bProf\./g, "Professor").replace(/\betc\./gi, "etcetera")
    .replace(/\be\.g\./gi, "for example").replace(/\bi\.e\./gi, "that is").replace(/\.{2,}/g, ".")
    .replace(/\n{2,}/g, ". ").replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim();
}

function normalizeSpeech(raw: string): string {
  let t = raw.trim();
  const numMap: Record<string, string> = { zero:"0",one:"1",two:"2",three:"3",four:"4",five:"5",six:"6",seven:"7",eight:"8",nine:"9",ten:"10" };
  t = t.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, m => numMap[m.toLowerCase()] ?? m);
  t = t.replace(/\bat\s+the\s+rate\b/gi,"@").replace(/\bat\s+rate\b/gi,"@").replace(/\bat\s+sign\b/gi,"@");
  t = t.replace(/(\w)\s+at\s+(\w)/gi,"$1@$2");
  t = t.replace(/\bdot\s+(com|org|net|edu|gov|io|in|co|uk|ai|app|dev|info|biz)\b/gi,(_,tld)=>"." +tld.toLowerCase());
  t = t.replace(/(\w)\s+dot\s+(\w)/gi,"$1.$2").replace(/\bunderscore\b/gi,"_").replace(/\b(hyphen|dash)\b/gi,"-");
  t = t.replace(/\s*@\s*/g,"@").replace(/(\w)\s*\.\s*(\w)/g,"$1.$2");
  t = t.replace(/\bdouble\s+(\w)\b/gi,(_,c)=>c+c).replace(/\btriple\s+(\w)\b/gi,(_,c)=>c+c+c);
  return t.replace(/\s{2,}/g," ").trim();
}

/* ══════════════════════════════════════════════════════════
   ELEVENLABS TTS — AudioContext-based, with instant interruption.
   stop() kills AudioBufferSourceNode mid-playback in <5ms.
   The onended guard (this.running check) prevents onDone
   from firing after an interrupt.
══════════════════════════════════════════════════════════ */
class ElevenLabsTTS {
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private running = false;
  private initialized = false;

  async unlockAudio(): Promise<void> {
    if (this.initialized) return;
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Handle suspended state (common on mobile)
      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
        console.log("[TTS] AudioContext resumed successfully");
      }
      
      this.initialized = true;
      console.log("[TTS] AudioContext initialized:", this.audioCtx.state);
    } catch (e) { 
      console.warn("[TTS] AudioContext init failed:", e); 
    }
  }

  isSupported(): boolean {
    return typeof window !== "undefined" && !!(window.AudioContext || (window as any).webkitAudioContext);
  }

  async speak(text: string, onDone: () => void): Promise<void> {
    this.stop(); // interrupt any current speech
    this.running = true;

    if (!this.audioCtx) { onDone(); return; }
    if (this.audioCtx.state === "suspended") { try { await this.audioCtx.resume(); } catch { /**/ } }

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) { if (this.running) { this.running = false; onDone(); } return; }
      if (!this.running) return;

      const arrayBuffer = await res.arrayBuffer();
      if (!this.running) return;

      const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      if (!this.running) return;

      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioCtx.destination);
      this.currentSource = source;

      source.onended = () => {
        if (!this.running) return; // interrupted — don't fire onDone
        this.currentSource = null;
        this.running = false;
        onDone();
      };
      source.start(0);
    } catch (err) {
      console.error("[TTS] speak error:", err);
      if (this.running) { this.running = false; onDone(); }
    }
  }

  stop(): void {
    this.running = false;
    try { this.currentSource?.stop(); } catch { /**/ }
    this.currentSource = null;
  }

  get isSpeaking(): boolean { return this.running; }
}

/* ─── Background ─── */
function Background() {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden" }}>
      <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.016) 1px,transparent 1px)",backgroundSize:"44px 44px" }} />
      <div style={{ position:"absolute",width:"700px",height:"700px",top:"-220px",left:"-180px",borderRadius:"50%",filter:"blur(90px)",opacity:0.38,background:"radial-gradient(circle,rgba(56,189,248,0.28),transparent 70%)",animation:"drift1 18s ease-in-out infinite" }} />
      <div style={{ position:"absolute",width:"600px",height:"600px",bottom:"-200px",right:"-140px",borderRadius:"50%",filter:"blur(90px)",opacity:0.38,background:"radial-gradient(circle,rgba(167,139,250,0.22),transparent 70%)",animation:"drift2 22s ease-in-out infinite" }} />
      <div style={{ position:"absolute",width:"500px",height:"500px",top:"40%",left:"50%",transform:"translate(-50%,-50%)",borderRadius:"50%",filter:"blur(90px)",opacity:0.35,background:"radial-gradient(circle,rgba(79,255,176,0.10),transparent 70%)",animation:"drift3 28s ease-in-out infinite" }} />
      <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 85% 85% at 50% 50%,transparent 40%,rgba(8,11,20,0.55) 100%)" }} />
    </div>
  );
}

function TypingDots() {
  return (
    <div className="msg-in" style={{ display:"flex",gap:10,alignItems:"flex-end" }}>
      <div style={{ width:32,height:32,borderRadius:"50%",flexShrink:0,overflow:"hidden",border:"1px solid rgba(56,189,248,0.2)" }}>
        <Image src="/logo.png" alt="AI" width={32} height={32} style={{ width:"100%",height:"100%",objectFit:"contain" }} />
      </div>
      <div style={{ padding:"13px 17px",borderRadius:"5px 20px 20px 20px",background:"rgba(79,255,176,0.07)",border:"1px solid rgba(79,255,176,0.12)",display:"flex",gap:5,alignItems:"center" }}>
        {[0,0.16,0.32].map((d,i)=>(
          <div key={i} style={{ width:6,height:6,borderRadius:"50%",background:"var(--accent)",animation:`dot-bounce 1.2s ease-in-out ${d}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

function LiveBars({ callState, tick, compact=false }: { callState: CallState; tick: number; compact?: boolean }) {
  return (
    <div className="live-bars" style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:3,height:compact?20:36,width:"100%",transition:"height 0.3s ease" }}>
      {Array.from({ length:22 }).map((_,i)=>{
        let h=3,opacity=0.12,color="var(--accent2)";
        if(callState==="listening"){h=2+28*Math.abs(Math.sin(tick/110+i*0.44));opacity=0.2+0.8*Math.abs(Math.sin(tick/110+i*0.44));color="var(--accent)";}
        else if(callState==="speaking"){h=2+24*Math.abs(Math.sin(tick/280+i*0.38));opacity=0.25+0.7*Math.abs(Math.sin(tick/280+i*0.38));color="var(--accent3)";}
        else if(callState==="processing"){h=2+14*Math.abs(Math.sin(tick/140+i*0.6));opacity=0.35+0.5*Math.abs(Math.sin(tick/140+i*0.6));color="#ffb432";}
        return <div key={i} style={{ width:3,borderRadius:99,height:h,opacity,background:color,transition:"background 0.3s" }} />;
      })}
    </div>
  );
}

function Orb({ callState, onTap, size=120 }: { callState: CallState; onTap: () => void; size?: number }) {
  const cfg: Record<CallState,{bg:string;br:string;sh:string;anim:string;ring?:string}> = {
    idle:{bg:"rgba(8,11,20,0.6)",br:"rgba(56,189,248,0.25)",sh:"none",anim:"orb-idle 3s ease-in-out infinite"},
    listening:{bg:"linear-gradient(135deg,rgba(79,255,176,0.15),rgba(56,189,248,0.12))",br:"rgba(79,255,176,0.55)",sh:"0 0 50px rgba(79,255,176,0.22)",anim:"orb-listen 0.8s ease-out infinite",ring:"orb-listen 0.8s ease-out 0.22s infinite"},
    speaking:{bg:"linear-gradient(135deg,rgba(167,139,250,0.18),rgba(56,189,248,0.12))",br:"rgba(167,139,250,0.55)",sh:"0 0 60px rgba(167,139,250,0.28)",anim:"orb-speak 1.2s ease-in-out infinite",ring:"orb-speak 1.4s ease-in-out 0.3s infinite"},
    processing:{bg:"linear-gradient(135deg,rgba(255,180,50,0.12),rgba(255,90,110,0.08))",br:"rgba(255,180,50,0.35)",sh:"none",anim:"orb-spin 1.2s linear infinite"},
  };
  const c = cfg[callState];
  const imgSize = Math.round(size * 0.6);
  return (
    <div className="orb-wrap" style={{ position:"relative",width:size,height:size,flexShrink:0,userSelect:"none",touchAction:"manipulation",transition:"width 0.3s ease,height 0.3s ease" }}
      onClick={onTap} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();onTap();}}>
      {c.ring && <div style={{ position:"absolute",inset:-16,borderRadius:"50%",border:`1px solid ${c.br}`,opacity:0.5,animation:c.ring }} />}
      <div style={{ position:"absolute",inset:-8,borderRadius:"50%",border:`1.5px solid ${c.br}`,animation:c.anim }} />
      <div style={{ width:"100%",height:"100%",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:c.bg,border:`1.5px solid ${c.br}`,boxShadow:c.sh,transition:"all 0.35s",overflow:"hidden" }}>
        <Image src="/logo.png" alt="AI" width={imgSize} height={imgSize} style={{ objectFit:"contain",opacity:callState==="idle"?0.7:1,transition:"opacity 0.3s" }} />
      </div>
    </div>
  );
}

function SilenceCountdown({ seconds, total }: { seconds: number; total: number }) {
  const r=20,circ=2*Math.PI*r;
  return (
    <div className="fade-in" style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:6 }}>
      <div style={{ position:"relative",width:52,height:52 }}>
        <svg width="52" height="52" style={{ transform:"rotate(-90deg)" }}>
          <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
          <circle cx="26" cy="26" r={r} fill="none" stroke="var(--accent)" strokeWidth="2.5"
            strokeDasharray={circ} strokeDashoffset={circ*(1-seconds/total)}
            strokeLinecap="round" style={{ transition:"stroke-dashoffset 0.2s linear" }} />
        </svg>
        <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Mono',monospace",fontSize:15,fontWeight:600,color:"var(--accent)" }}>{seconds}</div>
      </div>
      <span style={{ fontSize:10,color:"var(--muted)",fontFamily:"'DM Mono',monospace",letterSpacing:"0.06em",textTransform:"uppercase" }}>sending…</span>
    </div>
  );
}

/* ══════════════════════════════════════════
   VOICE BOOKING DIALOG
   Shown during calls so user can type email /
   name / purpose accurately. Two-step:
   form → confirm. Email regex validated.
══════════════════════════════════════════ */
function VoiceBookingDialog({ open, onSubmit, onCancel }: {
  open: boolean;
  onSubmit: (d:{name:string;email:string;purpose:string;additionalEmails:string[]})=>void;
  onCancel: ()=>void;
}) {
  const [form, setForm] = useState({name:"",email:"",purpose:"",additionalEmails:[""]});
  const [emailError, setEmailError] = useState("");
  const [addEmailErrors, setAddEmailErrors] = useState<string[]>([""]);
  const [shakeEmail, setShakeEmail] = useState(false);
  const [step, setStep] = useState<"form"|"confirm">("form");

  if (!open) return null;

  const set = (k: keyof Omit<typeof form,"additionalEmails">, v: string) => { setForm(p=>({...p,[k]:v})); if(k==="email") setEmailError(""); };
  const emailValid = (e:string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

  const addAdditionalEmail = () => { setForm(p=>({...p,additionalEmails:[...p.additionalEmails,""]})); setAddEmailErrors(p=>[...p,""]); };
  const removeAdditionalEmail = (idx:number) => { setForm(p=>({...p,additionalEmails:p.additionalEmails.filter((_,i)=>i!==idx)})); setAddEmailErrors(p=>p.filter((_,i)=>i!==idx)); };
  const updateAdditionalEmail = (idx:number,val:string) => { setForm(p=>({...p,additionalEmails:p.additionalEmails.map((e,i)=>i===idx?val:e)})); setAddEmailErrors(p=>p.map((e,i)=>i===idx?"":e)); };

  const handleNext = () => {
    if (!form.name.trim()||!form.email.trim()||!form.purpose.trim()) return;
    if (!emailValid(form.email)) { setEmailError("Please enter a valid email address"); setShakeEmail(true); setTimeout(()=>setShakeEmail(false),500); return; }
    const errs = form.additionalEmails.map(e=>e.trim()&&!emailValid(e)?"Invalid email":"");
    if (errs.some(Boolean)) { setAddEmailErrors(errs); return; }
    setStep("confirm");
  };

  const validAdditionalEmails = form.additionalEmails.filter(e=>e.trim()&&emailValid(e));
  const handleSubmit = () => { onSubmit({...form,additionalEmails:validAdditionalEmails}); setForm({name:"",email:"",purpose:"",additionalEmails:[""]}); setAddEmailErrors([""]); setStep("form"); };
  const handleCancel = () => { setForm({name:"",email:"",purpose:"",additionalEmails:[""]}); setAddEmailErrors([""]); setStep("form"); setEmailError(""); onCancel(); };

  const inp: React.CSSProperties = { width:"100%",padding:"12px 14px 12px 42px",background:"rgba(255,255,255,0.05)",border:"1px solid var(--border-bright)",borderRadius:12,color:"var(--text)",fontSize:16,fontFamily:"'Space Grotesk',sans-serif",transition:"border-color 0.2s" };
  const inpErr: React.CSSProperties = { ...inp, borderColor:"rgba(255,90,110,0.6)" };
  const lbl: React.CSSProperties = { display:"block",fontSize:11,fontWeight:700,color:"var(--muted)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8 };

  return (
    <div className="booking-overlay" style={{ position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(4,7,15,0.88)",backdropFilter:"blur(24px)",padding:"16px" }}>
      <div className="fade-in booking-card" style={{ width:"100%",maxWidth:500,background:"rgba(14,18,32,0.98)",border:"1px solid var(--border-bright)",borderRadius:24,overflow:"hidden",boxShadow:"0 24px 80px rgba(0,0,0,0.75),0 0 0 1px rgba(56,189,248,0.06)",maxHeight:"92dvh",overflowY:"auto" }}>
        <div style={{ height:3,background:"linear-gradient(90deg,transparent,var(--accent2),var(--accent3),transparent)" }} />
        <div className="booking-inner" style={{ padding:"22px 22px 28px" }}>

          {/* Header */}
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6 }}>
            <div>
              <h2 style={{ fontSize:19,fontWeight:800,marginBottom:4 }}>{step==="form"?"Complete Booking":"Confirm Details"}</h2>
              <p style={{ fontSize:12,color:"var(--muted)" }}>{step==="form"?"Type carefully — speech recognition isn't reliable for emails":"Review before confirming"}</p>
            </div>
            <button onClick={handleCancel} style={{ width:32,height:32,borderRadius:9,background:"rgba(255,255,255,0.05)",border:"1px solid var(--border)",color:"var(--muted)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <X size={15} />
            </button>
          </div>

          {/* Active call pill */}
          <div style={{ display:"flex",alignItems:"center",gap:8,padding:"7px 12px",borderRadius:10,background:"rgba(79,255,176,0.06)",border:"1px solid rgba(79,255,176,0.18)",marginBottom:20,marginTop:10 }}>
            <div style={{ width:7,height:7,borderRadius:"50%",background:"var(--accent)",boxShadow:"0 0 8px var(--accent)",animation:"blink 1.5s ease-in-out infinite",flexShrink:0 }} />
            <span style={{ fontSize:11,color:"rgba(79,255,176,0.85)",fontFamily:"'DM Mono',monospace",letterSpacing:"0.06em" }}>CALL ACTIVE — AI PAUSED WHILE YOU TYPE</span>
          </div>

          {step === "form" ? (
            <div style={{ display:"flex",flexDirection:"column",gap:18 }}>

              {/* Name */}
              <div>
                <label style={lbl}>Full Name *</label>
                <div style={{ position:"relative" }}>
                  <User size={15} style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"var(--muted)",pointerEvents:"none" }} />
                  <input type="text" value={form.name} placeholder="Dr. Jane Smith" required onChange={e=>set("name",e.target.value)} style={inp} autoComplete="name" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={lbl}>Email Address *</label>
                <div className={shakeEmail?"shake":""} style={{ position:"relative" }}>
                  <Mail size={15} style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:emailError?"#ff5a6e":"var(--muted)",pointerEvents:"none" }} />
                  <input type="email" value={form.email} placeholder="jane@institute.org" required onChange={e=>set("email",e.target.value)} style={emailError?inpErr:inp} autoComplete="email" inputMode="email" />
                </div>
                {emailError && (
                  <div style={{ display:"flex",alignItems:"center",gap:5,marginTop:5 }}>
                    <AlertTriangle size={11} style={{ color:"#ff5a6e",flexShrink:0 }} />
                    <span style={{ fontSize:11,color:"#ff5a6e" }}>{emailError}</span>
                  </div>
                )}
                <p style={{ fontSize:11,color:"var(--muted)",marginTop:5,fontFamily:"'DM Mono',monospace" }}>Confirmation email will be sent here — type carefully</p>
              </div>

              {/* Additional Attendees */}
              <div>
                <label style={lbl}>Additional Attendees <span style={{ fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10 }}>(optional)</span></label>
                {form.additionalEmails.map((ae,idx)=>(
                  <div key={idx} style={{ marginBottom:8 }}>
                    <div style={{ position:"relative",display:"flex",alignItems:"center" }}>
                      <Mail size={15} style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"var(--muted)",pointerEvents:"none" }} />
                      <input type="email" value={ae} placeholder={`attendee@example.com`} onChange={e=>updateAdditionalEmail(idx,e.target.value)}
                        style={{ ...inp,paddingRight:38,borderColor:addEmailErrors[idx]?"rgba(255,90,110,0.6)":undefined }} inputMode="email" autoComplete="off" />
                      <button type="button" onClick={()=>removeAdditionalEmail(idx)}
                        style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--muted)",cursor:"pointer",display:"flex",alignItems:"center",padding:2,flexShrink:0 }}>
                        <X size={13}/>
                      </button>
                    </div>
                    {addEmailErrors[idx]&&<div style={{ display:"flex",alignItems:"center",gap:5,marginTop:4 }}><AlertTriangle size={11} style={{ color:"#ff5a6e" }}/><span style={{ fontSize:11,color:"#ff5a6e" }}>{addEmailErrors[idx]}</span></div>}
                  </div>
                ))}
                <button type="button" onClick={addAdditionalEmail}
                  style={{ display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--accent2)",background:"rgba(56,189,248,0.05)",border:"1px dashed rgba(56,189,248,0.28)",borderRadius:10,padding:"7px 14px",cursor:"pointer",width:"100%",justifyContent:"center",fontFamily:"'Space Grotesk',sans-serif" }}>
                  + Add Attendee
                </button>
              </div>

              {/* Purpose */}
              <div>
                <label style={lbl}>Meeting Purpose *</label>
                <div style={{ position:"relative" }}>
                  <FileText size={15} style={{ position:"absolute",left:14,top:14,color:"var(--muted)",pointerEvents:"none" }} />
                  <textarea rows={3} value={form.purpose} placeholder="Describe the purpose of the meeting…" required onChange={e=>set("purpose",e.target.value)} style={{ ...inp,paddingLeft:42,resize:"none",lineHeight:1.6 }} />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:"flex",gap:10,marginTop:4 }}>
                <button type="button" onClick={handleCancel} style={{ flex:1,padding:"13px",background:"rgba(255,255,255,0.04)",border:"1px solid var(--border-bright)",borderRadius:13,color:"var(--muted)",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                  <X size={14} /> Cancel
                </button>
                <button type="button" onClick={handleNext}
                  disabled={!form.name.trim()||!form.email.trim()||!form.purpose.trim()}
                  style={{ flex:2,padding:"13px",background:(!form.name.trim()||!form.email.trim()||!form.purpose.trim())?"rgba(255,255,255,0.06)":"linear-gradient(135deg,rgba(56,189,248,0.2),rgba(124,58,237,0.2))",border:"1px solid rgba(56,189,248,0.33)",borderRadius:13,color:(!form.name.trim()||!form.email.trim()||!form.purpose.trim())?"var(--muted)":"var(--accent2)",fontSize:14,fontWeight:700,letterSpacing:"0.04em",cursor:(!form.name.trim()||!form.email.trim()||!form.purpose.trim())?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                  Review & Confirm →
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              {[
                {icon:<User size={14}/>,label:"Name",value:form.name},
                {icon:<Mail size={14}/>,label:"Email",value:form.email},
                ...(validAdditionalEmails.length>0?[{icon:<Mail size={14}/>,label:"Additional Attendees",value:validAdditionalEmails.join(", ")}]:[]),
                {icon:<FileText size={14}/>,label:"Purpose",value:form.purpose},
              ].map(({icon,label,value})=>(
                <div key={label} style={{ padding:"12px 16px",background:"rgba(255,255,255,0.04)",border:"1px solid var(--border-bright)",borderRadius:12 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:4 }}>
                    <span style={{ color:"var(--accent2)" }}>{icon}</span>
                    <span style={{ fontSize:10,fontWeight:700,color:"var(--muted)",letterSpacing:"0.08em",textTransform:"uppercase" }}>{label}</span>
                  </div>
                  <p style={{ fontSize:14,color:"var(--text)",lineHeight:1.5,wordBreak:"break-all" }}>{value}</p>
                </div>
              ))}
              <div style={{ display:"flex",gap:10,marginTop:6 }}>
                <button onClick={()=>setStep("form")} style={{ flex:1,padding:"13px",background:"rgba(255,255,255,0.04)",border:"1px solid var(--border-bright)",borderRadius:13,color:"var(--muted)",fontSize:14,fontWeight:600,cursor:"pointer" }}>← Edit</button>
                <button onClick={handleSubmit} style={{ flex:2,padding:"13px",background:"linear-gradient(135deg,rgba(79,255,176,0.2),rgba(56,189,248,0.2))",border:"1px solid rgba(79,255,176,0.4)",borderRadius:13,color:"var(--accent)",fontSize:14,fontWeight:700,letterSpacing:"0.04em",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                  <CheckCircle2 size={15} /> Confirm Booking
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Text-mode Booking Dialog ─── */
function BookingDialog({ open, onSubmit, onCancel }: { open:boolean; onSubmit:(d:{name:string;email:string;purpose:string;additionalEmails:string[]})=>void; onCancel:()=>void }) {
  const [form, setForm] = useState({name:"",email:"",purpose:"",additionalEmails:[""]});
  const [emailError, setEmailError] = useState("");
  const [addEmailErrors, setAddEmailErrors] = useState<string[]>([""]);
  const [shakeEmail, setShakeEmail] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  if (!open) return null;

  const set = (k:keyof Omit<typeof form,"additionalEmails">,v:string) => { setForm(p=>({...p,[k]:v})); if(k==="email") setEmailError(""); };
  const emailValid = (e:string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
  const addAdditionalEmail = () => { setForm(p=>({...p,additionalEmails:[...p.additionalEmails,""]})); setAddEmailErrors(p=>[...p,""]); };
  const removeAdditionalEmail = (idx:number) => { setForm(p=>({...p,additionalEmails:p.additionalEmails.filter((_,i)=>i!==idx)})); setAddEmailErrors(p=>p.filter((_,i)=>i!==idx)); };
  const updateAdditionalEmail = (idx:number,val:string) => { setForm(p=>({...p,additionalEmails:p.additionalEmails.map((e,i)=>i===idx?val:e)})); setAddEmailErrors(p=>p.map((e,i)=>i===idx?"":e)); };
  const validAdditionalEmails = form.additionalEmails.filter(e=>e.trim()&&emailValid(e));

  const handleSubmit = (e:React.FormEvent) => {
    e.preventDefault();
    if (!form.name||!form.email||!form.purpose) return;
    if (!emailValid(form.email)) { setEmailError("Please enter a valid email address"); setShakeEmail(true); setTimeout(()=>setShakeEmail(false),500); return; }
    const errs = form.additionalEmails.map(e=>e.trim()&&!emailValid(e)?"Invalid email":"");
    if (errs.some(Boolean)) { setAddEmailErrors(errs); return; }
    onSubmit({...form,additionalEmails:validAdditionalEmails}); setForm({name:"",email:"",purpose:"",additionalEmails:[""]}); setAddEmailErrors([""]);
  };

  const inp:React.CSSProperties = { width:"100%",padding:"11px 14px 11px 42px",background:"rgba(255,255,255,0.04)",border:"1px solid var(--border-bright)",borderRadius:12,color:"var(--text)",fontSize:16,fontFamily:"'Space Grotesk',sans-serif" };
  const lbl:React.CSSProperties = { display:"block",fontSize:11,fontWeight:700,color:"var(--muted)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:7 };

  return (
    <>
      <div className="booking-overlay" style={{ position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(4,7,15,0.88)",backdropFilter:"blur(24px)",padding:"16px" }} onClick={()=>setShowConfirm(true)}>
        <div className="fade-in booking-card" style={{ width:"100%",maxWidth:500,background:"rgba(14,18,32,0.98)",backdropFilter:"blur(32px)",border:"1px solid var(--border-bright)",borderRadius:24,overflow:"hidden",boxShadow:"0 24px 80px rgba(0,0,0,0.75),0 0 0 1px rgba(56,189,248,0.06)",maxHeight:"92dvh",overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
          <div style={{ height:3,background:"linear-gradient(90deg,transparent,var(--accent2),var(--accent3),transparent)" }} />
          <div className="booking-inner" style={{ padding:"22px 22px 28px" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
              <div><h2 style={{ fontSize:19,fontWeight:800,marginBottom:3 }}>Book Appointment</h2><p style={{ fontSize:13,color:"var(--muted)" }}>Complete your details to confirm the slot</p></div>
              <button onClick={()=>setShowConfirm(true)} style={{ width:32,height:32,borderRadius:9,background:"rgba(255,255,255,0.05)",border:"1px solid var(--border)",color:"var(--muted)",display:"flex",alignItems:"center",justifyContent:"center" }}><X size={15}/></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display:"flex",flexDirection:"column",gap:16 }}>
              <div><label style={lbl}>Full Name *</label>
                <div style={{ position:"relative" }}>
                  <User size={15} style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"var(--muted)",pointerEvents:"none" }} />
                  <input type="text" value={form.name} placeholder="Dr. Jane Smith" required onChange={e=>set("name",e.target.value)} style={inp} autoComplete="name" />
                </div>
              </div>
              <div><label style={lbl}>Email *</label>
                <div className={shakeEmail?"shake":""} style={{ position:"relative" }}>
                  <Mail size={15} style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:emailError?"#ff5a6e":"var(--muted)",pointerEvents:"none" }} />
                  <input type="email" value={form.email} placeholder="jane@institute.org" required onChange={e=>set("email",e.target.value)} style={emailError?{...inp,borderColor:"rgba(255,90,110,0.6)"}:inp} autoComplete="email" inputMode="email" />
                </div>
                {emailError&&<div style={{ display:"flex",alignItems:"center",gap:5,marginTop:5 }}><AlertTriangle size={11} style={{ color:"#ff5a6e" }}/><span style={{ fontSize:11,color:"#ff5a6e" }}>{emailError}</span></div>}
              </div>
              <div>
                <label style={lbl}>Additional Attendees <span style={{ fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10 }}>(optional)</span></label>
                {form.additionalEmails.map((ae,idx)=>(
                  <div key={idx} style={{ marginBottom:8 }}>
                    <div style={{ position:"relative",display:"flex",alignItems:"center" }}>
                      <Mail size={15} style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"var(--muted)",pointerEvents:"none" }} />
                      <input type="email" value={ae} placeholder="attendee@example.com"
                        onChange={e=>updateAdditionalEmail(idx,e.target.value)}
                        style={{ ...inp,paddingRight:38,borderColor:addEmailErrors[idx]?"rgba(255,90,110,0.6)":undefined }}
                        inputMode="email" autoComplete="off" />
                      <button type="button" onClick={()=>removeAdditionalEmail(idx)}
                        style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--muted)",cursor:"pointer",display:"flex",alignItems:"center",padding:2 }}>
                        <X size={13}/>
                      </button>
                    </div>
                    {addEmailErrors[idx]&&<div style={{ display:"flex",alignItems:"center",gap:5,marginTop:4 }}><AlertTriangle size={11} style={{ color:"#ff5a6e" }}/><span style={{ fontSize:11,color:"#ff5a6e" }}>{addEmailErrors[idx]}</span></div>}
                  </div>
                ))}
                <button type="button" onClick={addAdditionalEmail}
                  style={{ display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--accent2)",background:"rgba(56,189,248,0.05)",border:"1px dashed rgba(56,189,248,0.28)",borderRadius:10,padding:"7px 14px",cursor:"pointer",width:"100%",justifyContent:"center",fontFamily:"'Space Grotesk',sans-serif" }}>
                  + Add Attendee
                </button>
              </div>
              <div><label style={lbl}>Meeting Purpose *</label>
                <div style={{ position:"relative" }}>
                  <FileText size={15} style={{ position:"absolute",left:14,top:14,color:"var(--muted)",pointerEvents:"none" }} />
                  <textarea rows={3} value={form.purpose} placeholder="Describe the purpose…" required onChange={e=>set("purpose",e.target.value)} style={{ ...inp,resize:"none",lineHeight:1.6 }} />
                </div>
              </div>
              <div style={{ display:"flex",gap:10,marginTop:4 }}>
                <button type="button" onClick={()=>setShowConfirm(true)} style={{ flex:1,padding:"13px",background:"rgba(255,255,255,0.04)",border:"1px solid var(--border-bright)",borderRadius:13,color:"var(--muted)",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}><X size={14}/> Cancel</button>
                <button type="submit" style={{ flex:2,padding:"13px",background:"linear-gradient(135deg,rgba(56,189,248,0.18),rgba(124,58,237,0.18))",border:"1px solid rgba(56,189,248,0.33)",borderRadius:13,color:"var(--accent2)",fontSize:14,fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}><CheckCircle2 size={15}/> Confirm →</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {showConfirm&&(
        <div style={{ position:"fixed",inset:0,zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(4,7,15,0.5)",backdropFilter:"blur(12px)" }} onClick={()=>setShowConfirm(false)}>
          <div className="fade-in" style={{ width:"88%",maxWidth:360,padding:"26px 24px",background:"rgba(18,21,34,0.96)",border:"1px solid rgba(255,90,110,0.3)",borderRadius:22,boxShadow:"0 24px 64px rgba(0,0,0,0.7)",textAlign:"center" }} onClick={e=>e.stopPropagation()}>
            <AlertTriangle size={28} style={{ color:"#ffb432",marginBottom:10 }} />
            <h3 style={{ fontSize:17,fontWeight:800,marginBottom:8 }}>Cancel Booking?</h3>
            <p style={{ fontSize:13,color:"var(--muted)",lineHeight:1.55,marginBottom:22 }}>Your booking details will be lost.</p>
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              <button onClick={()=>{setShowConfirm(false);setForm({name:"",email:"",purpose:"",additionalEmails:[""]});setAddEmailErrors([""]);onCancel();}} style={{ padding:"11px",borderRadius:12,fontSize:13,fontWeight:700,background:"rgba(255,90,110,0.12)",border:"1px solid rgba(255,90,110,0.3)",color:"#ff4d6d",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}><PhoneOff size={14}/> Yes, Cancel</button>
              <button onClick={()=>setShowConfirm(false)} style={{ padding:"11px",borderRadius:12,fontSize:13,fontWeight:700,background:"rgba(255,255,255,0.04)",border:"1px solid var(--border-bright)",color:"var(--text)",cursor:"pointer" }}>Continue Booking</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════ */
export default function ChatPage() {
  const [mode, setMode] = useState<Mode>("text");
  const [messages, setMessages] = useState<Msg[]>([{
    id:"0",sender:"ai",type:"text",time:nowTime(),
    text:"Hello — I'm Ava, your intelligent life-science booking and inquiry agent. Switch to 📞 Call mode for a live hands-free conversation, or chat here. How may I assist you today?",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [voiceBooking, setVoiceBooking] = useState(false);

  const [callActive, setCallActive] = useState(false);
  const [callState, setCallStateVal] = useState<CallState>("idle");
  const [callSeconds, setCallSeconds] = useState(0);
  const [statusText, setStatusText] = useState("tap orb to start call");
  const [notice, setNotice] = useState("");
  const [tick, setTick] = useState(0);
  const SILENCE_DELAY = 2;
  const [silenceCountdown, setSilenceCountdown] = useState(0);
  const [callPhase, setCallPhase] = useState<"idle"|"requesting"|"active">("idle");
  const [voiceInput, setVoiceInput] = useState("");

  const sessionIdRef = useRef(`session-${Date.now()}`);
  const sessionStateRef = useRef<SessionState|null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const pendingTextRef = useRef("");
  const callActiveRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isListeningRef = useRef(false);
  const modeRef = useRef<Mode>("text");
  const ttsRef = useRef<ElevenLabsTTS|null>(null);
  const voiceBookingRef = useRef(false);
  const endCallRef = useRef<(()=>void)|null>(null);

  function getTTS(): ElevenLabsTTS {
    if (!ttsRef.current) ttsRef.current = new ElevenLabsTTS();
    return ttsRef.current;
  }

  useEffect(()=>{ callActiveRef.current=callActive; },[callActive]);
  useEffect(()=>{ modeRef.current=mode; },[mode]);
  useEffect(()=>{ voiceBookingRef.current=voiceBooking; },[voiceBooking]);

  /* ══════════════════════════════════════════════════
     TAB VISIBILITY & PAGE HIDE
     Ends the call when:
     - User switches browser tabs
     - User locks phone / backgrounds the browser
     - User navigates away / closes the tab
     Uses document.visibilitychange + window.pagehide.
  ══════════════════════════════════════════════════ */
  useEffect(()=>{
    const onVisibility = () => {
      if (document.hidden && callActiveRef.current) {
        console.log("[Call] Tab hidden — ending call");
        endCallRef.current?.();
      }
    };
    const onPageHide = () => {
      if (callActiveRef.current) endCallRef.current?.();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return ()=>{
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  },[]);

  // Animation tick
  useEffect(()=>{ const t=setInterval(()=>setTick(n=>n+1),50); return()=>clearInterval(t); },[]);

  // Auto-scroll
  useEffect(()=>{
    if (messagesRef.current) messagesRef.current.scrollTop=messagesRef.current.scrollHeight;
  },[messages,loading]);

  const setCallState = useCallback((s:CallState)=>{
    setCallStateVal(s);
    setStatusText({
      idle:"tap orb to start call",
      listening:"● listening…",
      processing:"◌ thinking…",
      speaking:"▶ speaking — tap mic to interrupt",
    }[s]);
  },[]);

  const addMsg = useCallback((sender:"ai"|"user", text:string)=>{
    setMessages(p=>[...p,{id:`${Date.now()}-${Math.random()}`,sender,type:"text",text,time:nowTime()}]);
  },[]);

  const showNotice = useCallback((text:string,duration=6000)=>{
    setNotice(text); setTimeout(()=>setNotice(""),duration);
  },[]);

  const checkShowForm = useCallback((data:any, ns:SessionState|null)=>{
    const txt = typeof data.response==="string" ? data.response : (data.response?.text as string)||"";
    const trigger = data.showForm===true || ns?.showForm===true
      || txt.toLowerCase().includes("booking form") || txt.toLowerCase().includes("finalize your booking");
    if (!trigger) return;
    if (modeRef.current==="text") setBooking(true);
    else setVoiceBooking(true);
  },[]);

  const stopListening = useCallback(()=>{
    isListeningRef.current=false;
    try { recognitionRef.current?.abort(); } catch { /**/ }
    recognitionRef.current=null;
    if (silenceTimerRef.current) { clearInterval(silenceTimerRef.current); silenceTimerRef.current=null; }
    setSilenceCountdown(0);
    pendingTextRef.current="";
  },[]);

  const ttsSpeak = useCallback((text:string, onDone?:()=>void)=>{
    stopListening();
    isSpeakingRef.current=true;
    setCallState("speaking");
    console.log("[TTS] Attempting to speak:", text.slice(0, 50) + "...");
    getTTS().speak(cleanTextForSpeech(text),()=>{
      console.log("[TTS] Speech completed");
      isSpeakingRef.current=false;
      onDone?.();
    });
  },[setCallState,stopListening]);

  const ttsStop = useCallback(()=>{
    isSpeakingRef.current=false;
    getTTS().stop();
  },[]);

  /* ══════════════════════════════════════════════════
     INTERRUPTION — called when user taps the Mic button
     while AI is speaking.
     1. ttsStop() kills the AudioBufferSourceNode instantly.
        The onended guard (running=false) prevents onDone firing.
     2. isSpeakingRef set to false.
     3. startListening() begins after 100ms audio drain.
  ══════════════════════════════════════════════════ */
  const interruptAndListen = useCallback(()=>{
    if (!callActiveRef.current) return;
    ttsStop();
    isSpeakingRef.current=false;
    setTimeout(()=>{
      if (callActiveRef.current) startListening();
    },100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ttsStop]);

  const startListening = useCallback(()=>{
    if (!callActiveRef.current) return;
    if (isSpeakingRef.current) return;
    if (isListeningRef.current) return;
    if (voiceBookingRef.current) return;

    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if (!SR) { showNotice("Speech recognition not supported. Try Chrome on Android or Safari on iOS 17+."); return; }

    setCallState("listening");
    isListeningRef.current=true;
    try { recognitionRef.current?.abort(); } catch { /**/ }

    const rec=new SR();
    rec.continuous=false; rec.interimResults=true; rec.lang="en-US"; rec.maxAlternatives=1;
    recognitionRef.current=rec;
    let finalText="";

    rec.onstart=()=>{ finalText=""; };
    rec.onresult=(e:any)=>{
      finalText=""; let interim="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal) finalText+=e.results[i][0].transcript;
        else interim+=e.results[i][0].transcript;
      }
      if(interim||finalText){ const p=(interim||finalText).slice(0,40); setStatusText("🎤 "+p+(p.length>=40?"…":"")); }
    };
    rec.onend=()=>{
      isListeningRef.current=false;
      if(!callActiveRef.current||isSpeakingRef.current||voiceBookingRef.current) return;
      const norm=finalText.trim()?normalizeSpeech(finalText.trim()):"";
      if(norm){
        pendingTextRef.current=norm;
        let rem=SILENCE_DELAY; setSilenceCountdown(rem);
        silenceTimerRef.current=setInterval(()=>{
          rem--; setSilenceCountdown(rem);
          if(rem<=0){
            clearInterval(silenceTimerRef.current!); silenceTimerRef.current=null; setSilenceCountdown(0);
            const t=pendingTextRef.current.trim(); pendingTextRef.current="";
            if(t&&callActiveRef.current){ addMsg("user",t); setCallState("processing"); sendVoiceMessage(t); }
            else if(callActiveRef.current) startListening();
          }
        },1000);
      } else {
        setTimeout(()=>{ if(callActiveRef.current&&!isSpeakingRef.current&&!voiceBookingRef.current) startListening(); },400);
      }
    };
    rec.onerror=(e:any)=>{
      isListeningRef.current=false;
      if(!callActiveRef.current) return;
      if(e.error==="not-allowed"||e.error==="service-not-allowed"){ showNotice("🎤 Microphone denied. Allow in browser settings and reload."); return; }
      if(e.error==="no-speech"){ setTimeout(()=>{ if(callActiveRef.current&&!isSpeakingRef.current&&!voiceBookingRef.current) startListening(); },300); return; }
      if(e.error==="aborted") return;
      setTimeout(()=>{ if(callActiveRef.current&&!isSpeakingRef.current&&!voiceBookingRef.current) startListening(); },1000);
    };
    setTimeout(()=>{
      if(!callActiveRef.current||isSpeakingRef.current||voiceBookingRef.current){ isListeningRef.current=false; return; }
      try { rec.start(); } catch(err:any){ isListeningRef.current=false; setTimeout(()=>{ if(callActiveRef.current&&!isSpeakingRef.current&&!voiceBookingRef.current) startListening(); },600); }
    },150);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[setCallState,showNotice,addMsg]);

  const sendVoiceMessage = useCallback(async(text:string)=>{
    setLoading(true);
    try {
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text,sessionId:sessionIdRef.current,sessionState:sessionStateRef.current})});
      if(!res.ok) throw new Error(res.statusText);
      const data=await res.json();
      const ns:SessionState|null=data.sessionState?(typeof data.sessionState==="string"?JSON.parse(data.sessionState):data.sessionState):null;
      if(ns) sessionStateRef.current=ns;
      checkShowForm(data,ns);
      const resObj=data.response;
      let txt=data.audioUrl?(data.text||""):(typeof resObj==="string"?resObj:(resObj?.text as string)||"");
      if(ns?.pendingMatchedEvents&&Array.isArray(ns.pendingMatchedEvents)&&(ns.pendingMatchedEvents as any[]).length>0){
        txt+="\n\n"+(ns.pendingMatchedEvents as any[]).map((ev:any,i:number)=>{
          const d=new Date(ev.start);
          return `${i+1}. ${ev.summary} – ${d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",hour:"numeric",minute:"2-digit",hour12:true})}`;
        }).join("\n");
      }
      const display=txt||"I could not process that. Please try again.";
      addMsg("ai",display);
      if(callActiveRef.current&&!voiceBookingRef.current){
        ttsSpeak(display,()=>{ setTimeout(()=>{ if(callActiveRef.current&&!voiceBookingRef.current) startListening(); },400); });
      }
    } catch(err){
      console.error("[API]",err);
      const msg="Connection error. Please try again.";
      addMsg("ai",msg);
      if(callActiveRef.current&&!voiceBookingRef.current){
        ttsSpeak(msg,()=>{ setTimeout(()=>{ if(callActiveRef.current&&!voiceBookingRef.current) startListening(); },400); });
      }
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addMsg,checkShowForm,ttsSpeak,startListening]);

  const sendToAPI = useCallback(async(text:string)=>{
    setLoading(true);
    try {
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text,sessionId:sessionIdRef.current,sessionState:sessionStateRef.current})});
      if(!res.ok) throw new Error(res.statusText);
      const data=await res.json();
      const ns:SessionState|null=data.sessionState?(typeof data.sessionState==="string"?JSON.parse(data.sessionState):data.sessionState):null;
      if(ns) sessionStateRef.current=ns;
      checkShowForm(data,ns);
      const resObj=data.response;
      let txt=data.audioUrl?(data.text||""):(typeof resObj==="string"?resObj:(resObj?.text as string)||"");
      if(ns?.pendingMatchedEvents&&Array.isArray(ns.pendingMatchedEvents)&&(ns.pendingMatchedEvents as any[]).length>0){
        txt+="\n\n"+(ns.pendingMatchedEvents as any[]).map((ev:any,i:number)=>{ const d=new Date(ev.start); return `${i+1}. ${ev.summary} – ${d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",hour:"numeric",minute:"2-digit",hour12:true})}`; }).join("\n");
      }
      addMsg("ai",txt||"I could not process that. Please try again.");
    } catch(err){ console.error("[API]",err); addMsg("ai","Connection error. Please try again."); }
    finally { setLoading(false); }
  },[addMsg,checkShowForm]);

  const sendTextMsg = useCallback(async(overrideText?:string)=>{
    const t=(overrideText??input).trim();
    if(!t||loading) return;
    addMsg("user",t);
    if(!overrideText) setInput("");
    await sendToAPI(t);
  },[input,loading,addMsg,sendToAPI]);

  const sendVoiceTextMsg = useCallback(async()=>{
    const t=voiceInput.trim();
    if(!t||loading) return;
    setVoiceInput("");
    stopListening();
    ttsStop();
    addMsg("user",t);
    setCallState("processing");
    await sendVoiceMessage(t);
  },[voiceInput,loading,stopListening,ttsStop,addMsg,setCallState,sendVoiceMessage]);

  const endCall = useCallback(()=>{
    callActiveRef.current=false;
    setCallActive(false);
    setCallPhase("idle");
    setCallState("idle");
    stopListening();
    ttsStop();
    setVoiceBooking(false);
    setVoiceInput("");
    clearInterval(callTimerRef.current!);
    setCallSeconds(0);
    addMsg("ai","📵 Call ended.");
  },[addMsg,setCallState,stopListening,ttsStop]);

  useEffect(()=>{ endCallRef.current=endCall; },[endCall]);

  const startCall = useCallback(async ()=>{
    if(callPhase!=="idle") return;
    setCallPhase("requesting");
    setCallState("idle");
    setStatusText("requesting mic…");
    
    // Unlock audio context first (required for mobile)
    await getTTS().unlockAudio();

    navigator.mediaDevices.getUserMedia({
        audio:{
          noiseSuppression:true,
          echoCancellation:true,
          autoGainControl:true,
          channelCount:1,
          sampleRate:16000,
        },
        video:false,
      })
      .then(()=>{
        callActiveRef.current=true;
        setCallActive(true); setCallPhase("active"); setCallSeconds(0);
        clearInterval(callTimerRef.current!);
        callTimerRef.current=setInterval(()=>setCallSeconds(s=>s+1),1000);
        addMsg("ai","📞 Call connected!");
        ttsSpeak("Hello! I'm ready. How can I help you today?",()=>{
          setTimeout(()=>{ if(callActiveRef.current) startListening(); },400);
        });
      })
      .catch(err=>{
        console.warn("[mic]",err);
        setCallPhase("idle"); setCallState("idle"); setStatusText("tap orb to start call");
        if(err.name==="NotAllowedError"||err.name==="PermissionDeniedError") showNotice("🎤 Microphone denied. Go to browser Settings → allow Microphone, then try again.");
        else if(err.name==="NotFoundError") showNotice("🎤 No microphone found.");
        else showNotice("🎤 Could not access microphone: "+(err.message||err.name));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[callPhase,setCallState,addMsg,ttsSpeak,startListening,showNotice]);

  const switchMode=(m:Mode)=>{ if(m==="text"&&callActive) endCall(); setMode(m); };

  const handleVoiceBookingSubmit=useCallback((d:{name:string;email:string;purpose:string;additionalEmails:string[]})=>{
    setVoiceBooking(false);
    const addLine=d.additionalEmails.length>0?`\nAdditional attendees: ${d.additionalEmails.join(", ")}`:"";
    const msg=`Name: ${d.name}\nEmail: ${d.email}${addLine}\nPurpose: ${d.purpose}`;
    addMsg("user",msg);
    sendVoiceMessage(msg);
  },[addMsg,sendVoiceMessage]);

  const handleVoiceBookingCancel=useCallback(()=>{
    setVoiceBooking(false);
    setTimeout(()=>{ if(callActiveRef.current&&!isSpeakingRef.current) startListening(); },400);
  },[startListening]);

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <Background />
      <div className="chat-root" style={{ position:"relative",zIndex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>

        {/* HEADER */}
        <header style={{ flexShrink:0,position:"relative",height:58,borderBottom:"1px solid var(--border)",background:"rgba(8,11,20,0.76)",backdropFilter:"blur(30px)",display:"flex",alignItems:"center",justifyContent:"space-between",paddingLeft:"max(12px,env(safe-area-inset-left))",paddingRight:"max(12px,env(safe-area-inset-right))" }}>
          <div style={{ position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent 5%,rgba(56,189,248,0.22) 50%,transparent 95%)" }} />
          <div style={{ display:"flex",alignItems:"center",gap:8,minWidth:0 }}>
            <Link href="/" style={{ textDecoration:"none",flexShrink:0 }}>
              <button style={{ width:34,height:34,borderRadius:10,background:"rgba(255,255,255,0.05)",border:"1px solid var(--border-bright)",color:"var(--muted)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <ChevronLeft size={17} />
              </button>
            </Link>
            <div style={{ width:1,height:22,background:"var(--border-bright)",flexShrink:0 }} />
            <div style={{ display:"flex",alignItems:"center",gap:8,minWidth:0,overflow:"hidden" }}>
              <div style={{ width:34,height:34,borderRadius:10,overflow:"hidden",flexShrink:0,border:"1px solid rgba(56,189,248,0.2)",position:"relative" }}>
                <Image src="/logo.png" alt="AI" width={34} height={34} style={{ objectFit:"contain",width:"100%",height:"100%" }} priority />
                {callActive&&<div style={{ position:"absolute",inset:-3,borderRadius:12,background:"linear-gradient(135deg,var(--accent2),var(--accent3))",zIndex:-1,animation:"ring-pulse 2.5s ease-in-out infinite" }} />}
              </div>
              <div style={{ minWidth:0 }}>
                <div className="header-name" style={{ fontSize:15,fontWeight:700,letterSpacing:"-0.02em",background:"linear-gradient(90deg,var(--accent2),var(--accent3))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>Life Science AI</div>
                <div style={{ display:"flex",alignItems:"center",gap:5,marginTop:1 }}>
                  <div style={{ width:5,height:5,borderRadius:"50%",background:"var(--accent)",boxShadow:"0 0 5px var(--accent)",animation:"blink 2s ease-in-out infinite",flexShrink:0 }} />
                  <span style={{ fontSize:9,color:"var(--muted)",fontFamily:"'DM Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap" }}>
                    {loading?"processing…":callState==="listening"?"listening…":callState==="speaking"?"speaking…":"ready"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:8,flexShrink:0 }}>
            <div style={{ display:"flex",gap:3,background:"rgba(255,255,255,0.05)",border:"1px solid var(--border)",borderRadius:12,padding:3 }}>
              {(["text","voice"] as Mode[]).map(m=>(
                <button key={m} className="mode-btn" onClick={()=>switchMode(m)} style={{ padding:"5px 12px",borderRadius:9,fontSize:12,fontWeight:600,border:"none",cursor:"pointer",transition:"all 0.2s",background:mode===m?"rgba(255,255,255,0.13)":"transparent",color:mode===m?"var(--text)":"var(--muted)",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5 }}>
                  {m==="text"?<MessageSquare size={13}/>:<Phone size={13}/>}
                  <span>{m==="text"?"Chat":"Call"}</span>
                </button>
              ))}
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:999,background:"rgba(79,255,176,0.06)",border:"1px solid rgba(79,255,176,0.15)",flexShrink:0 }}>
              <Wifi size={11} style={{ color:"var(--accent)" }} />
              <span className="online-dot-label" style={{ fontSize:10,color:"rgba(79,255,176,0.8)",fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap" }}>Online</span>
            </div>
          </div>
        </header>
        {/* MESSAGES */}
        <div ref={messagesRef} className="scroller messages-area" style={{ flex:1,overflowY:"auto",padding:"20px 16px 12px",display:"flex",flexDirection:"column",gap:14,WebkitOverflowScrolling:"touch" as any }}>
          {messages.map(msg=>(
            <div key={msg.id} className="msg-in" style={{ display:"flex",alignItems:"flex-end",gap:8,flexDirection:msg.sender==="user"?"row-reverse":"row" }}>
              <div style={{ width:30,height:30,borderRadius:"50%",flexShrink:0,overflow:"hidden",border:msg.sender==="ai"?"1px solid rgba(56,189,248,0.22)":"1px solid rgba(79,255,176,0.22)",background:msg.sender==="ai"?"rgba(8,11,20,0.8)":"linear-gradient(135deg,rgba(79,255,176,0.15),rgba(56,189,248,0.15))",display:"flex",alignItems:"center",justifyContent:"center" }}>
                {msg.sender==="ai"?<Image src="/logo.png" alt="AI" width={30} height={30} style={{ width:"100%",height:"100%",objectFit:"contain" }} />:<User size={14} style={{ color:"var(--accent)" }} />}
              </div>
              <div className="msg-bubble" style={{ display:"flex",flexDirection:"column",alignItems:msg.sender==="user"?"flex-end":"flex-start",maxWidth:"75%" }}>
                <div className="msg-text" style={{ padding:"11px 15px",fontSize:14,lineHeight:1.65,wordBreak:"break-word",overflowWrap:"anywhere",borderRadius:msg.sender==="ai"?"5px 18px 18px 18px":"18px 5px 18px 18px",background:msg.sender==="ai"?"rgba(79,255,176,0.07)":"linear-gradient(135deg,rgba(56,189,248,0.14),rgba(100,40,200,0.14))",border:msg.sender==="ai"?"1px solid rgba(79,255,176,0.13)":"1px solid rgba(56,189,248,0.18)",backdropFilter:"blur(16px)" }}>
                  {msg.text.split("\n").map((line,i,arr)=><span key={i}>{line}{i<arr.length-1&&<br/>}</span>)}
                </div>
                <div style={{ fontSize:10,color:"var(--muted)",marginTop:3,fontFamily:"'DM Mono',monospace",opacity:0.65,paddingLeft:msg.sender==="user"?0:3,paddingRight:msg.sender==="user"?3:0 }}>{msg.time}</div>
              </div>
            </div>
          ))}
          {loading&&<TypingDots/>}
          <div style={{ height:4 }} />
        </div>
        {/* NOTICE */}
        {notice&&(
          <div style={{ padding:"7px 16px",background:"rgba(255,180,50,0.06)",border:"1px solid rgba(255,180,50,0.15)",borderRadius:10,fontSize:12,color:"rgba(255,180,50,0.8)",textAlign:"center",margin:"0 16px 6px",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
            <AlertTriangle size={12}/>{notice}
          </div>
        )}        
        {mode==="text"&&(
          <footer className="text-footer" style={{ flexShrink:0,padding:"12px 16px 16px",borderTop:"1px solid var(--border)",background:"rgba(8,11,20,0.78)",backdropFilter:"blur(30px)",paddingBottom:"max(16px,env(safe-area-inset-bottom))" }}>
            <div style={{ height:1,background:"linear-gradient(90deg,transparent 8%,rgba(56,189,248,0.12) 50%,transparent 92%)",marginBottom:12 }} />
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              <input value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendTextMsg(); } }}
                placeholder="Ask about life science inquiries…"
                style={{ flex:1,height:48,padding:"0 16px",background:"rgba(255,255,255,0.05)",border:"1.5px solid var(--border-bright)",borderRadius:14,color:"var(--text)",fontSize:16,fontFamily:"'Space Grotesk',sans-serif" }}
                enterKeyHint="send" />
              <button onClick={()=>sendTextMsg()} disabled={!input.trim()||loading}
                style={{ width:44,height:44,borderRadius:"50%",flexShrink:0,border:"1px solid rgba(56,189,248,0.22)",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.18s",background:input.trim()&&!loading?"linear-gradient(135deg,var(--accent2),var(--accent3))":"rgba(255,255,255,0.04)",color:input.trim()&&!loading?"#080b14":"var(--muted)",cursor:input.trim()&&!loading?"pointer":"not-allowed",touchAction:"manipulation" }}>
                {loading?<Loader2 size={17} style={{ animation:"orb-spin 1s linear infinite" }}/>:<ArrowUp size={17}/>}
              </button>
            </div>
            <div style={{ display:"flex",justifyContent:"flex-end",marginTop:6 }}>
              <span style={{ fontSize:10,fontFamily:"'DM Mono',monospace",color:loading?"var(--accent2)":"var(--muted)",letterSpacing:"0.05em",animation:loading?"blink 1s ease infinite":"none" }}>{loading?"● processing…":"○ ready"}</span>
            </div>
          </footer>
        )}

        {/* VOICE CALL PANEL */}
        {mode==="voice"&&(
          <div className="voice-panel" style={{ flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",padding:callActive?"8px 16px 12px":"14px 16px 18px",gap:callActive?6:12,borderTop:"1px solid var(--border)",background:"rgba(8,11,20,0.78)",backdropFilter:"blur(30px)",paddingBottom:`max(${callActive?12:18}px,env(safe-area-inset-bottom))`,transition:"padding 0.3s ease,gap 0.3s ease" }}>

            <div className="call-timer" style={{ fontFamily:"'DM Mono',monospace",fontSize:callActive?12:20,fontWeight:500,letterSpacing:"0.08em",color:callActive?"rgba(255,255,255,0.7)":"var(--muted)",transition:"font-size 0.3s ease" }}>{fmtSecs(callSeconds)}</div>

            <Orb callState={callActive?callState:"idle"} size={callActive?72:120} onTap={()=>{ if(callPhase==="idle") startCall(); else if(callPhase==="active") endCall(); }} />

            <LiveBars callState={callActive?callState:"idle"} tick={tick} compact={callActive} />

            {silenceCountdown>0
              ? <SilenceCountdown seconds={silenceCountdown} total={SILENCE_DELAY}/>
              : (
                <div style={{ fontSize:callActive?10:12,fontFamily:"'DM Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",textAlign:"center",color:callPhase==="requesting"?"#ffb432":callState==="listening"?"var(--accent)":callState==="speaking"?"var(--accent3)":callState==="processing"?"#ffb432":"var(--muted)",transition:"font-size 0.3s ease" }}>
                  {statusText}
                </div>
              )
            }

            {/* Action buttons */}
            {callActive&&(
              <div style={{ display:"flex",alignItems:"center",gap:10,marginTop:0 }}>

                {/* Interrupt button — visible while AI speaks */}
                {callState==="speaking"&&(
                  <button className="interrupt-btn" onClick={interruptAndListen}
                    onTouchEnd={e=>{e.preventDefault();interruptAndListen();}}
                    title="Interrupt — tap to speak"
                    style={{ width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,rgba(79,255,176,0.18),rgba(56,189,248,0.14))",border:"1.5px solid rgba(79,255,176,0.55)",color:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation",boxShadow:"0 0 16px rgba(79,255,176,0.22)" }}>
                    <Mic size={15}/>
                  </button>
                )}

                {/* Listening indicator */}
                {callState==="listening"&&(
                  <div style={{ width:36,height:36,borderRadius:"50%",background:"rgba(79,255,176,0.08)",border:"1.5px solid rgba(79,255,176,0.35)",color:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",animation:"orb-idle 2s ease-in-out infinite" }}>
                    <Mic size={15}/>
                  </div>
                )}

                {/* Processing indicator */}
                {callState==="processing"&&(
                  <div style={{ width:36,height:36,borderRadius:"50%",background:"rgba(255,180,50,0.08)",border:"1.5px solid rgba(255,180,50,0.3)",color:"#ffb432",display:"flex",alignItems:"center",justifyContent:"center" }}>
                    <Loader2 size={15} style={{ animation:"orb-spin 1s linear infinite" }}/>
                  </div>
                )}

                {/* End call */}
                <button onClick={endCall} style={{ width:36,height:36,borderRadius:"50%",background:"rgba(255,90,110,0.12)",border:"1.5px solid rgba(255,90,110,0.35)",color:"var(--danger)",display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation" }}>
                  <PhoneOff size={15}/>
                </button>
              </div>
            )}

            {callPhase==="idle"&&(
              <p style={{ fontSize:11,color:"var(--muted)",textAlign:"center",fontFamily:"'DM Mono',monospace",letterSpacing:"0.04em",opacity:0.7,maxWidth:280 }}>
                Tap orb → allow microphone → AI speaks, then listens
              </p>
            )}
            {callPhase==="requesting"&&(
              <p style={{ fontSize:11,color:"#ffb432",textAlign:"center",fontFamily:"'DM Mono',monospace",opacity:0.9,display:"flex",alignItems:"center",gap:5,justifyContent:"center" }}>
                <MicOff size={12}/> Allow microphone access when prompted…
              </p>
            )}

            {/* ── TYPE DURING CALL ── */}
            {callActive&&(
              <div style={{ width:"100%",marginTop:2,animation:"slide-up 0.25s ease" }}>
                <div style={{ height:"1px",background:"linear-gradient(90deg,transparent,rgba(167,139,250,0.18),transparent)",marginBottom:8 }} />
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  <div style={{ flex:1,position:"relative",display:"flex",alignItems:"center" }}>
                    <input
                      value={voiceInput}
                      onChange={e=>setVoiceInput(e.target.value)}
                      onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendVoiceTextMsg(); } }}
                      onFocus={()=>stopListening()}
                      placeholder="Type a message during call…"
                      disabled={loading}
                      enterKeyHint="send"
                      style={{ width:"100%",height:40,padding:"0 36px 0 12px",background:"rgba(167,139,250,0.06)",border:"1.5px solid rgba(167,139,250,0.22)",borderRadius:12,color:"var(--text)",fontSize:13,fontFamily:"'Space Grotesk',sans-serif",outline:"none",transition:"border-color 0.2s",backdropFilter:"blur(12px)" }}
                    />
                    {voiceInput&&(
                      <button
                        onClick={()=>setVoiceInput("")}
                        style={{ position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--muted)",cursor:"pointer",display:"flex",alignItems:"center",padding:2 }}>
                        <X size={11}/>
                      </button>
                    )}
                  </div>
                  <button
                    onClick={sendVoiceTextMsg}
                    disabled={!voiceInput.trim()||loading}
                    style={{ width:40,height:40,borderRadius:"50%",flexShrink:0,border:voiceInput.trim()&&!loading?"1px solid rgba(167,139,250,0.5)":"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.18s",background:voiceInput.trim()&&!loading?"linear-gradient(135deg,var(--accent3),var(--accent2))":"rgba(255,255,255,0.04)",color:voiceInput.trim()&&!loading?"#080b14":"var(--muted)",cursor:voiceInput.trim()&&!loading?"pointer":"not-allowed",touchAction:"manipulation",boxShadow:voiceInput.trim()&&!loading?"0 0 14px rgba(167,139,250,0.3)":"none" }}>
                    {loading?<Loader2 size={14} style={{ animation:"orb-spin 1s linear infinite" }}/>:<ArrowUp size={14}/>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Text-mode booking */}
      <BookingDialog
        open={booking&&mode==="text"}
        onSubmit={d=>{ setBooking(false); const addLine=d.additionalEmails.length>0?`\nAdditional attendees: ${d.additionalEmails.join(", ")}`:""; sendTextMsg(`Name: ${d.name}\nEmail: ${d.email}${addLine}\nPurpose: ${d.purpose}`); }}
        onCancel={()=>{ setBooking(false); sendTextMsg("I don't want to book for now"); }}
      />

      {/* Voice-mode booking */}
      <VoiceBookingDialog
        open={voiceBooking}
        onSubmit={handleVoiceBookingSubmit}
        onCancel={handleVoiceBookingCancel}
      />
    </>
  );
}