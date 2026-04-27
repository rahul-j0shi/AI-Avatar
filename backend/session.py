from typing import Any, Dict, List, Optional

from adapters.base import BaseLLM, BaseSpeechToText, BaseTextToSpeech


class ConversationSession:
    def __init__(
        self,
        stt_adapter: Optional[BaseSpeechToText] = None,
        llm_adapter: Optional[BaseLLM] = None,
        tts_adapter: Optional[BaseTextToSpeech] = None
    ):
        self.stt_adapter = stt_adapter
        self.llm_adapter = llm_adapter
        self.tts_adapter = tts_adapter
        self.message_history: List[Dict[str, str]] = []
        self.max_history = 5
        self.stt_settings: Dict[str, Any] = {}
        self.llm_settings: Dict[str, Any] = {}
        self.tts_settings: Dict[str, Any] = {}
        self.system_prompt: str = ""

    def add_to_history(self, role: str, content: str):
        self.message_history.append({"role": role, "content": content})
        if len(self.message_history) > self.max_history:
            self.message_history.pop(0)

    def get_history(self) -> List[Dict[str, str]]:
        return self.message_history.copy()

    def configure(
        self,
        stt_adapter: BaseSpeechToText,
        llm_adapter: BaseLLM,
        tts_adapter: BaseTextToSpeech
    ):
        self.stt_adapter = stt_adapter
        self.llm_adapter = llm_adapter
        self.tts_adapter = tts_adapter
