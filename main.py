import os
from speech_to_text import SpeechToTextHandler
from llm_call import LLMHandler
from text_to_speech import TextToSpeechHandler
import time

class ConversationSystem:
    def __init__(self):
        # Configuration
        self.credentials_path = os.getenv("GOOGLE_CLOUD_CREDENTIALS")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.output_dir = "conversations"
        
        # Ensure output directory exists
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Initialize components
        self.stt = SpeechToTextHandler(self.credentials_path)
        self.llm = LLMHandler(self.openai_api_key)
        self.tts = TextToSpeechHandler(self.credentials_path)
        
        # Set up conversation counter
        self.conversation_counter = 0
        
    def handle_transcript(self, transcript):
        """Callback function to handle new transcripts"""
        print(f"\nUser said: {transcript}")
        
        # Generate LLM response
        llm_response = self.llm.generate_response(transcript)
        if llm_response:
            print(f"Assistant: {llm_response}")
            
            # Generate speech from LLM response
            output_filename = os.path.join(
                self.output_dir, 
                f"response_{self.conversation_counter}.mp3"
            )
            if self.tts.synthesize_speech(llm_response, output_filename):
                print(f"Response saved as: {output_filename}")
            else:
                print("Failed to synthesize speech")
                
            self.conversation_counter += 1
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