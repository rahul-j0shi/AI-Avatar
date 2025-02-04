import streamlit as st
import os
from dotenv import load_dotenv
from speech_to_text import SpeechToTextHandler
from llm_call import LLMHandler
from text_to_speech import TextToSpeechHandler
import time
import logging
import glob

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StreamlitConversationSystem:
    def __init__(self):
        # Configuration
        self.credentials_path = os.getenv("GOOGLE_CLOUD_CREDENTIALS") 
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.output_dir = "conversations"
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Initialize components
        self.stt = SpeechToTextHandler(self.credentials_path)
        self.llm = LLMHandler(self.openai_api_key)
        self.tts = TextToSpeechHandler(self.credentials_path)
        
        # Get current file count
        existing_files = glob.glob(os.path.join(self.output_dir, "response_*.mp3"))
        self.file_counter = len(existing_files)
        
    def handle_transcript(self, transcript):
        """Callback function to handle new transcripts"""
        if not transcript:
            return
            
        logger.info(f"User said: {transcript}")
        
        # Generate LLM response
        llm_response = self.llm.generate_response(transcript)
        
        if llm_response:
            logger.info(f"Assistant: {llm_response}")
            
            # Generate speech from LLM response
            output_filename = os.path.join(
                self.output_dir, 
                f"response_{self.file_counter:02d}.mp3"
            )
            
            if self.tts.synthesize_speech(llm_response, output_filename):
                logger.info(f"Response saved as: {output_filename}")
                self.file_counter += 1
                
                # Add to conversation history
                if 'conversations' not in st.session_state:
                    st.session_state.conversations = []
                    
                st.session_state.conversations.append({
                    'user': transcript,
                    'assistant': llm_response,
                    'audio_file': output_filename
                })
                
                # Force sidebar refresh by updating session state
                st.session_state.last_file_count = self.file_counter
                st.session_state.last_folder_mod_time = os.path.getmtime(self.output_dir)
                st.rerun()
            else:
                logger.error("Failed to synthesize speech")
        else:
            logger.error("Failed to generate LLM response")

    def start(self):
        """Start the conversation system"""
        self.stt.set_transcript_callback(self.handle_transcript)
        self.stt.start()
        logger.info("Speech recognition started")

def get_audio_files():
    """Get sorted list of audio files"""
    files = glob.glob("conversations/response_*.mp3")
    files.sort()  # This will sort by filename
    return files

def main():
    st.set_page_config(page_title="Hindi Conversation Assistant")
    
    # Initialize session state
    if 'system' not in st.session_state:
        st.session_state.system = StreamlitConversationSystem()
        st.session_state.conversations = []
        st.session_state.last_file_count = 0
        st.session_state.last_folder_mod_time = os.path.getmtime("conversations")
        # Start the system
        st.session_state.system.start()

    st.title("Hindi Conversation Assistant")
    
    # Main area - just show status
    st.info("System is listening for Hindi speech...")
    
    # Show conversation history
    if st.session_state.conversations:
        st.markdown("### Conversations")
        for conv in st.session_state.conversations:
            st.text(f"You: {conv['user']}")
            st.text(f"Assistant: {conv['assistant']}")
            st.markdown("---")
    
    # Sidebar with audio files
    with st.sidebar:
        st.markdown("### Audio Files")
        
        # Check if the folder has been modified
        current_folder_mod_time = os.path.getmtime("conversations")
        if current_folder_mod_time != st.session_state.last_folder_mod_time:
            st.session_state.last_folder_mod_time = current_folder_mod_time
            st.rerun()
        
        # Get and display audio files
        audio_files = get_audio_files()
        
        if audio_files:
            for audio_file in audio_files:
                filename = os.path.basename(audio_file)
                st.audio(audio_file, format='audio/mp3')
        else:
            st.write("No audio files available")
            
        st.markdown("---")
        
        if st.button("Refresh"):
            for f in glob.glob("conversations/response_*.mp3"):
                try:
                    os.remove(f)
                except Exception as e:
                    logger.error(f"Error removing file {f}: {e}")
            st.session_state.conversations = []
            st.session_state.system.file_counter = 0
            st.session_state.last_folder_mod_time = os.path.getmtime("conversations")
            st.rerun()

if __name__ == "__main__":
    main()