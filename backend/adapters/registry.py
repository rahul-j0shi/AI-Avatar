from adapters.stt_whisper import WhisperSTT
from adapters.stt_deepgram import DeepgramSTT
from adapters.llm_minimax import MiniMaxLLM
from adapters.llm_openai import OpenAILLM
from adapters.tts_minimax import MiniMaxTTS
from adapters.tts_elevenlabs import ElevenLabsTTS

STT_REGISTRY = {
    "whisper": WhisperSTT,
    "deepgram": DeepgramSTT,
}

LLM_REGISTRY = {
    "minimax": MiniMaxLLM,
    "openai": OpenAILLM,
}

TTS_REGISTRY = {
    "minimax": MiniMaxTTS,
    "elevenlabs": ElevenLabsTTS,
}
