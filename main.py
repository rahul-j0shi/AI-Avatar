import os
from speech_to_text import SpeechToTextHandler
from llm_call import LLMHandler
import requests
import time

class ConversationSystem:
    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.minimax_api_key = os.getenv("MINIMAX_API_KEY")

        self.stt = SpeechToTextHandler(self.openai_api_key)
        self.llm = LLMHandler(self.minimax_api_key)

        self._configure_tts_server()

    def _configure_tts_server(self):
        try:
            response = requests.post(
                'http://localhost:8000/configure',
                json={'minimax_api_key': self.minimax_api_key},
                headers={'Content-Type': 'application/json'}
            )
            if response.status_code == 200:
                print("TTS server configured with MiniMax API key")
        except Exception as e:
            print(f"Warning: Could not configure TTS server: {str(e)}")
        
    def handle_transcript(self, transcript):
        """Callback function to handle new transcripts"""
        print(f"\nUser said: {transcript}")
        
        # Generate LLM response
        llm_response = self.llm.generate_response(transcript)
        if llm_response:
            print(f"Assistant: {llm_response}")
            
            # Send response to our server
            try:
                response = requests.post(
                    'http://localhost:8000/set_response',
                    json={'text': llm_response},
                    headers={'Content-Type': 'application/json'}
                )
                if response.status_code == 200:
                    print("Response sent to avatar successfully")
                else:
                    print("Failed to send response to avatar")
            except Exception as e:
                print(f"Error sending response to avatar: {str(e)}")
        else:
            print("Failed to generate LLM response")

    def start(self):
        """Start the conversation system"""
        print("Starting conversation system...")
        print("Speak into your microphone (Press Ctrl+C to stop)")
        
        # Set up transcript callback
        self.stt.set_transcript_callback(self.handle_transcript)
        
        try:
            # Start speech recognition
            self.stt.start()
            
            # Keep the main thread alive
            while True:
                time.sleep(0.1)
                
        except KeyboardInterrupt:
            print("\nStopping conversation system...")
            self.stt.stop()
            print("System stopped.")

if __name__ == "__main__":
    system = ConversationSystem()
    system.start()