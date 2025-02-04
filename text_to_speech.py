from google.cloud import texttospeech
import os

def text_to_speech(text, output_filename):
    
    # Initialize the client
    client = texttospeech.TextToSpeechClient.from_service_account_file("./sa_speech.json")
    
    # Set the text input
    synthesis_input = texttospeech.SynthesisInput(text=text)
    
    # Configure voice parameters
    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US",
        ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
    )
    
    # Set audio configuration
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
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
        print(f"Audio content written to file: {output_filename}")

# Example usage
if __name__ == "__main__":
    text = "haa bhai kya haal hai"
    output_file = "output.mp3"
    text_to_speech(text, output_file)