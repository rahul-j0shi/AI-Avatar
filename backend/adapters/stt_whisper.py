import io
import wave
from typing import Any, Dict

from openai import OpenAI

from adapters.base import BaseSpeechToText


class WhisperSTT(BaseSpeechToText):
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)

    async def transcribe(self, audio_bytes: bytes, settings: Dict[str, Any]) -> str:
        language = settings.get("language", "hi")
        model = settings.get("model", "whisper-1")

        wav_io = io.BytesIO()
        with wave.open(wav_io, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(16000)
            wav_file.writeframes(audio_bytes)

        wav_io.seek(0)
        wav_io.name = 'audio.wav'

        response = self.client.audio.transcriptions.create(
            model=model,
            file=wav_io,
            language=language,
            response_format="text"
        )

        return response.strip()
