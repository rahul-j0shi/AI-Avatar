import io
from google.oauth2 import service_account
from google.cloud import speech_v1 as speech
from pydub import AudioSegment
import wave

import warnings
warnings.filterwarnings("ignore")

client_file = "./sa_speech.json"
credentials = service_account.Credentials.from_service_account_file(client_file)
client = speech.SpeechClient(credentials=credentials)

def convert_to_mono(input_file, output_file):
    audio = AudioSegment.from_file(input_file)
    audio = audio.set_channels(1) 
    audio.export(output_file,format = "wav")

convert_to_mono("./examples/harvard.wav", "./examples/harvard_mono.wav")

audio_file = "./examples/harvard_mono.wav"

with wave.open("./examples/harvard_mono.wav", "rb") as wav_file:
    sample_rate = wav_file.getframerate()
    print(f"sample rate: {sample_rate}")

with io.open(audio_file, 'rb') as f:
    content = f.read()
    audio = speech.RecognitionAudio(content=content)

config = speech.RecognitionConfig(encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16, sample_rate_hertz=sample_rate, language_code="en-US")

response = client.recognize(config=config, audio=audio)
for result in response.results:
    print(result.alternatives[0].transcript)

