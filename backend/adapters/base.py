from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseSpeechToText(ABC):
    @abstractmethod
    async def transcribe(self, audio_bytes: bytes, settings: Dict[str, Any]) -> str:
        ...


class BaseLLM(ABC):
    @abstractmethod
    async def generate(
        self,
        user_text: str,
        system_prompt: str,
        settings: Dict[str, Any]
    ) -> str:
        ...


class BaseTextToSpeech(ABC):
    @abstractmethod
    async def synthesize(self, text: str, settings: Dict[str, Any]) -> bytes:
        ...
