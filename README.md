# AI Avatar Conversational System

A sophisticated conversational AI system that enables natural Hindi language interaction through speech, powered by Google Cloud Services and OpenAI's GPT-3.5.

## Overview

The AI Avatar Conversational System creates an interactive experience where users can have natural conversations in Hindi. The system processes spoken Hindi input, generates contextually relevant responses in Hinglish (Hindi written in Roman script), and converts these responses back into spoken Hindi, creating a seamless conversational flow.

## Features

- Real-time speech-to-text conversion for Hindi language input
- Natural language processing using GPT-3.5 for generating contextual responses  
- Text-to-speech synthesis for Hindi audio output
- Friendly conversational style using Hinglish format
- Automatic conversation history management
- Real-time audio processing and response generation

## Prerequisites

- Python 3.7 or higher
- Google Cloud Platform account with Speech-to-Text and Text-to-Speech APIs enabled
- OpenAI API key
- PyAudio
- Internet connection

## Required Environment Variables

```bash
GOOGLE_CLOUD_CREDENTIALS=path/to/your/google-credentials.json
OPENAI_API_KEY=your-openai-api-key
