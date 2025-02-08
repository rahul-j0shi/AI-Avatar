import { TalkingHead } from "talkinghead";

let head;
let isInitialized = false;  // Flag to track initialization
let isSpeaking = false;     // Flag to track speaking state

// Function to check for new responses
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
        console.log('Creating TalkingHead instance...');
        head = new TalkingHead(avatarContainer, {
            ttsEndpoint: "http://localhost:8000/tts",
            ttsLang: "hi-IN",        
            ttsVoice: "hi-IN-Standard-E",  
            lipsyncLang: 'en',             
            lipsyncModules: ["en"],
            modelPixelRatio: window.devicePixelRatio,
            modelFPS: 30,
            cameraRotateEnable: true,
            audioBufferSize: 4096 
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
        
        // Mark as initialized and start polling
        isInitialized = true;
        setInterval(checkForNewResponse, 1000);
        
        console.log('Avatar system fully initialized and ready');
    } catch (error) {
        console.error('Error initializing avatar:', error);
        isInitialized = false;  // Make sure to mark as not initialized on error
    }
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
        isSpeaking = true;  // Set speaking flag
        console.log('Starting speech:', text);
        
        await head.speakText(text, {
            avatarMood: 'neutral',
            onEnd: () => {
                console.log('Speech completed');
                isSpeaking = false;  // Reset speaking flag
            }
        });
    } catch (error) {
        console.error('Error during speech:', error);
        isSpeaking = false;  // Reset speaking flag on error
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