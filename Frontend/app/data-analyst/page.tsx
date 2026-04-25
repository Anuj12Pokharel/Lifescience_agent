"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronLeft, MessageSquare, Loader2, Paperclip, X, BarChart3, TrendingUp,
  PieChart, Activity, Grid, Maximize2, Columns, LayoutList, Layers, FileText, Image as ImageIcon
} from "lucide-react";
import { AgentAccessCheck } from "@/components/agent-access-check";

import {
  ResponsiveContainer, BarChart as RechartsBarChart, LineChart as RechartsLineChart, PieChart as RechartsPieChart, 
  ScatterChart as RechartsScatterChart, Bar, Line, Pie, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell
} from "recharts";

// The options for visual representations
const VIZ_OPTIONS = [
  { id: "bar", name: "Bar Chart", icon: BarChart3 },
  { id: "line", name: "Line Chart", icon: TrendingUp },
  { id: "pie", name: "Pie Chart", icon: PieChart },
  { id: "histogram", name: "Histogram", icon: Activity },
  { id: "heatmap", name: "Heat Map", icon: Grid },
  { id: "scatter", name: "Scatter Plot", icon: Maximize2 },
  { id: "box", name: "Box-and-Whisker Plot", icon: Columns },
  { id: "gantt", name: "Gantt Chart", icon: LayoutList },
];

interface Visualization {
  possible: boolean;
  chart_type: string;
  title: string;
  x_label: string;
  y_label: string;
  data: any[];
  reason: string | null;
}

