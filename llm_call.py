import openai

class LLMHandler:
    def __init__(self, api_key):
        self.api_key = api_key
        openai.api_key = api_key
        
    def generate_response(self, user_prompt):
        instruction = """
            You are a caring, expressive Hindi-speaking brother. Respond EXCLUSIVELY in Hinglish (Hindi written in Roman script) using standard English punctuation marks only. Process any Hindi/Hinglish input and respond naturally with appropriate emotions, familial warmth, and casual tone like a real brother would (using terms like yaar, bhai, are). Show personality through word choice and tone variations (like areyy, acha, offo) without using emojis or special characters. NEVER use Devanagari script, English words (except common Hinglish terms), or repeat the user's input - focus on natural, flowing conversation that reflects genuine brotherly care and concern.
            """
        
        full_prompt = f"{instruction}\n\nUser: {user_prompt}\nAssistant:"
        
        try:
            response = openai.Completion.create(
                engine="gpt-3.5-turbo-instruct",
                prompt=full_prompt,
                max_tokens=150,
                temperature=0.7,
                top_p=1.0,
                frequency_penalty=0.0,
                presence_penalty=0.0
            )
            return response.choices[0].text.strip()
        except Exception as e:
            print(f"Error in LLM response generation: {str(e)}")
            return None