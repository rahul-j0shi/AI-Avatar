import io
import wave
from typing import Any, Dict

import requests

from adapters.base import BaseSpeechToText


class DeepgramSTT(BaseSpeechToText):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.url = "https://api.deepgram.com/v1/listen"

    async def transcribe(self, audio_bytes: bytes, settings: Dict[str, Any]) -> str:
        language = settings.get("language", "hi")
        model = settings.get("model", "nova-2")

        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": "audio/wav",
        }

        params = {
            "language": language,
            "model": model,
            "smart_format": "true",
        }

        response = requests.post(
            self.url,
            headers=headers,
            params=params,
            data=audio_bytes
        )

        if response.status_code != 200:
            raise Exception(f"Deepgram API error: {response.status_code} - {response.text}")

        result = response.json()
        return result["results"]["channels"][0]["alternatives"][0]["transcript"]
