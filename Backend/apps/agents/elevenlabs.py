import os
import uuid
import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")  # Rachel
STT_URL = "https://api.elevenlabs.io/v1/speech-to-text"
TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"


def speech_to_text(audio_file) -> str:
    """Convert uploaded audio file to text using ElevenLabs STT."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ELEVENLABS_API_KEY is not configured.")

    response = requests.post(
        STT_URL,
        headers={"xi-api-key": ELEVENLABS_API_KEY},
        files={"file": (audio_file.name, audio_file.read(), audio_file.content_type)},
        data={"model_id": "scribe_v1"},
        timeout=30,
    )

    if not response.ok:
        raise RuntimeError(f"ElevenLabs STT error {response.status_code}: {response.text}")

    return response.json().get("text", "").strip()


def text_to_speech(text: str) -> str:
    """Convert reply text to audio using ElevenLabs TTS. Returns media-relative path."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ELEVENLABS_API_KEY is not configured.")

    url = TTS_URL.format(voice_id=ELEVENLABS_VOICE_ID)
    response = requests.post(
        url,
        headers={
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        json={
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        },
        timeout=30,
    )

    if not response.ok:
        raise RuntimeError(f"ElevenLabs TTS error {response.status_code}: {response.text}")

    filename = f"voice_replies/{uuid.uuid4()}.mp3"
    default_storage.save(filename, ContentFile(response.content))
    return filename
