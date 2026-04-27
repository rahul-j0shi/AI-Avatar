import asyncio
import json
from contextlib import AsyncExitStack
from typing import Any, Dict, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from loguru import logger
import os

from adapters.base import BaseLLM, BaseSpeechToText, BaseTextToSpeech
from adapters.registry import LLM_REGISTRY, STT_REGISTRY, TTS_REGISTRY
from session import ConversationSession

app = FastAPI(title="Hinglish AI Avatar")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frontend_path = os.path.join(BASE_DIR, "frontend")

app.mount("/talking-head", StaticFiles(directory=os.path.join(BASE_DIR, "talking-head")), name="talking-head")
app.mount("/assets", StaticFiles(directory=os.path.join(frontend_path, "assets")), name="assets")
app.mount("/css", StaticFiles(directory=os.path.join(frontend_path, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(frontend_path, "js")), name="js")

@app.get("/")
async def root():
    return RedirectResponse(url="/landing.html")

@app.get("/landing.html")
async def serve_landing():
    from fastapi.responses import FileResponse
    return FileResponse(os.path.join(frontend_path, "landing.html"))

@app.get("/playground.html")
async def serve_playground():
    from fastapi.responses import FileResponse
    return FileResponse(os.path.join(frontend_path, "playground.html"))

@app.get("/playground")
async def playground():
    return RedirectResponse(url="/playground.html")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

connections: Dict[str, ConversationSession] = {}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_id = str(id(websocket))
    session = ConversationSession()
    connections[session_id] = session
    logger.info(f"New connection: {session_id}")

    try:
        async with AsyncExitStack() as exit_stack:
            await exit_stack.aclose()

        while True:
            try:
                message = await websocket.receive()

                if message["type"] == "websocket.disconnect":
                    break

                if message["type"] == "websocket.receive":
                    if "text" in message:
                        data = json.loads(message["text"])
                        await handle_text_message(websocket, session, data)
                    elif "bytes" in message:
                        await handle_binary_message(websocket, session, message["bytes"])

            except json.JSONDecodeError:
                await send_error(websocket, "Invalid JSON format")

    except WebSocketDisconnect:
        logger.info(f"Connection closed: {session_id}")
    except Exception as e:
        logger.error(f"Error in websocket handler: {e}")
        await send_error(websocket, str(e))
    finally:
        if session_id in connections:
            del connections[session_id]


async def handle_text_message(websocket: WebSocket, session: ConversationSession, data: Dict[str, Any]):
    msg_type = data.get("type")

    if msg_type == "config":
        await handle_config(websocket, session, data.get("payload", {}))
    else:
        await send_error(websocket, f"Unknown message type: {msg_type}")


async def handle_binary_message(websocket: WebSocket, session: ConversationSession, audio_bytes: bytes):
    if session.stt_adapter is None or session.llm_adapter is None or session.tts_adapter is None:
        await send_error(websocket, "Session not configured. Send config message first.")
        return

    try:
        await websocket.send_json({"type": "status", "payload": {"message": "Transcribing..."}})
        transcript = await session.stt_adapter.transcribe(audio_bytes, session.stt_settings)
        await websocket.send_json({"type": "transcript", "payload": {"text": transcript}})

        session.add_to_history("user", transcript)

        await websocket.send_json({"type": "status", "payload": {"message": "Generating response..."}})
        llm_response = await session.llm_adapter.generate(
            transcript,
            session.system_prompt,
            session.llm_settings
        )
        await websocket.send_json({"type": "llm_response", "payload": {"text": llm_response}})

        session.add_to_history("assistant", llm_response)

        await websocket.send_json({"type": "status", "payload": {"message": "Synthesizing speech..."}})
        tts_audio = await session.tts_adapter.synthesize(llm_response, session.tts_settings)
        await websocket.send_bytes(tts_audio, mode="binary")
        await websocket.send_json({"type": "tts_audio", "payload": {"has_audio": True}})

    except Exception as e:
        logger.error(f"Error in conversation loop: {e}")
        await send_error(websocket, f"Error processing audio: {str(e)}")


async def handle_config(websocket: WebSocket, session: ConversationSession, config: Dict[str, Any]):
    try:
        stt_provider = config.get("stt_provider")
        stt_api_key = config.get("stt_api_key")
        stt_settings = config.get("stt_settings", {})

        llm_provider = config.get("llm_provider")
        llm_api_key = config.get("llm_api_key")
        llm_settings = config.get("llm_settings", {})
        system_prompt = config.get("system_prompt", "")

        tts_provider = config.get("tts_provider")
        tts_api_key = config.get("tts_api_key")
        tts_settings = config.get("tts_settings", {})

        if not all([stt_provider, stt_api_key, llm_provider, llm_api_key, tts_provider, tts_api_key]):
            await send_error(websocket, "Missing required configuration fields")
            return

        if stt_provider not in STT_REGISTRY:
            await send_error(websocket, f"Unknown STT provider: {stt_provider}")
            return

        if llm_provider not in LLM_REGISTRY:
            await send_error(websocket, f"Unknown LLM provider: {llm_provider}")
            return

        if tts_provider not in TTS_REGISTRY:
            await send_error(websocket, f"Unknown TTS provider: {tts_provider}")
            return

        stt_adapter: BaseSpeechToText = STT_REGISTRY[stt_provider](stt_api_key)
        llm_adapter: BaseLLM = LLM_REGISTRY[llm_provider](llm_api_key)
        tts_adapter: BaseTextToSpeech = TTS_REGISTRY[tts_provider](tts_api_key)

        session.stt_adapter = stt_adapter
        session.llm_adapter = llm_adapter
        session.tts_adapter = tts_adapter
        session.stt_settings = stt_settings
        session.llm_settings = llm_settings
        session.tts_settings = tts_settings
        session.system_prompt = system_prompt

        await websocket.send_json({"type": "config_ack", "payload": {"status": "configured"}})
        logger.info(f"Session configured successfully: stt={stt_provider}, llm={llm_provider}, tts={tts_provider}")

    except Exception as e:
        logger.error(f"Error configuring session: {e}")
        await send_error(websocket, f"Configuration error: {str(e)}")


async def send_error(websocket: WebSocket, message: str):
    try:
        await websocket.send_json({"type": "error", "payload": {"message": message}})
    except Exception:
        pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
