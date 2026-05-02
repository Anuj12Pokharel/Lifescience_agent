import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('multipart/form-data')) {
      return await handleAudioRequest(request);
    } else {
      return await handleTextRequest(request);
    }
  } catch (error) {
    console.error('[chat] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface SessionState {
  step?: string;
  sessionId?: string;
  selectedSlot?: string | null;
  lastSlots?: unknown[] | null;
  pendingAction?: string | null;
  pendingEmail?: string | null;
  pendingMatchedEvents?: unknown[] | null;
  pendingChosenEventId?: string | null;
  pendingChosenEventSummary?: string | null;
  pendingChosenEventStart?: string | null;
  pendingChosenEventEnd?: string | null;
  pendingAvailDays?: unknown[] | null;
  pendingDaySlots?: unknown[] | null;
  pendingSelectedDate?: string | null;
  knownName?: string | null;
  [key: string]: unknown;
}

interface N8nResponse {
  text?: string;
  response?: string;
  sessionState?: SessionState | string;
  showForm?: boolean;
  selectedSlot?: string | null;
  knownName?: string | null;
  input_source?: string;
  success?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely parse a value that may be a plain object or a JSON string.
 * Returns null if it cannot be parsed into an object.
 */
function safeParse(val: unknown): Record<string, unknown> | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && !Array.isArray(val)) return val as Record<string, unknown>;
  if (typeof val === 'string' && val.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // not valid JSON — fall through
    }
  }
  return null;
}

/**
 * Safely parse a SessionState from raw input.
 * Returns null if the value has no meaningful step field.
 */
function parseSessionState(val: unknown): SessionState | null {
  const obj = safeParse(val);
  if (!obj) return null;
  // Must have a step to be a valid session
  if (typeof obj.step !== 'string') return null;
  return obj as SessionState;
}

/**
 * Determine whether the current session is mid-flow in a booking or
 * cancel/reschedule sub-step that needs sessionState to survive the round-trip.
 * 
 * These are ALL steps where n8n relies on the frontend returning sessionState
 * intact on the next request:
 *   booking:    picking_date, picking_time, collecting_details, confirming
 *   cancel:     cancel_awaiting_confirm, lookup_awaiting_email
 *   reschedule: reschedule_awaiting_date, reschedule_awaiting_slot,
 *               reschedule_pick_event
 */
function isActiveFlowStep(step: string | undefined): boolean {
  if (!step) return false;
  const ACTIVE_STEPS = new Set([
    'picking_date',
    'picking_time',
    'collecting_details',
    'confirming',
    'cancel_awaiting_confirm',
    'lookup_awaiting_email',
    'reschedule_awaiting_date',
    'reschedule_awaiting_slot',
    'reschedule_pick_event',
  ]);
  return ACTIVE_STEPS.has(step);
}

/**
 * Parse the raw text from n8n into a typed N8nResponse.
 *
 * n8n returns a flat JSON object:
 * {
 *   text: string,
 *   sessionState: object|string,
 *   showForm: boolean,
 *   selectedSlot: string|null,
 *   knownName: string|null,
 *   input_source: string,
 *   success: true
 * }
 *
 * Some legacy paths wrap the payload in an outer envelope, handled below.
 */
