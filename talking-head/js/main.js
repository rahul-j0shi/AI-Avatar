import { TalkingHead } from "talkinghead";

let head;
let isInitialized = false;
let isSpeaking = false;

async function checkForNewResponse() {
    if (!isInitialized) return;

    try {
        const response = await fetch('http://localhost:8000/get_response');
        const data = await response.json();

        if (data.hasNew && data.text && !isSpeaking) {
            console.log('New response received:', data.text);
            await speak(data.text);
        }
    } catch (error) {
        console.error('Error checking for new response:', error);
    }
}

async function initializeAvatar() {
    console.log('Starting avatar initialization...');
    const avatarContainer = document.getElementById('avatar');

    try {
        head = new TalkingHead(avatarContainer, {
            ttsEndpoint: "http://localhost:8000/tts",
            ttsLang: "hi",
            ttsVoice: "male-qn-qingse",
            lipsyncLang: 'en',
            lipsyncModules: ["en"],
            modelPixelRatio: window.devicePixelRatio,
            modelFPS: 30,
            cameraRotateEnable: true,
            audioBufferSize: 4096,
            ttsRequestBuilder: customTTSRequestBuilder
        });

        await head.showAvatar({
            url: './assets/models/avatar.glb',
            body: 'F',
            avatarMood: 'neutral',
            lipsyncLang: 'en'
        });

        head.start();
        console.log('Avatar loaded successfully!');

        const loadingDiv = document.getElementById('loading');
        if (loadingDiv) loadingDiv.remove();

        isInitialized = true;
        setInterval(checkForNewResponse, 1000);

        console.log('Avatar system fully initialized and ready');
    } catch (error) {
        console.error('Error initializing avatar:', error);
        isInitialized = false;
    }
}

function customTTSRequestBuilder(text, voice, lang, options) {
    const minimaxRequest = {
        model: "speech-2.8-turbo",
        text: text,
        stream: false,
        voice_setting: {
            voice_id: voice || "male-qn-qingse",
            speed: 1,
            vol: 1,
            pitch: 0,
            emotion: "calm"
        },
        audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: "mp3",
            channel: 1
        }
    };

    return {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(minimaxRequest)
    };
}

async function speak(text) {
    if (!head || !isInitialized) {
        console.error('Avatar not properly initialized');
        return;
    }

    if (!text || text.trim() === '') {
        console.log('Empty text received, skipping speech');
        return;
    }

    try {
        isSpeaking = true;
        console.log('Starting speech:', text);

        await head.speakText(text, {
            avatarMood: 'neutral',
            onEnd: () => {
                console.log('Speech completed');
                isSpeaking = false;
            }
        });
    } catch (error) {
        console.error('Error during speech:', error);
        isSpeaking = false;
    }
}

function createInitButton() {
    const button = document.createElement('button');
    button.textContent = 'Click to Start Avatar';
    button.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 20px;
        font-size: 16px;
        cursor: pointer;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
    `;

    button.addEventListener('click', async () => {
        await initializeAvatar();
        button.remove();
    });

    document.body.appendChild(button);
}

document.addEventListener('DOMContentLoaded', createInitButton);