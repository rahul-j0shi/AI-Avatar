from typing import Any, Dict

from openai import OpenAI

from adapters.base import BaseLLM


class MiniMaxLLM(BaseLLM):
    def __init__(self, api_key: str):
        self.client = OpenAI(
            api_key=api_key,
            base_url="https://api.minimaxi.com/v1"
        )

    async def generate(
        self,
        user_text: str,
        system_prompt: str,
        settings: Dict[str, Any]
    ) -> str:
        model = settings.get("model", "MiniMax-M2.7")
        temperature = settings.get("temperature", 0.7)
        max_tokens = settings.get("max_tokens", 150)
        top_p = settings.get("top_p", 1.0)

        response = self.client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text}
            ],
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p
        )

        return response.choices[0].message.content.strip()
