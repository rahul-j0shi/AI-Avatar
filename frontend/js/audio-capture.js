export class AudioCapture {
    constructor() {
        this.audioContext = null;
        this.mediaStream = null;
        this.processor = null;
        this.isCapturing = false;
        this.onAudioBlobCallback = null;
        this.silenceThreshold = 0.02;
        this.silenceDuration = 500;
        this.lastSoundTime = 0;
        this.buffer = [];
    }

    async init() {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000
                }
            });

            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });

            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            
            this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            this.processor.onaudioprocess = (e) => {
                if (!this.isCapturing) return;
                
                const inputData = e.inputBuffer.getChannelData(0);
                const result = this.analyzeAudio(inputData);
                
                if (result.hasSound) {
                    this.lastSoundTime = Date.now();
                    this.buffer.push(new Float32Array(inputData));
                }
                
                if (this.buffer.length > 0 && Date.now() - this.lastSoundTime > this.silenceDuration) {
                    this.sendBuffer();
                }
            };

            source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);

            return true;
        } catch (error) {
            console.error('Error initializing audio capture:', error);
            return false;
        }
    }

    analyzeAudio(audioData) {
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += Math.abs(audioData[i]);
        }
        const average = sum / audioData.length;
        
        return {
            hasSound: average > this.silenceThreshold,
            amplitude: average
        };
    }

    sendBuffer() {
        if (this.buffer.length === 0) return;

        const totalLength = this.buffer.reduce((sum, arr) => sum + arr.length, 0);
        const combined = new Float32Array(totalLength);
        let offset = 0;
        
        for (const arr of this.buffer) {
            combined.set(arr, offset);
            offset += arr.length;
        }

        this.buffer = [];

        const wav = this.encodeWAV(combined);
        
        if (this.onAudioBlobCallback) {
            this.onAudioBlobCallback(wav);
        }
    }

    encodeWAV(samples) {
        const sampleRate = 16000;
        const numChannels = 1;
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = samples.length * bytesPerSample;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        const offset = 44;
        for (let i = 0; i < samples.length; i++) {
            const sample = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    start() {
        this.isCapturing = true;
    }

    stop() {
        this.isCapturing = false;
        if (this.buffer.length > 0) {
            this.sendBuffer();
        }
    }

    cleanup() {
        this.stop();
        if (this.processor) {
            this.processor.disconnect();
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }

    setOnAudioBlob(callback) {
        this.onAudioBlobCallback = callback;
    }
}