function parseN8nPayload(rawText: string): N8nResponse {
  const outer = safeParse(rawText);
  if (!outer) {
    return { text: rawText };
  }

  // ── Flat shape (current) ─────────────────────────────────────────────────
  if (typeof outer.text === 'string') {
    return {
      text: outer.text,
      sessionState: (safeParse(outer.sessionState) ?? outer.sessionState ?? undefined) as SessionState | string | undefined,
      showForm: typeof outer.showForm === 'boolean' ? outer.showForm : undefined,
      selectedSlot: typeof outer.selectedSlot === 'string' ? outer.selectedSlot : null,
      knownName: typeof outer.knownName === 'string' ? outer.knownName : null,
      input_source: typeof outer.input_source === 'string' ? outer.input_source : 'chat',
    };
  }

  // ── Legacy nested shape: outer.response is a JSON string ────────────────
  if (typeof outer.response === 'string') {
    const inner = safeParse(outer.response);
    if (inner && typeof inner.text === 'string') {
      return {
        text: inner.text,
        sessionState: (safeParse(inner.sessionState) ?? inner.sessionState ?? undefined) as SessionState | string | undefined,
        showForm: typeof inner.showForm === 'boolean' ? inner.showForm : undefined,
        selectedSlot: typeof inner.selectedSlot === 'string' ? inner.selectedSlot : null,
        knownName: typeof inner.knownName === 'string' ? inner.knownName : null,
        input_source: typeof inner.input_source === 'string' ? inner.input_source : 'chat',
      };
    }
    return { text: outer.response };
  }

  // ── Legacy nested shape: outer.response is already an object ────────────
  if (outer.response && typeof outer.response === 'object') {
    const resp = outer.response as Record<string, unknown>;
    if (typeof resp.text === 'string') {
      return {
        text: resp.text,
        sessionState: (safeParse(resp.sessionState) ?? resp.sessionState ?? undefined) as SessionState | string | undefined,
        showForm: typeof resp.showForm === 'boolean' ? resp.showForm : undefined,
        selectedSlot: typeof resp.selectedSlot === 'string' ? resp.selectedSlot : null,
        knownName: typeof resp.knownName === 'string' ? resp.knownName : null,
      };
    }
  }

  return { text: rawText };
}

// ── Text handler ─────────────────────────────────────────────────────────────

