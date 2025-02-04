import io
import queue
import threading
from google.oauth2 import service_account
from google.cloud import speech_v1 as speech
import pyaudio
import warnings

warnings.filterwarnings("ignore")

class MicrophoneStream:
    """Opens a recording stream as a generator yielding the audio chunks."""
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
    def __init__(self, credentials_path, language_code="hi-IN"):
        try:
            self.credentials = service_account.Credentials.from_service_account_file(credentials_path)
            self.client = speech.SpeechClient(credentials=self.credentials)
            self.RATE = 16000
            self.CHUNK = int(self.RATE / 10)
            self.language_code = language_code
            self.transcript_queue = queue.Queue()
            self.is_running = False
            self.on_transcript_callback = None
        except Exception as e:
            print(f"Error initializing Speech-to-Text handler: {str(e)}")
            raise

    def set_transcript_callback(self, callback):
        """Set a callback function to be called when new transcript is available"""
        self.on_transcript_callback = callback
    
    def get_config(self):
        return speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=self.RATE,
            language_code=self.language_code,
            enable_automatic_punctuation=True,
        )

    def process_transcripts(self):
        streaming_config = speech.StreamingRecognitionConfig(
            config=self.get_config(),
            interim_results=True,
        )

        try:
            with MicrophoneStream(self.RATE, self.CHUNK) as stream:
                audio_generator = stream.generator()
                requests = (
                    speech.StreamingRecognizeRequest(audio_content=content)
                    for content in audio_generator
                )

                responses = self.client.streaming_recognize(streaming_config, requests)

                for response in responses:
                    if not self.is_running:
                        break
                        
                    if not response.results:
                        continue

                    result = response.results[0]
                    if not result.alternatives:
                        continue

                    transcript = result.alternatives[0].transcript

                    if result.is_final:
                        self.transcript_queue.put(transcript)
                        if self.on_transcript_callback:
                            self.on_transcript_callback(transcript)

        except Exception as e:
            print(f"Error in processing transcripts: {str(e)}")
            self.is_running = False

    def start(self):
        if self.is_running:
            return
            
        self.is_running = True
        self.thread = threading.Thread(target=self.process_transcripts)
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