interface Msg {
  id: string;
  sender: "ai" | "user";
  text: string;
  time: string;
  visualization?: Visualization;
  attachmentName?: string;
  attachmentType?: string;
  analysisRequest?: string;
}

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #080b14; --border: rgba(255,255,255,0.08); --border-bright: rgba(255,255,255,0.16);
    --text: #f0f4ff; --muted: rgba(240,244,255,0.4); --accent: #06B6D4;
    --accent2: #38bdf8; --accent3: #818CF8; --danger: #ff5a6e;
  }
  html, body { height: 100%; background: var(--bg); color: var(--text); font-family: 'Space Grotesk', sans-serif; overflow: hidden; overscroll-behavior: none; }
  .chat-root { height: 100vh; height: 100dvh; }
  @keyframes drift1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(60px,40px)} }
  @keyframes drift2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-50px,-40px)} }
  @keyframes drift3 { 0%,100%{transform:translate(-50%,-50%) scale(1)} 50%{transform:translate(-50%,-50%) scale(1.15)} }
  @keyframes dot-bounce { 0%,80%,100%{transform:translateY(0);opacity:0.3} 40%{transform:translateY(-5px);opacity:1} }
  @keyframes msg-in { from{opacity:0;transform:translateY(12px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes slide-up { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
  .msg-in { animation: msg-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
  .slide-up { animation: slide-up 0.35s cubic-bezier(0.34,1.2,0.64,1) both; }
  .scroller { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent; -webkit-overflow-scrolling: touch; }
  .scroller::-webkit-scrollbar { width: 3px; }
  .scroller::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
  input::placeholder, textarea::placeholder { color: var(--muted); }
  input:focus, textarea:focus { outline: none; }
  button { cursor: pointer; border: none; background: none; font-family: 'Space Grotesk', sans-serif; }
  input, textarea, select { font-size: 16px !important; }
  
  .option-card {
    border: 1px solid var(--border-bright);
    background: rgba(255,255,255,0.03);
    border-radius: 12px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .option-card:hover {
    background: rgba(255,255,255,0.06);
    border-color: rgba(6,182,212,0.4);
  }
  .option-card.selected {
    background: linear-gradient(135deg, rgba(6,182,212,0.15), rgba(56,189,248,0.15));
    border-color: var(--accent);
    box-shadow: 0 0 15px rgba(6,182,212,0.2);
  }
  
  .viz-btn {
    display: flex; flex-direction: column; items-center; justify-content: center; gap: 8px;
    padding: 12px; border-radius: 10px; border: 1px solid var(--border-bright);
    background: rgba(255,255,255,0.02); cursor: pointer; transition: all 0.2s;
  }
  .viz-btn:hover { background: rgba(255,255,255,0.06); border-color: rgba(6,182,212,0.3); }
  .viz-btn.selected {
    background: rgba(6,182,212,0.15); border-color: var(--accent); color: var(--accent);
  }
`;

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const COLORS = ['#06B6D4', '#38bdf8', '#818CF8', '#A78BFA', '#F472B6'];

function renderChart(viz: Visualization) {
  const chartType = viz.chart_type?.toLowerCase();
  
  if (chartType === "line" || chartType === "line chart") {
    return (
      <RechartsLineChart data={viz.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="label" stroke="rgba(255,255,255,0.5)" fontSize={12} tickMargin={10} />
        <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} />
        <Tooltip contentStyle={{ backgroundColor: "#080b14", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8 }} />
        <Legend />
        <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={3} activeDot={{ r: 8 }} name={viz.y_label || "Value"} />
      </RechartsLineChart>
    );
  }

  if (chartType === "pie" || chartType === "pie chart") {
    return (
      <RechartsPieChart>
        <Tooltip contentStyle={{ backgroundColor: "#080b14", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8 }} />
        <Legend />
        <Pie data={viz.data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={(entry) => entry.label}>
          {viz.data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </RechartsPieChart>
    );
  }
  
  if (chartType === "scatter" || chartType === "scatter plot") {
    return (
      <RechartsScatterChart>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis type="category" dataKey="label" name={viz.x_label || "Label"} stroke="rgba(255,255,255,0.5)" fontSize={12} />
        <YAxis type="number" dataKey="value" name={viz.y_label || "Value"} stroke="rgba(255,255,255,0.5)" fontSize={12} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: "#080b14", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8 }} />
        <Legend />
        <Scatter name={viz.title || "Data"} data={viz.data} fill="var(--accent)" />
      </RechartsScatterChart>
    );
  }

  // Fallback to Bar chart
  return (
      <RechartsBarChart data={viz.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="label" stroke="rgba(255,255,255,0.5)" fontSize={12} tickMargin={10} />
        <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} />
        <Tooltip contentStyle={{ backgroundColor: "#080b14", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8 }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
        <Legend />
        <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} name={viz.y_label || "Value"} />
      </RechartsBarChart>
  );
}

function TypingDots() {
  return (
    <div className="msg-in" style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, overflow: "hidden", border: "1px solid rgba(6,182,212,0.2)", display: "flex", alignItems:"center", justifyContent:"center", background:"rgba(8,11,20,0.8)" }}>
        <Image src="/logo.png" alt="AI" width={22} height={22} style={{ objectFit: "contain" }} />
      </div>
      <div style={{ padding: "13px 17px", borderRadius: "5px 20px 20px 20px", background: "rgba(6,182,212,0.07)", border: "1px solid rgba(6,182,212,0.12)", display: "flex", gap: 5, alignItems: "center" }}>
        {[0, 0.16, 0.32].map((d, i) => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: `dot-bounce 1.2s ease-in-out ${d}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

function Background() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.016) 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
      <div style={{ position: "absolute", width: "700px", height: "700px", top: "-220px", left: "-180px", borderRadius: "50%", filter: "blur(90px)", opacity: 0.25, background: "radial-gradient(circle,rgba(6,182,212,0.25),transparent 70%)", animation: "drift1 18s ease-in-out infinite" }} />
      <div style={{ position: "absolute", width: "600px", height: "600px", bottom: "-200px", right: "-140px", borderRadius: "50%", filter: "blur(90px)", opacity: 0.25, background: "radial-gradient(circle,rgba(167,139,250,0.22),transparent 70%)", animation: "drift2 22s ease-in-out infinite" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 85% 85% at 50% 50%,transparent 40%,rgba(8,11,20,0.65) 100%)" }} />
    </div>
  );
}

export default function DataAnalystPage() {
  const [messages, setMessages] = useState<Msg[]>([{
    id: "0", sender: "ai", time: nowTime(),
    text: "Hello. I am the Data Analyst AI. You can upload biological datasets or reports, and I can provide general insights or visual representations.",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [analysisType, setAnalysisType] = useState<"insight" | "visual" | "both" | "">("");
  const [vizType, setVizType] = useState<string>("");
  const [pendingText, setPendingText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, loading]);

  const addMsg = (sender: "ai" | "user", text: string, visualization?: Visualization, attachmentName?: string, attachmentType?: string, analysisRequest?: string) => {
    setMessages(p => [...p, { id: `${Date.now()}-${Math.random()}`, sender, text, time: nowTime(), visualization, attachmentName, attachmentType, analysisRequest }]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  const submitToWebhook = async (text: string, analysisTypeVal?: string, vizTypeVal?: string) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("message", text);
      formData.append("action", "analyzeData");
      formData.append("sessionId", sessionId);

      if (attachment) {
        const fileMetadata = [{
          name: attachment.name,
          size: attachment.size,
          type: attachment.type
        }];
        formData.append("fileMetadata", JSON.stringify(fileMetadata));
        formData.append("file", attachment);
      }

      if (analysisTypeVal) {
        formData.append("analysisType", analysisTypeVal);
      }
      
      if (vizTypeVal) {
        formData.append("chartType", vizTypeVal);
      }

      const res = await fetch("https://www.lifescienceaiagents.com/webhook/a3e148dc-9bf5-46f2-8807-87b7cf66ee4f", {
        method: "POST",
        body: formData
      });
      
      if (!res.ok) throw new Error("Webhook failed");
      
      // Since it's a webhook, it might just return 200 without a typed response
      // But we will try to parse JSON anyway just in case it returns AI text.
      try {
        const rawData = await res.json();
        // N8N often returns an array from webhook response node
        const data = Array.isArray(rawData) ? rawData[0] : rawData;

        let aiText = data.response || data.text || data.message || "Data sent to the analysis pipeline successfully.";
        let vizData: Visualization | undefined;

        if (data.analysis) {
             // The analysis field itself might be a JSON string as per the user's example
             try {
                const parsedAnalysis = JSON.parse(data.analysis);
                if (parsedAnalysis.analysis) aiText = parsedAnalysis.analysis;
                if (parsedAnalysis.visualization && parsedAnalysis.visualization.possible) {
                    vizData = parsedAnalysis.visualization;
                } else if (parsedAnalysis.visualization && !parsedAnalysis.visualization.possible) {
                    aiText += `\n\n*(Note: Visualization wasn't possible: ${parsedAnalysis.visualization.reason})*`;
                }
             } catch(e) {
                 aiText = data.analysis;
             }
        }

        addMsg("ai", aiText, vizData);
      } catch (err) {
        addMsg("ai", "Data submitted successfully for analysis.");
      }
    } catch (err) {
      console.error(err);
      addMsg("ai", "I'm sorry, there was an error submitting your data to the analysis webhook.");
    } finally {
      setLoading(false);
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = () => {
    const t = input.trim();
    if (!t && !attachment) return;
    
    // Clear input immediately to make it feel responsive
    setInput("");
    
    if (attachment) {
      setPendingText(t);
      setShowModal(true);
    } else {
      addMsg("user", t);
      submitToWebhook(t);
    }
  };

  const handleModalSubmit = () => {
    setShowModal(false);
    
    let analysisString = "";
    if (analysisType === "insight") {
      analysisString = "General insight: summarize the data in 3-5 sentences.";
    } else if (analysisType === "visual") {
      const v = VIZ_OPTIONS.find(o => o.id === vizType);
      analysisString = `Visual representation: ${v?.name || "Chart"}`;
    } else if (analysisType === "both") {
      const v = VIZ_OPTIONS.find(o => o.id === vizType);
      analysisString = `Both (General insight (3-5 sentences) & Visual representation: ${v?.name || "Chart"})`;
    }

    const t = pendingText;
    
    addMsg("user", t, undefined, attachment?.name, attachment?.type, analysisString);
    submitToWebhook(t, analysisType, vizType);
    
    // Reset modal state
    setAnalysisType("");
    setVizType("");
  };

  return (
    <AgentAccessCheck agentSlug="data-analyst">
      {(hasAccess, isLoading) => (
        <>
          <style>{GLOBAL_CSS}</style>
          <Background />
      <div className="chat-root" style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        {/* HEADER */}
        <header style={{ flexShrink: 0, position: "relative", height: 58, borderBottom: "1px solid var(--border)", background: "rgba(8,11,20,0.76)", backdropFilter: "blur(30px)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <button style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-bright)", color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronLeft size={17} />
              </button>
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(6,182,212,0.3)", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(6,182,212,0.1)" }}>
                <BarChart3 size={18} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, background: "linear-gradient(90deg,#06B6D4,#38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Data Analyst</div>
                <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.05em", textTransform: "uppercase" }}>Advanced Analytics</div>
              </div>
            </div>
          </div>
        </header>

        {/* MESSAGES */}
        <div ref={messagesRef} className="scroller messages-area" style={{ flex: 1, overflowY: "auto", padding: "20px 16px 12px", display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map(msg => (
            <div key={msg.id} className="msg-in" style={{ display: "flex", alignItems: "flex-end", gap: 8, flexDirection: msg.sender === "user" ? "row-reverse" : "row" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, overflow: "hidden", border: msg.sender === "ai" ? "1px solid rgba(6,182,212,0.3)" : "1px solid rgba(255,255,255,0.2)", background: msg.sender === "ai" ? "rgba(8,11,20,0.8)" : "linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.05))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {msg.sender === "ai" ? <Image src="/logo.png" alt="AI" width={20} height={20} style={{ objectFit: "contain" }} /> : <div style={{ fontSize: 12, fontWeight: 700 }}>U</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: msg.sender === "user" ? "flex-end" : "flex-start", maxWidth: msg.visualization ? "100%" : "80%", width: msg.visualization ? "100%" : "auto" }}>
                {msg.attachmentName && (
                  <div style={{ marginBottom: msg.text ? 8 : 0, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(255,255,255,0.05)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
                    {msg.attachmentType?.startsWith("image/") ? <ImageIcon size={16} color="var(--accent)" /> : <FileText size={16} color="var(--accent)" />}
                    <span style={{ fontSize: 13, color: "var(--text)" }}>{msg.attachmentName}</span>
                  </div>
                )}
                {msg.text && (
                  <div style={{ padding: "11px 15px", fontSize: 14, lineHeight: 1.65, wordBreak: "break-word", whiteSpace: "pre-wrap", borderRadius: msg.sender === "ai" ? "5px 18px 18px 18px" : "18px 5px 18px 18px", background: msg.sender === "ai" ? "rgba(6,182,212,0.07)" : "linear-gradient(135deg,rgba(56,189,248,0.14),rgba(129,140,248,0.14))", border: msg.sender === "ai" ? "1px solid rgba(6,182,212,0.15)" : "1px solid rgba(56,189,248,0.2)", backdropFilter: "blur(16px)" }}>
                    {msg.text.split(/(\*\*.*?\*\*)/g).map((part, index) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={index}>{part.slice(2, -2)}</strong>;
                      }
                      return <span key={index}>{part}</span>;
                    })}
                  </div>
                )}
                {msg.analysisRequest && (
                  <div style={{ marginTop: msg.text ? 6 : 0, fontSize: 12, color: "var(--accent2)", fontStyle: "italic", background: "rgba(56,189,248,0.05)", padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(56,189,248,0.1)" }}>
                    {msg.analysisRequest}
                  </div>
                )}
                {msg.visualization && msg.visualization.possible && (
                   <div style={{ marginTop: 12, padding: 16, background: "rgba(6,182,212,0.03)", borderRadius: 12, width: "100%", border: "1px solid rgba(6,182,212,0.15)" }}>
                       <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, textAlign: "center", color: "var(--accent)" }}>{msg.visualization.title}</h4>
                       <div style={{ width: "100%", height: 350 }}>
                           <ResponsiveContainer width="100%" height="100%">
                               {renderChart(msg.visualization)}
                           </ResponsiveContainer>
                       </div>
                   </div>
                )}
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4, fontFamily: "'DM Mono',monospace" }}>{msg.time}</div>
              </div>
            </div>
          ))}
          {loading && <TypingDots />}
          <div style={{ height: 4 }} />
        </div>

        {/* INPUT AREA */}
        <footer style={{ flexShrink: 0, padding: "12px 16px 16px", borderTop: "1px solid var(--border)", background: "rgba(8,11,20,0.78)", backdropFilter: "blur(30px)" }}>
          
          {/* Attachment Pill */}
          {attachment && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 8, marginBottom: 12 }}>
              <Paperclip size={14} color="var(--accent)" />
              <span style={{ fontSize: 13, color: "#E8F4FF", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachment.name}</span>
              <button onClick={() => setAttachment(null)} style={{ color: "var(--muted)", display: "flex", padding: 2 }}><X size={14}/></button>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 1, position: "relative", background: "rgba(255,255,255,0.05)", border: "1.5px solid var(--border-bright)", borderRadius: 14, display: "flex", alignItems: "center", paddingLeft: 8 }}>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} />
              <button onClick={() => fileInputRef.current?.click()} style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", transition: "color 0.2s" }} onMouseEnter={e=>e.currentTarget.style.color="var(--accent)"} onMouseLeave={e=>e.currentTarget.style.color="var(--muted)"}>
                <Paperclip size={18} />
              </button>
              
              <textarea 
                value={input} 
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type your message or ask for analysis..." 
                disabled={loading}
                style={{ flex: 1, border: "none", background: "transparent", color: "var(--text)", padding: "14px 10px 14px 4px", fontSize: 15, fontFamily: "'Space Grotesk', sans-serif", resize: "none", height: 50 }}
              />
            </div>
            <button onClick={handleSend} disabled={(!input.trim() && !attachment) || loading} style={{ width: 50, height: 50, borderRadius: 14, background: (input.trim() || attachment) && !loading ? "linear-gradient(135deg, var(--accent), var(--accent2))" : "rgba(255,255,255,0.05)", color: (input.trim() || attachment) && !loading ? "#080b14" : "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", cursor: (input.trim() || attachment) && !loading ? "pointer" : "not-allowed" }}>
              {loading ? <Loader2 size={18} style={{ animation: "orb-spin 1s linear infinite" }} /> : <MessageSquare size={18} fill="currentColor" />}
            </button>
          </div>
        </footer>

        {/* ANALYSIS OPTIONS MODAL */}
        {showModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(4,7,15,0.85)", backdropFilter: "blur(8px)" }}>
            <div className="slide-up" style={{ width: "95%", maxWidth: 640, background: "rgba(14,18,32,0.98)", border: "1px solid var(--border-bright)", borderRadius: 24, padding: "28px", boxShadow: "0 20px 60px rgba(0,0,0,0.7)", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Analysis Options</h2>
                  <p style={{ fontSize: 14, color: "var(--muted)" }}>You attached a file. How would you like the AI to process it?</p>
                </div>
                <button onClick={() => setShowModal(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}><X size={16}/></button>
              </div>

              {/* Step 1: Analysis Type */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
                <div 
                  className={`option-card ${analysisType === "insight" ? "selected" : ""}`}
                  onClick={() => setAnalysisType("insight")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ padding: 8, background: "rgba(255,255,255,0.05)", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FileText size={18} color={analysisType === "insight" ? "var(--accent)" : "white"} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 600, color: analysisType === "insight" ? "var(--accent)" : "white" }}>General Insight</h4>
                      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>The model will summarize the data in 3-5 sentences.</p>
                    </div>
                  </div>
                </div>

                <div 
                  className={`option-card ${analysisType === "visual" ? "selected" : ""}`}
                  onClick={() => setAnalysisType("visual")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ padding: 8, background: "rgba(255,255,255,0.05)", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <BarChart3 size={18} color={analysisType === "visual" ? "var(--accent)" : "white"} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 600, color: analysisType === "visual" ? "var(--accent)" : "white" }}>Visual Representation</h4>
                      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Generate specific charts or plots from your data.</p>
                    </div>
                  </div>
                </div>

                <div 
                  className={`option-card ${analysisType === "both" ? "selected" : ""}`}
                  onClick={() => setAnalysisType("both")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ padding: 8, background: "rgba(255,255,255,0.05)", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Layers size={18} color={analysisType === "both" ? "var(--accent)" : "white"} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 600, color: analysisType === "both" ? "var(--accent)" : "white" }}>Both (Insight + Visual)</h4>
                      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Get a summary plus a visual representation.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Visual Selection (if applicable) */}
              {(analysisType === "visual" || analysisType === "both") && (
                <div className="fade-in" style={{ marginBottom: 28, animation: "fade-in 0.3s ease forwards" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>Select Chart Type</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                    {VIZ_OPTIONS.map(viz => {
                      const Icon = viz.icon;
                      return (
                        <button 
                          key={viz.id} 
                          className={`viz-btn ${vizType === viz.id ? "selected" : ""}`}
                          onClick={() => setVizType(viz.id)}
                        >
                          <Icon size={24} />
                          <span style={{ fontSize: 11, textAlign: "center", fontWeight: 500 }}>{viz.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Handle 2 columns on small screens */}
                  <style>{`
                    @media (max-width: 500px) {
                      .viz-btn { grid-template-columns: repeat(2, 1fr) !important; }
                    }
                  `}</style>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button onClick={() => setShowModal(false)} style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid var(--border-bright)", color: "white", fontSize: 14, fontWeight: 600 }}>Cancel</button>
                <button 
                  onClick={handleModalSubmit}
                  disabled={!analysisType || ((analysisType === "visual" || analysisType === "both") && !vizType)}
                  style={{ padding: "12px 24px", borderRadius: 10, background: (!analysisType || ((analysisType === "visual" || analysisType === "both") && !vizType)) ? "rgba(255,255,255,0.1)" : "var(--accent)", color: (!analysisType || ((analysisType === "visual" || analysisType === "both") && !vizType)) ? "var(--muted)" : "#000", fontSize: 14, fontWeight: 700, transition: "all 0.2s", cursor: (!analysisType || ((analysisType === "visual" || analysisType === "both") && !vizType)) ? "not-allowed" : "pointer" }}
                >
                  Send to Analyst
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
      )}
    </AgentAccessCheck>
  );
}
