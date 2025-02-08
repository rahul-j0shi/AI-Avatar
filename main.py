import os
from speech_to_text import SpeechToTextHandler
from llm_call import LLMHandler
import requests
import time

class ConversationSystem:
    def __init__(self):
        # Configuration
        self.credentials_path = os.getenv("GOOGLE_CLOUD_CREDENTIALS")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        
        # Initialize components
        self.stt = SpeechToTextHandler(self.credentials_path)
        self.llm = LLMHandler(self.openai_api_key)
        
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