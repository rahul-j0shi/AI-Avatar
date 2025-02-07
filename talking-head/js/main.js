import { TalkingHead } from "talkinghead";

let head;

async function initializeAvatar() {
    console.log('Starting avatar initialization...');
    const avatarContainer = document.getElementById('avatar');
    
    try {
        console.log('Creating TalkingHead instance...');
        head = new TalkingHead(avatarContainer, {
            // Point to our local proxy instead of Google's API directly
            ttsEndpoint: "http://localhost:8000/tts",  // This will be handled by our proxy
            ttsLang: "en-US",
            ttsVoice: "en-US-Standard-A",
            lipsyncLang: 'en',
            lipsyncModules: ["en"],
            
            // Basic visual settings
            modelPixelRatio: window.devicePixelRatio,
            modelFPS: 30,
            cameraRotateEnable: true
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
        
        document.getElementById('speak-button').addEventListener('click', speak);
    } catch (error) {
        console.error('Error initializing avatar:', error);
    }
}

async function speak() {
    if (!head) {
        console.error('Avatar not initialized');
        return;
    }

    const textToSpeak = document.getElementById('text-to-speak').value;
    if (textToSpeak.trim() === '') return;

    try {
        console.log('Attempting to speak:', textToSpeak);
        await head.speakText(textToSpeak, {
            avatarMood: 'neutral'
        });
    } catch (error) {
        console.error('Error making avatar speak:', error);
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