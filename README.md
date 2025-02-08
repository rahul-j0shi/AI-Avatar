# 3D AI Avatar

This project implements a conversational AI system that allows users to interact with a 3D animated avatar using speech. The user speaks into a microphone and receives audio responses from the avatar in Hinglish (Hindi language written in Roman script).

## Features

- Real-time speech recognition using Google Cloud Speech-to-Text API
- Natural language conversation with OpenAI GPT-3.5 turbo model
- Realistic 3D talking avatar rendered in the browser with Three.js
- Audio responses in Hinglish using Google Text-to-Speech API

## Requirements

- Python 3.7+
- Google Cloud Speech-to-Text API credentials
- OpenAI API key
- Modern web browser with WebGL support

## Installation

1. Clone the repository
2. Install the required Python packages
3. Set up the necessary API credentials:
    - Create a Google Cloud project and enable the Speech-to-Text API
    - Generate and download the Google Cloud credentials JSON file
    - Generate a GCP API key and restrict its usage for Text-to-Speech
    - Create an OpenAI API key
4. Set the required keys as environment variables

## Usage

Usage

1. Start the backend server:
```bash
python main.py
```
2. In a separate terminal, start the proxy server by navigating to the talking-head file:
```bash
python server.py
```
3. Open a web browser and navigate to http://localhost:8000
4. Click the "Start Avatar" button and grant microphone permission
5. Speak in Hindi and wait for the avatar's response