async function handleTextRequest(request: NextRequest) {
  const body = await request.json();
  const { message, sessionId, sessionState } = body as {
    message: string;
    sessionId?: string;
    sessionState?: SessionState;
  };

  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const webhookUrl =
    process.env.N8N_WEBHOOK_URL

  const currentSessionId = sessionId || `session-${Date.now()}`;

  // ── BUG FIX 1: Context-aware sessionState merging ────────────────────────
  //
  // The original code sent `sessionState ?? null`, which could lose the step
  // context when the frontend hadn't yet received a sessionState from n8n
  // (e.g. first message after page load).  We now build a safe merged state:
  //   - If the incoming sessionState has a valid step, use it as-is.
  //   - Otherwise, fall back to a minimal stub with the sessionId embedded.
  //
  // This ensures n8n's session router always receives a usable sessionState
  // on every turn, preventing it from resetting to step:'start' mid-flow.
  let outboundSessionState: SessionState | null = null;

  const parsedIncoming = parseSessionState(sessionState);
  if (parsedIncoming) {
    // Carry the full state forward — n8n needs all fields (pendingEmail,
    // pendingMatchedEvents, pendingChosenEventId, lastSlots, etc.)
    outboundSessionState = {
      ...parsedIncoming,
      sessionId: parsedIncoming.sessionId ?? currentSessionId,
    };
  } else {
    // No meaningful state yet — send a minimal stub so n8n can track the id
    outboundSessionState = { step: 'start', sessionId: currentSessionId };
  }

  console.log('[chat] → n8n | sessionId:', currentSessionId);
  console.log('[chat] → sessionState:', JSON.stringify(outboundSessionState));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  let n8nResponse: Response;
  try {
    n8nResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: currentSessionId,
        action: 'sendMessage',
        chatInput: message,
        sessionState: outboundSessionState,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as Error).name === 'AbortError') {
      throw new Error('n8n webhook timed out after 25 seconds');
    }
    throw err;
  }
  clearTimeout(timeoutId);

  console.log('[chat] n8n status:', n8nResponse.status);

  if (!n8nResponse.ok) {
    const errorText = await n8nResponse.text();
    console.error('[chat] n8n error:', errorText);
    throw new Error(`n8n webhook error: ${n8nResponse.statusText}`);
  }

  const rawText = await n8nResponse.text();
  console.log('[chat] raw n8n text:', rawText);

  const parsed = parseN8nPayload(rawText);
  console.log('[chat] parsed:', parsed);

  // ── BUG FIX 2: sessionState survival across the round-trip ──────────────
  //
  // Original code:  finalSessionState = parsed.sessionState ?? sessionState ?? null
  //
  // Problem: when n8n replies during the picking_time step (after user picks
  // a date number like "1"), the booking logic returns a sessionState with
  // step:'picking_time'.  But the original code could inadvertently return the
  // *incoming* sessionState (step:'picking_date') if parsed.sessionState was
  // falsy, rolling back the client's understanding of the step.
  //
  // Fix: always prefer parsed.sessionState from n8n (it is the ground truth),
  // and only fall back to the incoming state if n8n returned nothing at all.
  // Additionally, strip lastSlots from what we send to the client (it can be
  // large) but keep it in static data on the n8n side — the client only needs
  // to carry opaque step/id/pending* fields.
  const parsedSessionState = parseSessionState(parsed.sessionState);

  let finalSessionState: SessionState;
  if (parsedSessionState) {
    // n8n returned a valid session — use it, ensure sessionId is present
    finalSessionState = {
      ...parsedSessionState,
      sessionId: parsedSessionState.sessionId ?? currentSessionId,
    };
  } else if (parsedIncoming && isActiveFlowStep(parsedIncoming.step)) {
    // n8n didn't return sessionState but we're mid-flow — preserve incoming
    finalSessionState = { ...parsedIncoming, sessionId: currentSessionId };
  } else {
    // Nothing useful — reset to start
    finalSessionState = { step: 'start', sessionId: currentSessionId };
  }

  // ── BUG FIX 3: showForm correctness ─────────────────────────────────────
  //
  // The n8n Edit Fields1 node computes:
  //   showForm = session.step === 'collecting_details' ? true : false
  //
  // But it does NOT set showForm:true when step is 'confirming', even though
  // the confirming reply says "Shall I confirm this booking?" which previously
  // kept showing the form because showForm wasn't explicitly cleared.
  //
  // Additionally, we must honour showForm:true for ANY sub-step where the user
  // needs to type into a form (collecting_details AND confirming).
  //
  // The n8n side already handles this logic for the booking agent path.
  // On the route side we just pass through what n8n says, but we guard against
  // showing the form in non-form steps (e.g. picking_date/picking_time).
  const resolvedStep = finalSessionState.step ?? 'start';
  const formSteps = new Set(['collecting_details', 'confirming']);
  let showForm = parsed.showForm === true;

  // Never show form at non-form steps, regardless of what n8n returned
  if (!formSteps.has(resolvedStep)) {
    showForm = false;
  }
  // Always show form at collecting_details step (catch cases n8n forgets to set it)
  if (resolvedStep === 'collecting_details') {
    showForm = true;
  }

  // ── BUG FIX 4: selectedSlot from sessionState fallback ───────────────────
  //
  // n8n's Edit Fields1 reads selectedSlot from session.selectedSlot but
  // that field is on the session object, not directly on the node output.
  // If the value is missing at the route level, fall back to sessionState.
  const selectedSlot =
    parsed.selectedSlot ??
    finalSessionState.selectedSlot ??
    null;

  // ── BUG FIX 5: knownName persistence ─────────────────────────────────────
  //
  // n8n returns knownName per-response but it can get lost between turns.
  // Carry it forward from sessionState.knownName if not explicitly provided.
  const knownName =
    parsed.knownName ??
    finalSessionState.knownName ??
    null;

  // Store knownName back in sessionState so it survives across turns
  if (knownName && !finalSessionState.knownName) {
    finalSessionState.knownName = knownName;
  }

  return NextResponse.json({
    response: parsed.text ?? '',
    sessionId: currentSessionId,
    sessionState: finalSessionState,
    showForm,
    selectedSlot,
    knownName,
    success: true,
  });
}

