export class WebSocketClient {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.onMessageCallback = null;
        this.onOpenCallback = null;
        this.onCloseCallback = null;
        this.onErrorCallback = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.shouldReconnect = false;
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);

                this.ws.onopen = () => {
                    console.log('WebSocket connected');
                    this.reconnectAttempts = 0;
                    if (this.onOpenCallback) {
                        this.onOpenCallback();
                    }
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    if (this.onMessageCallback) {
                        this.onMessageCallback(event);
                    }
                };

                this.ws.onclose = () => {
                    console.log('WebSocket closed');
                    if (this.onCloseCallback) {
                        this.onCloseCallback();
                    }
                    if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
                        setTimeout(() => this.connect(), this.reconnectDelay);
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    if (this.onErrorCallback) {
                        this.onErrorCallback(error);
                    }
                    reject(error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        } else {
            console.error('WebSocket not connected');
        }
    }

    sendJson(obj) {
        this.send(JSON.stringify(obj));
    }

    sendBinary(blob) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(blob);
        } else {
            console.error('WebSocket not connected');
        }
    }

    close() {
        this.shouldReconnect = false;
        if (this.ws) {
            this.ws.close();
        }
    }

    setOnMessage(callback) {
        this.onMessageCallback = callback;
    }

    setOnOpen(callback) {
        this.onOpenCallback = callback;
    }

    setOnClose(callback) {
        this.onCloseCallback = callback;
    }

    setOnError(callback) {
        this.onErrorCallback = callback;
    }

    setReconnect(shouldReconnect) {
        this.shouldReconnect = shouldReconnect;
    }

    parseMessage(event) {
        if (event.data instanceof Blob || typeof event.data === 'object') {
            return { type: 'binary', data: event.data };
        }
        try {
            return JSON.parse(event.data);
        } catch (e) {
            return null;
        }
    }
}