from google.cloud import texttospeech

class TextToSpeechHandler:
    def __init__(self, credentials_path):
        self.credentials_path = credentials_path
        try:
            self.client = texttospeech.TextToSpeechClient.from_service_account_file(credentials_path)
        except Exception as e:
            print(f"Error initializing Text-to-Speech client: {str(e)}")
            raise
    
    def synthesize_speech(self, text, output_filename, language_code="hi-IN"):
        try:
            synthesis_input = texttospeech.SynthesisInput(text=text)
            voice = texttospeech.VoiceSelectionParams(
                language_code=language_code,
                ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
            )
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3
            )
            
            response = self.client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config
            )
            
            with open(output_filename, "wb") as out:
                out.write(response.audio_content)
            return True
        except Exception as e:
            print(f"Error in speech synthesis: {str(e)}")
            return False
