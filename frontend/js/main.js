import { WebSocketClient } from './websocket-client.js';
import { ConfigPanel } from './config-panel.js';
import { AudioCapture } from './audio-capture.js';
import { AvatarController } from './avatar-controller.js';

class PlaygroundApp {
    constructor() {
        this.wsClient = null;
        this.configPanel = null;
        this.audioCapture = null;
        this.avatarController = null;
        this.isSessionActive = false;
        this.currentTranscript = '';
        this.currentResponse = '';
    }

    init() {
        this.configPanel = new ConfigPanel();
        this.configPanel.setOnConfigReady((config) => this.startSession(config));
        this.configPanel.setOnError((error) => this.showError(error));

        document.getElementById('back-to-landing').addEventListener('click', () => {
            window.location.href = 'landing.html';
        });

        document.getElementById('clear-log').addEventListener('click', () => {
            this.clearLog();
        });

        document.getElementById('mic-button').addEventListener('click', () => {
            this.toggleMic();
        });

        this.initAvatar();
    }

    async initAvatar() {
        try {
            const avatarContainer = document.getElementById('avatar-container');
            const loadingDiv = document.getElementById('loading');
            if (loadingDiv) loadingDiv.textContent = 'Loading avatar...';

            this.avatarController = new AvatarController('avatar-container');
            await this.avatarController.init({});

            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.remove();

        } catch (error) {
            console.error('Failed to initialize avatar:', error);
            const loadingDiv = document.getElementById('loading');
            if (loadingDiv) loadingDiv.textContent = 'Avatar not available';
        }
    }

    async startSession(config) {
        try {
            this.wsClient = new WebSocketClient('ws://localhost:8000/ws');
            
            this.wsClient.setOnOpen(() => {
                console.log('WebSocket connected, sending config...');
                this.wsClient.sendJson({ type: 'config', payload: config });
            });

            this.wsClient.setOnMessage((event) => {
                this.handleMessage(event);
            });

            this.wsClient.setOnError((error) => {
                console.error('WebSocket error:', error);
                this.showError('Connection error. Please check if the backend is running.');
            });

            await this.wsClient.connect();

            this.configPanel.hidePanel();
            document.getElementById('playground-area').classList.remove('hidden');
            
            this.audioCapture = new AudioCapture();
            await this.audioCapture.init();
            this.audioCapture.setOnAudioBlob((blob) => this.handleAudioBlob(blob));

            if (this.avatarController) {
                await this.avatarController.init(config.tts_settings || {});
            }

            document.getElementById('mic-button').disabled = false;
            
            this.addLogEntry('system', 'Session started. Click the microphone to begin.');

        } catch (error) {
            console.error('Failed to start session:', error);
            this.showError('Failed to start session: ' + error.message);
        }
    }

    handleMessage(event) {
        const message = this.wsClient.parseMessage(event);
        
        if (!message) return;

        switch (message.type) {
            case 'config_ack':
                console.log('Config acknowledged by server');
                break;
            case 'status':
                console.log('Status:', message.payload?.message);
                break;
            case 'transcript':
                this.currentTranscript = message.payload?.text || '';
                this.addLogEntry('user', this.currentTranscript);
                break;
            case 'llm_response':
                this.currentResponse = message.payload?.text || '';
                this.addLogEntry('assistant', this.currentResponse);
                break;
            case 'tts_audio':
                if (this.avatarController && this.currentResponse) {
                    this.avatarController.speakText(this.currentResponse);
                }
                break;
            case 'error':
                this.showError(message.payload?.message || 'Unknown error');
                break;
        }
    }

    async handleAudioBlob(blob) {
        if (!this.isSessionActive || !this.wsClient) return;

        try {
            const arrayBuffer = await blob.arrayBuffer();
            this.wsClient.sendBinary(arrayBuffer);
        } catch (error) {
            console.error('Error sending audio:', error);
        }
    }

    toggleMic() {
        if (this.isSessionActive) {
            this.audioCapture.stop();
            this.isSessionActive = false;
            document.getElementById('mic-button').classList.remove('recording');
        } else {
            this.audioCapture.start();
            this.isSessionActive = true;
            document.getElementById('mic-button').classList.add('recording');
        }
    }

    addLogEntry(type, text) {
        const logContent = document.getElementById('log-content');
        if (!logContent) return;

        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        
        const speaker = document.createElement('div');
        speaker.className = 'speaker';
        speaker.textContent = type === 'user' ? 'You' : 'Assistant';
        
        const textEl = document.createElement('div');
        textEl.className = 'text';
        textEl.textContent = text;

        entry.appendChild(speaker);
        entry.appendChild(textEl);
        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
    }

    clearLog() {
        const logContent = document.getElementById('log-content');
        if (logContent) {
            logContent.innerHTML = '';
        }
    }

    showError(message) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.classList.remove('hidden');
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 5000);
        }
    }

    cleanup() {
        if (this.audioCapture) {
            this.audioCapture.cleanup();
        }
        if (this.wsClient) {
            this.wsClient.close();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new PlaygroundApp();
    app.init();

    window.addEventListener('beforeunload', () => {
        app.cleanup();
    });
});