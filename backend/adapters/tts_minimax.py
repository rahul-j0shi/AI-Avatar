from typing import Any, Dict

import requests

from adapters.base import BaseTextToSpeech


class MiniMaxTTS(BaseTextToSpeech):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.url = "https://api.minimaxi.com/v1/t2a_v2"

    async def synthesize(self, text: str, settings: Dict[str, Any]) -> bytes:
        model = settings.get("model", "speech-02")
        voice_id = settings.get("voice_id", "male-qn-qingse")
        speed = settings.get("speed", 1.0)
        emotion = settings.get("emotion", "calm")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": model,
            "text": text,
            "stream": False,
            "voice_setting": {
                "voice_id": voice_id,
                "speed": speed,
                "vol": 1,
                "pitch": 0,
                "emotion": emotion
            },
            "audio_setting": {
                "sample_rate": 32000,
                "bitrate": 128000,
                "format": "mp3",
                "channel": 1
            }
        }

        response = requests.post(self.url, headers=headers, json=payload)

        if response.status_code != 200:
            raise Exception(f"MiniMax TTS API error: {response.status_code} - {response.text}")

        return response.content
