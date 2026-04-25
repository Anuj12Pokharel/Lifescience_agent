import { NextRequest, NextResponse } from "next/server";

const N8N_WEBHOOK_URL =
  process.env.N8N_PROJECT_WEBHOOK_URL ||
  process.env.N8N_WEBHOOK_URL ||
  "";

const SERVICE_CONFIG = {
  JIRA_BASE_URL:           process.env.JIRA_BASE_URL            || "",
  JIRA_AUTH:               process.env.JIRA_AUTH                || "",
  JIRA_PROJECT_KEY:        process.env.JIRA_PROJECT_KEY         || "SCRUM",
  GEMINI_API_KEY:          process.env.GEMINI_API_KEY           || "",
  SLACK_CHANNEL_ID:        process.env.SLACK_CHANNEL_ID         || "",
  SHEETS_DOC_ID:           process.env.SHEETS_DOC_ID            || "",
  TIMEZONE_OFFSET_MINUTES: Number(process.env.TIMEZONE_OFFSET_MINUTES) || 0,
};

export async function POST(req: NextRequest) {
  if (!N8N_WEBHOOK_URL) {
    console.error("[project-chat] N8N_PROJECT_WEBHOOK_URL is not set");
    return NextResponse.json(
      { success: false, reply: "Project agent is not configured." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const {
      message,
      sessionId,
      userId,
      userEmail,
      userName,
      lastProjectKey,
      lastProjectName,
      conversationHistory,
    } = body;

    if (!message?.trim()) {
      return NextResponse.json(
        { success: false, reply: "Message cannot be empty." },
        { status: 400 }
      );
    }

    const resolvedUserId   = userId   || `web-${Date.now()}`;
    const resolvedSession  = sessionId || `session_web_${Date.now()}`;

    console.log(
      "[project-chat] →", N8N_WEBHOOK_URL,
      "| user:", resolvedUserId,
      "| msg:", message.trim().substring(0, 60)
    );

    const n8nRes = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message:             message.trim(),
        userId:              resolvedUserId,
        userName:            userName            || "Web User",
        userEmail:           userEmail           || null,
        channel:             "web",
        sessionId:           resolvedSession,
        lastProjectKey:      lastProjectKey      || null,
        lastProjectName:     lastProjectName     || null,
        conversationHistory: conversationHistory || [],
        config:              SERVICE_CONFIG,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    console.log("[project-chat] n8n status:", n8nRes.status);

    if (!n8nRes.ok) {
      const errText = await n8nRes.text().catch(() => "unknown");
      console.error("[project-chat] n8n error:", n8nRes.status, errText);
      return NextResponse.json(
        { success: false, reply: "The project agent is temporarily unavailable. Please try again." },
        { status: 502 }
      );
    }
    const rawText = await n8nRes.text();
    console.log("[project-chat] n8n raw:", rawText.substring(0, 500));

    if (!rawText?.trim()) {
      console.warn("[project-chat] n8n returned empty body");
      return NextResponse.json(
        { success: false, reply: "The agent returned an empty response. Please try again." },
        { status: 502 }
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(rawText);
    } catch {
      console.error("[project-chat] JSON parse failed. Raw:", rawText.substring(0, 300));
      return NextResponse.json(
        { success: false, reply: "The agent returned an unreadable response. Please try again." },
        { status: 502 }
      );
    }

    const rawResponse = Array.isArray(raw) ? raw[0] : raw;

    // Trim trailing spaces from n8n field names (known n8n quirk)
    const response = Object.fromEntries(
      Object.entries(rawResponse as Record<string, unknown>).map(([k, v]) => [k.trim(), v])
    );

    return NextResponse.json({
      success:             true,
      reply:               response.reply || response.details || response.message || response.text || "No response from agent.",
      action:              response.action      || null,
      project:             response.project     || null,
      task:                response.task        || null,
      new_status:          response.new_status  || null,
      actor:               response.actor       || null,
      sessionId:           response.sessionId   || response.session_id || resolvedSession,
      timestamp:           response.timestamp   || new Date().toISOString(),
      log_id:              response.log_id      || null,
      lastProjectKey:      response.lastProjectKey  || lastProjectKey  || null,
      lastProjectName:     response.lastProjectName || lastProjectName || null,
      conversationHistory: response.conversationHistory || conversationHistory || [],
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[project-chat] error:", error.message);
    const isTimeout = error.name === "TimeoutError" || error.name === "AbortError";
    return NextResponse.json(
      {
        success: false,
        reply: isTimeout
          ? "The request timed out. The agent may be busy — please try again."
          : "An unexpected error occurred. Please try again.",
      },
      { status: 500 }
    );
  }
}