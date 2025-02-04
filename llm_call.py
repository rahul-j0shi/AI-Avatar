import openai

class LLMHandler:
    def __init__(self, api_key):
        self.api_key = api_key
        openai.api_key = api_key
        
    def generate_response(self, user_prompt):
        instruction = """
            You have to act as a friend of the user who are meeting after a long time.
            Assume yourself in the place of that friend and delve into that role.
            You are to communicate with the user in informal and casual tone.
            Make sure that your response MUST only be in Hinglish (hindi in roman literals or macaronic hybrid use of English and Hindi).
            It MUST NOT contain any hindi, devnagiri, unknown, or special characters.
            It MUST only be proper hinglish that people use to for texting in India.
            Irrespective of user's input language, your response MUST be Hinglish only.
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