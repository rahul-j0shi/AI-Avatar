export class ConfigPanel {
    constructor() {
        this.config = null;
        this.onConfigReadyCallback = null;

        this.elements = {
            sttProvider: document.getElementById('stt-provider'),
            sttApiKey: document.getElementById('stt-api-key'),
            sttLanguage: document.getElementById('stt-language'),
            llmProvider: document.getElementById('llm-provider'),
            llmApiKey: document.getElementById('llm-api-key'),
            llmModel: document.getElementById('llm-model'),
            systemPrompt: document.getElementById('system-prompt'),
            llmTemperature: document.getElementById('llm-temperature'),
            tempValue: document.getElementById('temp-value'),
            ttsProvider: document.getElementById('tts-provider'),
            ttsApiKey: document.getElementById('tts-api-key'),
            ttsVoice: document.getElementById('tts-voice'),
            ttsSpeed: document.getElementById('tts-speed'),
            speedValue: document.getElementById('speed-value'),
            startButton: document.getElementById('start-session')
        };

        this.init();
    }

    init() {
        this.elements.llmTemperature.addEventListener('input', (e) => {
            this.elements.tempValue.textContent = e.target.value;
        });

        this.elements.ttsSpeed.addEventListener('input', (e) => {
            this.elements.speedValue.textContent = e.target.value;
        });

        this.elements.startButton.addEventListener('click', () => this.handleStart());
    }

    validate() {
        const required = [
            { el: this.elements.sttProvider, name: 'STT Provider' },
            { el: this.elements.sttApiKey, name: 'STT API Key' },
            { el: this.elements.llmProvider, name: 'LLM Provider' },
            { el: this.elements.llmApiKey, name: 'LLM API Key' },
            { el: this.elements.ttsProvider, name: 'TTS Provider' },
            { el: this.elements.ttsApiKey, name: 'TTS API Key' }
        ];

        for (const field of required) {
            if (!field.el.value) {
                return { valid: false, error: `Please select ${field.name}` };
            }
        }

        return { valid: true };
    }

    handleStart() {
        const validation = this.validate();
        if (!validation.valid) {
            if (this.onErrorCallback) {
                this.onErrorCallback(validation.error);
            }
            return;
        }

        this.config = {
            stt_provider: this.elements.sttProvider.value,
            stt_api_key: this.elements.sttApiKey.value,
            stt_settings: {
                language: this.elements.sttLanguage.value
            },
            llm_provider: this.elements.llmProvider.value,
            llm_api_key: this.elements.llmApiKey.value,
            llm_settings: {
                model: this.elements.llmModel.value,
                temperature: parseFloat(this.elements.llmTemperature.value)
            },
            system_prompt: this.elements.systemPrompt.value || 'You are a helpful assistant.',
            tts_provider: this.elements.ttsProvider.value,
            tts_api_key: this.elements.ttsApiKey.value,
            tts_settings: {
                voice_id: this.elements.ttsVoice.value || 'male-qn-qingse',
                speed: parseFloat(this.elements.ttsSpeed.value)
            }
        };

        sessionStorage.setItem('avatar-config', JSON.stringify(this.config));

        if (this.onConfigReadyCallback) {
            this.onConfigReadyCallback(this.config);
        }
    }

    loadFromSession() {
        const saved = sessionStorage.getItem('avatar-config');
        if (saved) {
            try {
                const config = JSON.parse(saved);
                this.elements.sttProvider.value = config.stt_provider || '';
                this.elements.sttApiKey.value = config.stt_api_key || '';
                this.elements.sttLanguage.value = config.stt_settings?.language || 'en';
                this.elements.llmProvider.value = config.llm_provider || '';
                this.elements.llmApiKey.value = config.llm_api_key || '';
                this.elements.llmModel.value = config.llm_settings?.model || 'gpt-4o';
                this.elements.systemPrompt.value = config.system_prompt || '';
                this.elements.llmTemperature.value = config.llm_settings?.temperature || 0.7;
                this.elements.tempValue.textContent = this.elements.llmTemperature.value;
                this.elements.ttsProvider.value = config.tts_provider || '';
                this.elements.ttsApiKey.value = config.tts_api_key || '';
                this.elements.ttsVoice.value = config.tts_settings?.voice_id || '';
                this.elements.ttsSpeed.value = config.tts_settings?.speed || 1.0;
                this.elements.speedValue.textContent = this.elements.ttsSpeed.value;
                return config;
            } catch (e) {
                console.error('Failed to load config from session:', e);
            }
        }
        return null;
    }

    setOnConfigReady(callback) {
        this.onConfigReadyCallback = callback;
    }

    setOnError(callback) {
        this.onErrorCallback = callback;
    }

    getConfig() {
        return this.config;
    }

    showPanel() {
        const panel = document.getElementById('config-panel');
        if (panel) {
            panel.classList.remove('hidden');
        }
    }

    hidePanel() {
        const panel = document.getElementById('config-panel');
        if (panel) {
            panel.classList.add('hidden');
        }
    }
}