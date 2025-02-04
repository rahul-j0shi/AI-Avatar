import os

def display_3d_model(model_url):
    model_viewer_html = f"""
        <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
        <model-viewer 
            src="{model_url}"
            auto-rotate 
            camera-controls 
            background-color="#ffffff"
            shadow-intensity="1"
            style="width: 100%; height: 600px;">
        </model-viewer>
    """
    html(model_viewer_html, height=600)

def initialize_session_state():
    if 'messages' not in st.session_state:
        st.session_state.messages = []
    if 'stt' not in st.session_state:
        st.session_state.stt = None
    if 'recording' not in st.session_state:
        st.session_state.recording = False

def toggle_recording():
    if not st.session_state.recording:
        # Start recording
        st.session_state.stt = SpeechToText()
        st.session_state.stt.start()
        st.session_state.recording = True
    else:
        # Stop recording
        if st.session_state.stt:
            st.session_state.stt.stop()
            # Get the final transcript
            transcript = st.session_state.stt.get_latest_transcript()
            if transcript:
                # Add to messages
                st.session_state.messages.append({"role": "user", "content": transcript})
                # Generate speech
                output_file = "temp_speech.mp3"
                text_to_speech(transcript, output_file)
                # Play the audio
                with open(output_file, "rb") as audio_file:
                    audio_bytes = audio_file.read()
                    st.audio(audio_bytes, format='audio/mp3')
                # Clean up
                os.remove(output_file)
        st.session_state.recording = False

def main():
    st.title("AI Avatar Assistant")
    
    # Initialize session state
    initialize_session_state()
    
    # Display avatar
    avatar_url = "https://models.readyplayer.me/67a0fa05a9c8f19272ce9998.glb"
    display_3d_model(avatar_url)
    
    # Display chat messages
    for message in st.session_state.messages:
        with st.container():
            st.write(f"{message['role']}: {message['content']}")
    
    # Create columns for the input area
    col1, col2, col3 = st.columns([3, 1, 1])
    
    # Text input
    with col1:
        user_input = st.text_input("Type your message:", key="text_input")
    
    # Send button
    with col2:
        if st.button("Send"):
            if user_input:
                st.session_state.messages.append({"role": "user", "content": user_input})
                # Generate speech for typed input
                output_file = "temp_speech.mp3"
                text_to_speech(user_input, output_file)
                with open(output_file, "rb") as audio_file:
                    audio_bytes = audio_file.read()
                    st.audio(audio_bytes, format='audio/mp3')
                os.remove(output_file)
                st.experimental_rerun()
    
    # Microphone button
    with col3:
        mic_label = "Stop Recording" if st.session_state.recording else "Start Recording"
        if st.button(mic_label):
            toggle_recording()
    
    # Display recording status
    if st.session_state.recording:
        st.write("Recording... Speak now!")
        # Continuously check for new transcripts while recording
        if st.session_state.stt:
            transcript = st.session_state.stt.get_latest_transcript()
            if transcript:
                st.write(f"Current transcript: {transcript}")

if __name__ == "__main__":
    main()