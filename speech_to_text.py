import io
import os
import pyaudio
from google.oauth2 import service_account
from google.cloud import speech_v1 as speech
import queue
import threading

# Suppress warnings
import warnings
warnings.filterwarnings("ignore")

class SpeechToText:
    def __init__(self, language_code="en-US"):
        # Set up Google Cloud credentials
        client_file = "./sa_speech.json"
        self.credentials = service_account.Credentials.from_service_account_file(client_file)
        self.client = speech.SpeechClient(credentials=self.credentials)
        
        # Audio configuration
        self.RATE = 16000
        self.CHUNK = int(self.RATE / 10)
        self.language_code = language_code
        
        # Create a thread-safe queue for transcripts
        self.transcript_queue = queue.Queue()
        self.is_running = False

    def get_config(self):
        return speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=self.RATE,
            language_code=self.language_code,
            enable_automatic_punctuation=True,
        )

    def microphone_stream(self):
        audio_interface = pyaudio.PyAudio()
        audio_stream = audio_interface.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=self.RATE,
            input=True,
            frames_per_buffer=self.CHUNK,
        )

        while self.is_running:
            data = audio_stream.read(self.CHUNK, exception_on_overflow=False)
            yield speech.StreamingRecognizeRequest(audio_content=data)

        audio_stream.stop_stream()
        audio_stream.close()
        audio_interface.terminate()

    def process_transcripts(self):
        streaming_config = speech.StreamingRecognitionConfig(
            config=self.get_config(),
            interim_results=True,
        )

        requests = self.microphone_stream()
        responses = self.client.streaming_recognize(streaming_config, requests)

        try:
            for response in responses:
                for result in response.results:
                    if result.is_final:
                        transcript = result.alternatives[0].transcript
                        self.transcript_queue.put(transcript)
        except Exception as e:
            print(f"Error in processing transcripts: {str(e)}")

    def start(self):
        """Start listening and transcribing"""
        self.is_running = True
        self.thread = threading.Thread(target=self.process_transcripts)
        self.thread.start()

    def stop(self):
        """Stop listening and transcribing"""
        self.is_running = False
        if hasattr(self, 'thread'):
            self.thread.join()

    def get_latest_transcript(self):
        """Get the latest transcript from the queue"""
        if not self.transcript_queue.empty():
            return self.transcript_queue.get()
        return None

# Example usage
if __name__ == "__main__":
    stt = SpeechToText()
    print("Starting speech recognition... Press Ctrl+C to stop")
    try:
        stt.start()
        while True:
            transcript = stt.get_latest_transcript()
            if transcript:
                print("Transcript:", transcript)
    except KeyboardInterrupt:
        print("\nStopping speech recognition...")
        stt.stop()