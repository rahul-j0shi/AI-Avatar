from google.cloud import texttospeech
import os
from pathlib import Path

def ensure_dir_exists(file_path):
    """Ensure the directory for the file exists"""
    directory = os.path.dirname(file_path)
    if directory:
        Path(directory).mkdir(parents=True, exist_ok=True)

def text_to_speech(text, output_filename, language_code="en-US", voice_name="en-US-Neural2-C", 
                  speaking_rate=1.0, pitch=0.0):
    """
    Convert text to speech with enhanced configuration options.
    
    Args:
        text (str): The text to convert to speech
        output_filename (str): Path where the audio file will be saved
        language_code (str): Language code (default: "en-US")
        voice_name (str): Specific voice to use (default: "en-US-Neural2-C")
        speaking_rate (float): Speaking rate, 1.0 is normal speed (default: 1.0)
        pitch (float): Voice pitch, 0.0 is normal pitch (default: 0.0)
    """
    try:
        # Ensure the output directory exists
        ensure_dir_exists(output_filename)
        
        # Initialize the client
        client_file = "./sa_speech.json"
        if not os.path.exists(client_file):
            raise FileNotFoundError(f"Credentials file not found: {client_file}")
            
        client = texttospeech.TextToSpeechClient.from_service_account_file(client_file)
        
        # Set the text input
        synthesis_input = texttospeech.SynthesisInput(text=text)
        
        # Configure voice parameters
        voice = texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=voice_name,
        )
        
        # Set audio configuration with enhanced options
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=speaking_rate,
            pitch=pitch,
            effects_profile_id=['handset-class-device'],  # Optimize for mobile/web playback
        )
        
        # Generate speech
        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )
        
        # Save the audio file
        with open(output_filename, "wb") as out:
            out.write(response.audio_content)
            
        return True, None  # Success, no error
        
    except Exception as e:
        error_message = f"Error in text_to_speech: {str(e)}"
        print(error_message)
        return False, error_message  # Return error status and message

def list_available_voices(language_code="en-US"):
    """List available voices for a given language code"""
    try:
        client = texttospeech.TextToSpeechClient.from_service_account_file("./sa_speech.json")
        voices = client.list_voices(language_code=language_code)
        
        available_voices = []
        for voice in voices.voices:
            if language_code in voice.language_codes:
                voice_info = {
                    'name': voice.name,
                    'gender': texttospeech.SsmlVoiceGender(voice.ssml_gender).name,
                    'natural': voice.natural_sample_rate_hertz > 0
                }
                available_voices.append(voice_info)
                
        return available_voices
        
    except Exception as e:
        print(f"Error listing voices: {str(e)}")
        return []

# Example usage
if __name__ == "__main__":
    # List available voices
    voices = list_available_voices()
    print("Available voices:")
    for voice in voices:
        print(f"Name: {voice['name']}, Gender: {voice['gender']}, Natural: {voice['natural']}")
    
    # Example text-to-speech conversion
    text = "Hello! How are you today?"
    output_file = "static/audio/temp/test_output.mp3"
    
    success, error = text_to_speech(
        text=text,
        output_filename=output_file,
        speaking_rate=1.1,  # Slightly faster than normal
        pitch=0.0  # Normal pitch
    )
    
    if success:
        print(f"Audio content written to file: {output_file}")
    else:
        print(f"Error generating speech: {error}")