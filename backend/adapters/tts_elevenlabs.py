from typing import Any, Dict

import requests

from adapters.base import BaseTextToSpeech


class ElevenLabsTTS(BaseTextToSpeech):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.url = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    async def synthesize(self, text: str, settings: Dict[str, Any]) -> bytes:
        voice_id = settings.get("voice_id", "21m00Tcm4TlvDq8ikWAM")
        model_id = settings.get("model_id", "eleven_multilingual_v2")
        stability = settings.get("stability", 0.5)
        similarity_boost = settings.get("similarity_boost", 0.75)
        style = settings.get("style", 0.0)
        speed = settings.get("speed", 1.0)

        url = self.url.format(voice_id=voice_id)

        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        }

        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": stability,
                "similarity_boost": similarity_boost,
                "style": style,
                "speed": speed
            }
        }

        response = requests.post(url, headers=headers, json=payload)

        if response.status_code != 200:
            raise Exception(f"ElevenLabs TTS API error: {response.status_code} - {response.text}")

        return response.content
