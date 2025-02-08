import { TalkingHead } from "talkinghead";

let head;

// Function to check for new responses
async function checkForNewResponse() {
    try {
        const response = await fetch('http://localhost:8000/get_response');
        const data = await response.json();
        
        if (data.hasNew && data.text) {
            // Update textarea (optional - for visualization)
            const textarea = document.getElementById('text-to-speak');
            if (textarea) textarea.value = data.text;
            
            // Make avatar speak
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
            ttsLang: "en-US",
            ttsVoice: "en-US-Standard-A",
            lipsyncLang: 'en',
            lipsyncModules: ["en"],
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
        
        // Start polling for new responses
        setInterval(checkForNewResponse, 1000);  // Check every second
        
        // Keep the speak button functionality for testing
        document.getElementById('speak-button').addEventListener('click', () => {
            const text = document.getElementById('text-to-speak').value;
            speak(text);
        });
    } catch (error) {
        console.error('Error initializing avatar:', error);
    }
}

async function speak(text) {
    if (!head) {
        console.error('Avatar not initialized');
        return;
    }

    if (!text || text.trim() === '') return;

    try {
        console.log('Attempting to speak:', text);
        await head.speakText(text, {
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