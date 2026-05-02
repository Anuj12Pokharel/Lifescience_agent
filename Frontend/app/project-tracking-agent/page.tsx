"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { getAccessToken } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type MsgSender = "ai" | "user";
type MsgKind = "text" | "system";

interface ActionMeta {
  action?: string | null;
  project?: string | null;
  task?: string | null;
  new_status?: string | null;
  actor?: string | null;
  log_id?: string | null;
  available_projects?: Array<{ key: string; name: string; id: string; url: string }>;
}

interface Msg {
  id: string;
  sender: MsgSender;
  kind: MsgKind;
  text: string;
  time: string;
  meta?: ActionMeta;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

const QUICK_PROMPTS = [
  "Show project status overview",
  "List all blocked tasks",
  "Who has the most tasks?",
  "Show overdue items",
  "Create a new task",
  "Show my reminders",
];

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
  }

  html, body { height: 100%; background: var(--bg); color: var(--text); font-family: 'Syne', sans-serif; overflow: hidden; }

  /* scrollbar */
  .scroller { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.07) transparent; }
  .scroller::-webkit-scrollbar { width: 3px; }
  .scroller::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }

  /* keyframes */
  @keyframes grid-pan { from { background-position: 0 0; } to { background-position: 44px 44px; } }
  @keyframes pulse-slow { 0%,100%{opacity:0.5} 50%{opacity:1} }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes msg-pop { from{opacity:0;transform:translateY(14px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes dot { 0%,80%,100%{transform:translateY(0);opacity:0.3} 40%{transform:translateY(-4px);opacity:1} }
  @keyframes glow-line { 0%,100%{opacity:0.4} 50%{opacity:1} }
  @keyframes tag-in { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
  @keyframes shimmer { from{background-position:-200% 0} to{background-position:200% 0} }

  .msg-pop { animation: msg-pop 0.28s cubic-bezier(0.34,1.4,0.64,1) both; }
  .tag-in { animation: tag-in 0.2s ease both; }

  button { cursor: pointer; border: none; background: none; font-family: 'Syne', sans-serif; }
  input, textarea { font-family: 'Syne', sans-serif; font-size: 16px !important; }
  input:focus, textarea:focus { outline: none; }
  * { -webkit-tap-highlight-color: transparent; }

  @media (max-width: 600px) {
    .msg-bubble { max-width: 87% !important; }
    .msg-text  { font-size: 13px !important; padding: 10px 13px !important; }
    .quick-pills { display: none !important; }
  }
`;

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

function GridBg() {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:0,pointerEvents:"none" }}>
      {/* animated grid */}
      <div style={{
        position:"absolute",inset:0,
        backgroundImage:"linear-gradient(rgba(0,229,255,0.028) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,0.028) 1px,transparent 1px)",
        backgroundSize:"44px 44px",
        animation:"grid-pan 8s linear infinite",
      }} />
      {/* radial blobs */}
      <div style={{ position:"absolute",width:700,height:700,top:-200,right:-200,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,229,255,0.06),transparent 65%)",filter:"blur(60px)" }} />
      <div style={{ position:"absolute",width:600,height:600,bottom:-180,left:-150,borderRadius:"50%",background:"radial-gradient(circle,rgba(155,109,255,0.07),transparent 65%)",filter:"blur(60px)" }} />
      {/* vignette */}
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

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function ProjectTrackerPage() {
  const { user } = useAuth();
  const sessionId = useRef(`session_web_${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<Msg[]>([{
    id: uid(), sender:"ai", kind:"text", time: nowTime(),
    text:"👋 Hello! I'm your **Project Tracking Agent**. I can help you:\n\n• Check project & task status\n• Update task progress\n• Assign & create tasks\n• Set reminders & escalations\n• View team workload\n• Search & filter tasks\n\nWhat would you like to do?",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle"|"connected"|"error">("idle");

  // Session state echoed back to N8N on each request
  const lastProjectKeyRef = useRef<string | null>(null);
  const lastProjectNameRef = useRef<string | null>(null);
  const availableProjectsRef = useRef<Array<{ key: string; name: string; id: string; url: string }>>([]);

  // Conversation history for context (excludes welcome message)
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  // auto-scroll
  useEffect(()=>{
    messagesEndRef.current?.scrollIntoView({ behavior:"smooth" });
  },[messages, loading]);

  const addMsg = useCallback((sender: MsgSender, text: string, meta?: ActionMeta, kind: MsgKind = "text") => {
    setMessages(prev => [...prev, { id:uid(), sender, kind, text, time:nowTime(), meta }]);
  },[]);

  const send = useCallback(async (overrideText?: string) => {
    const t = (overrideText ?? input).trim();
    if (!t || loading) return;
    if (!overrideText) setInput("");

    addMsg("user", t);
    setLoading(true);
    setConnectionStatus("idle");

    // snapshot history before adding this turn
    const history = [...historyRef.current];
    // append user turn to history for next request
    historyRef.current = [...history, { role: "user", content: t }];

    try {
      const token = getAccessToken();
      const res = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || 'https://backend.lifescienceaiagents.com').replace(/\/$/, '')}/api/v1/agents/project-tracking-agent/execute/`, {
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

      if (res.status === 401 || envelope.error?.code === 'TOKEN_NOT_VALID') {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('user');
          document.cookie = 'access_token=; path=/; max-age=0';
          window.location.href = '/login';
        }
        return;
      }

      if (!res.ok || envelope.success === false) {
        const errMsg = envelope.error?.message || "Something went wrong. Please try again.";
        addMsg("ai", errMsg);
        setConnectionStatus("error");
        historyRef.current = history;
        return;
      }

      // Response is wrapped: { success, message, data: { reply, ... } }
      const data = envelope.data ?? envelope;

      if (!data.success && data.reply) {
        // n8n returned an error reply
        addMsg("ai", data.reply);
        setConnectionStatus("error");
        historyRef.current = history;
        return;
      }

      const reply = data.reply || data.message || "Done.";

      // Keep session state in sync with N8N workflow
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
      // append assistant reply to history
      historyRef.current = [...historyRef.current, { role: "assistant", content: reply }];
    } catch (err) {
      console.error("[project-tracker]", err);
      addMsg("ai", "⚠️ Connection failed. Please check your network and try again.");
      setConnectionStatus("error");
      historyRef.current = history;
    } finally {
      setLoading(false);
    }
  }, [input, loading, addMsg]);

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <GridBg />

      <div style={{
        position:"relative", zIndex:1,
        height: "100vh",
        maxHeight: "100dvh",
        display:"flex", flexDirection:"column",
        overflow:"hidden",
      }}>

        {/* ── HEADER ─────────────────────────────────────────── */}
        <header style={{
          flexShrink:0,height:60,
          borderBottom:"1px solid var(--border)",
          background:"rgba(5,8,15,0.82)",backdropFilter:"blur(28px)",
          display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"0 max(16px,env(safe-area-inset-left)) 0 max(16px,env(safe-area-inset-right))",
          position:"relative",
        }}>
          {/* top accent line */}
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
                  {loading ? "processing…" : connectionStatus==="error" ? "error" : "online"}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            {/* session badge */}
            <div style={{
              padding:"4px 10px",borderRadius:99,
              background:"rgba(0,229,255,0.05)",border:"1px solid rgba(0,229,255,0.13)",
              fontSize:9,fontFamily:"'JetBrains Mono',monospace",
              color:"rgba(0,229,255,0.6)",letterSpacing:"0.06em",
              whiteSpace:"nowrap",
            }}>
              SESSION ACTIVE
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
                {/* action tag above AI messages */}
                {msg.sender==="ai" && msg.meta?.action && (
                  <div style={{ marginBottom:5 }}>
                    <ActionTag action={msg.meta.action} />
                  </div>
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
                  {/* render bold via simple parsing */}
                  {renderText(msg.text)}
                </div>

                {/* meta block */}
                {msg.meta && (msg.meta.project || msg.meta.task || msg.meta.new_status || msg.meta.actor) && (
                  <MetaBlock meta={msg.meta} />
                )}

                {/* project quick-select buttons */}
                {msg.sender === "ai" && msg.meta?.available_projects && msg.meta.available_projects.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {msg.meta.available_projects.map((p, i) => (
                      <button
                        key={p.key}
                        onClick={() => send(`${i + 1}`)}
                        style={{
                          padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)",
                          color: "#00D4FF", cursor: "pointer", transition: "all 0.15s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,212,255,0.18)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,212,255,0.08)")}
                      >
                        {i + 1}. {p.name}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{
                  fontSize:9,color:"var(--dim)",marginTop:4,
                  fontFamily:"'JetBrains Mono',monospace",
                  letterSpacing:"0.05em",
                  paddingLeft: msg.sender==="user" ? 0 : 3,
                  paddingRight: msg.sender==="user" ? 3 : 0,
                }}>
                  {msg.time}
                </div>
              </div>
            </div>
          ))}

          {loading && <TypingBubble />}

          <div ref={messagesEndRef} style={{ height:4 }} />
        </div>

        {/* ── QUICK PROMPTS ──────────────────────────────────── */}
        {/* {messages.length < 3 && (
          <div className="quick-pills" style={{
            flexShrink:0,
            padding:"0 16px 10px",
            display:"flex",gap:7,flexWrap:"wrap",
            background:"rgba(5,8,15,0.6)",
            borderTop:"1px solid var(--border)",
          }}>
            <div style={{ width:"100%",fontSize:10,fontFamily:"'JetBrains Mono',monospace",color:"var(--dim)",letterSpacing:"0.07em",paddingTop:10,paddingBottom:4 }}>
              QUICK ACTIONS
            </div>
            {QUICK_PROMPTS.map(p => (
              <button key={p} onClick={()=>send(p)} disabled={loading} style={{
                padding:"6px 12px",
                borderRadius:99,fontSize:12,
                background:"rgba(255,255,255,0.04)",
                border:"1px solid var(--border-hi)",
                color:"var(--muted)",
                transition:"all 0.17s",
                whiteSpace:"nowrap",
              }}
              onMouseEnter={e=>{(e.target as HTMLElement).style.borderColor="rgba(0,229,255,0.35)";(e.target as HTMLElement).style.color="var(--cyan)";}}
              onMouseLeave={e=>{(e.target as HTMLElement).style.borderColor="var(--border-hi)";(e.target as HTMLElement).style.color="var(--muted)";}}>
                {p}
              </button>
            ))}
          </div>
        )} */}

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

          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            <div style={{
              flex:1,display:"flex",alignItems:"center",
              background:"var(--surface2)",
              border:"1.5px solid var(--border-hi)",
              borderRadius:16,overflow:"hidden",
              transition:"border-color 0.2s",
            }}
            onFocusCapture={e=>(e.currentTarget.style.borderColor="rgba(0,229,255,0.3)")}
            onBlurCapture={e=>(e.currentTarget.style.borderColor="var(--border-hi)")}>

              {/* intent icon */}
              <span style={{
                padding:"0 12px",fontSize:15,
                color:"var(--muted)",flexShrink:0,userSelect:"none",
              }}>⬡</span>

              <input
                ref={inputRef}
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); } }}
                placeholder="Ask about tasks, projects, status…"
                disabled={loading}
                enterKeyHint="send"
                style={{
                  flex:1,height:48,padding:"0 4px 0 0",
                  background:"transparent",border:"none",
                  color:"var(--text)",fontSize:14,
                }}
              />
            </div>

            <button
              onClick={()=>send()}
              disabled={!input.trim()||loading}
              style={{
                width:46,height:46,borderRadius:14,flexShrink:0,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:18,
                background: input.trim()&&!loading
                  ? "linear-gradient(135deg,rgba(0,229,255,0.22),rgba(155,109,255,0.22))"
                  : "rgba(255,255,255,0.04)",
                border: input.trim()&&!loading
                  ? "1px solid rgba(0,229,255,0.35)"
                  : "1px solid var(--border)",
                color: input.trim()&&!loading ? "var(--cyan)" : "var(--muted)",
                cursor: input.trim()&&!loading ? "pointer" : "not-allowed",
                transition:"all 0.18s",
                touchAction:"manipulation",
              }}
            >
              {loading
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
              Project Tracking Agent
            </span>
            <span style={{
              fontSize:9,fontFamily:"'JetBrains Mono',monospace",
              letterSpacing:"0.05em",
              color: loading ? "var(--amber)" : "var(--dim)",
              animation: loading ? "pulse-slow 1s ease infinite" : "none",
            }}>
              {loading ? "● thinking…" : "○ ready"}
            </span>
          </div>
        </footer>
      </div>
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