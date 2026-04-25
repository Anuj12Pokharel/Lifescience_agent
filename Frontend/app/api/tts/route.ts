

import { NextRequest, NextResponse } from "next/server";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? "";


const VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM"; // Rachel

const MODEL_ID = "eleven_turbo_v2_5"; // fastest + cheapest; swap to
                                       // "eleven_multilingual_v2" for richer quality

export async function POST(req: NextRequest) {
  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY is not set" },
      { status: 500 }
    );
  }

  let text: string;
  try {
    const body = await req.json();
    text = (body.text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const safeText = text.slice(0, 5000);

  const elRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: safeText,
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.45,        // 0-1: lower = more expressive
          similarity_boost: 0.82, // 0-1: higher = closer to original voice
          style: 0.0,             // 0-1: style exaggeration (turbo model)
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!elRes.ok) {
    const errText = await elRes.text().catch(() => elRes.statusText);
    console.error("[ElevenLabs TTS] error:", elRes.status, errText);
    return NextResponse.json(
      { error: `ElevenLabs error ${elRes.status}: ${errText}` },
      { status: 502 }
    );
  }

  // Stream the MP3 bytes directly to the browser
  const audioBuffer = await elRes.arrayBuffer();
  return new NextResponse(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}

