import io
import queue
import threading
import time
import numpy as np
import pyaudio
import openai
import wave
import warnings

warnings.filterwarnings("ignore")

class MicrophoneStream:
    def __init__(self, rate, chunk):
        self._rate = rate
        self._chunk = chunk
        self._buff = queue.Queue()
        self.closed = True

    def __enter__(self):
        self._audio_interface = pyaudio.PyAudio()
        self._audio_stream = self._audio_interface.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=self._rate,
            input=True,
            frames_per_buffer=self._chunk,
            stream_callback=self._fill_buffer,
        )
        self.closed = False
        return self

    def __exit__(self, type, value, traceback):
        self._audio_stream.stop_stream()
        self._audio_stream.close()
        self.closed = True
        self._buff.put(None)
        self._audio_interface.terminate()

    def _fill_buffer(self, in_data, frame_count, time_info, status_flags):
        self._buff.put(in_data)
        return None, pyaudio.paContinue

    def generator(self):
        while not self.closed:
            chunk = self._buff.get()
            if chunk is None:
                return
            data = [chunk]

            while True:
                try:
                    chunk = self._buff.get(block=False)
                    if chunk is None:
                        return
                    data.append(chunk)
                except queue.Empty:
                    break

            yield b"".join(data)

class SpeechToTextHandler:
    def __init__(self, api_key, language_code="hi"):
        self.api_key = api_key
        self.client = openai.OpenAI(api_key=api_key)
        self.RATE = 16000
        self.CHUNK = int(self.RATE / 10)
        self.language_code = language_code
        self.transcript_queue = queue.Queue()
        self.is_running = False
        self.on_transcript_callback = None
        self.silence_threshold = 500
        self.silence_frames = 30

    def set_transcript_callback(self, callback):
        self.on_transcript_callback = callback

    def is_silent(self, audio_data):
        audio_array = np.frombuffer(audio_data, dtype=np.int16)
        return np.abs(audio_array).mean() < self.silence_threshold

    def process_audio(self):
        buffer_duration = 0
        silence_count = 0
        recording = False
        speech_frames = []

        try:
            with MicrophoneStream(self.RATE, self.CHUNK) as stream:
                audio_generator = stream.generator()

                for chunk in audio_generator:
                    if not self.is_running:
                        break

                    if self.is_silent(chunk):
                        if recording:
                            silence_count += 1
                            if silence_count > self.silence_frames:
                                audio_bytes = b"".join(speech_frames)
                                threading.Thread(target=self.transcribe_audio, args=(audio_bytes,)).start()
                                speech_frames = []
                                recording = False
                                silence_count = 0
                        else:
                            silence_count = 0
                    else:
                        if not recording:
                            recording = True
                        speech_frames.append(chunk)
                        silence_count = 0

                        if len(speech_frames) > 300:
                            audio_bytes = b"".join(speech_frames)
                            threading.Thread(target=self.transcribe_audio, args=(audio_bytes,)).start()
                            speech_frames = []

        except Exception as e:
            print(f"Error in processing audio: {str(e)}")
            self.is_running = False

    def transcribe_audio(self, audio_bytes):
        try:
            wav_io = io.BytesIO()
            with wave.open(wav_io, 'wb') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(self.RATE)
                wav_file.writeframes(audio_bytes)

            wav_io.seek(0)
            wav_io.name = 'audio.wav'

            response = self.client.audio.transcriptions.create(
                model="whisper-1",
                file=wav_io,
                language=self.language_code,
                response_format="text"
            )

            transcript = response.strip()
            if transcript and self.on_transcript_callback:
                self.on_transcript_callback(transcript)

        except Exception as e:
            print(f"Error in transcription: {str(e)}")

    def start(self):
        if self.is_running:
            return

        self.is_running = True
        self.thread = threading.Thread(target=self.process_audio)
        self.thread.start()

    def stop(self):
        self.is_running = False
        if hasattr(self, 'thread'):
            self.thread.join()

    def get_latest_transcript(self):
        try:
            return self.transcript_queue.get_nowait()
        except queue.Empty:
            return None