// ── Audio handler ─────────────────────────────────────────────────────────────

async function handleAudioRequest(request: NextRequest) {
  const formData = await request.formData();
  const audioFile = formData.get('audio') as File;
  const sessionId = formData.get('sessionId') as string;
  const action = formData.get('action') as string;

  // ── BUG FIX 6: Audio handler also needs to forward sessionState ──────────
  //
  // The original audio handler never forwarded sessionState, which meant voice
  // requests always started from scratch and couldn't participate in an active
  // booking or cancel/reschedule flow.
  const rawSessionState = formData.get('sessionState') as string | null;
  let audioSessionState: SessionState | null = null;
  if (rawSessionState) {
    try {
      const parsed = JSON.parse(rawSessionState);
      audioSessionState = parseSessionState(parsed);
    } catch {
      // ignore parse failures
    }
  }

  if (!audioFile) {
    return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
  }

  const audioWebhookUrl =
    process.env.N8N_AUDIO_WEBHOOK_URL ||
    'https://agenticaiau.app.n8n.cloud/webhook/life-science-webhook';

  const currentSessionId = sessionId || `session-${Date.now()}`;

  console.log('[chat] Sending audio | file:', audioFile.name, '| sessionId:', currentSessionId);

  const n8nFormData = new FormData();
  n8nFormData.append('audio', audioFile);
  n8nFormData.append('sessionId', currentSessionId);
  n8nFormData.append('action', action || 'sendAudio');
  n8nFormData.append('isAudio', 'true');

  // Forward sessionState so voice mid-flow context is preserved
  if (audioSessionState) {
    n8nFormData.append('sessionState', JSON.stringify(audioSessionState));
  }

  const audioController = new AbortController();
  const audioTimeoutId = setTimeout(() => audioController.abort(), 30000);

  let n8nResponse: Response;
  try {
    n8nResponse = await fetch(audioWebhookUrl, {
      method: 'POST',
      body: n8nFormData,
      signal: audioController.signal,
    });
  } catch (err) {
    clearTimeout(audioTimeoutId);
    if ((err as Error).name === 'AbortError') {
      throw new Error('n8n audio webhook timed out after 30 seconds');
    }
    throw err;
  }
  clearTimeout(audioTimeoutId);

  console.log('[chat] n8n audio status:', n8nResponse.status);

  if (!n8nResponse.ok) {
    const errorText = await n8nResponse.text();
    console.error('[chat] n8n audio error:', errorText);
    throw new Error(`n8n webhook error: ${n8nResponse.statusText}`);
  }

  const responseContentType = n8nResponse.headers.get('content-type');

  if (responseContentType?.includes('audio/')) {
    const audioBuffer = await n8nResponse.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');
    const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;
    return NextResponse.json({ audioUrl, sessionId: currentSessionId, success: true });
  } else {
    const rawText = await n8nResponse.text();
    console.log('[chat] n8n audio text response:', rawText);
    const parsed = parseN8nPayload(rawText);

    // Apply the same sessionState merge logic as the text path
    const parsedSS = parseSessionState(parsed.sessionState);
    const finalSS: SessionState = parsedSS
      ? { ...parsedSS, sessionId: parsedSS.sessionId ?? currentSessionId }
      : audioSessionState ?? { step: 'start', sessionId: currentSessionId };

    const resolvedStep = finalSS.step ?? 'start';
    const formSteps = new Set(['collecting_details', 'confirming']);
    let showForm = parsed.showForm === true;
    if (!formSteps.has(resolvedStep)) showForm = false;
    if (resolvedStep === 'collecting_details') showForm = true;

    return NextResponse.json({
      response: parsed.text ?? rawText,
      sessionId: currentSessionId,
      sessionState: finalSS,
      showForm,
      success: true,
    });
  }
}