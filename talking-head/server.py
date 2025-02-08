from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import requests
from urllib.parse import urlparse, parse_qs

# This will store our latest LLM response
latest_response = None

class CustomHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.google_api_key = "GCP-API-KEY"  
        super().__init__(*args, **kwargs)

    def do_POST(self):
        # Handle existing TTS functionality
        if self.path == "/tts":
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length).decode('utf-8')
                request_json = json.loads(post_data)
                
                google_url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={self.google_api_key}"
                response = requests.post(
                    google_url,
                    json=request_json,
                    headers={'Content-Type': 'application/json'}
                )
                
                self.send_response(response.status_code)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(response.content)
                
            except Exception as e:
                print(f"Error: {str(e)}")
                self.send_error_response(str(e))
        
        # New endpoint to receive LLM response
        elif self.path == "/set_response":
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length).decode('utf-8')
                request_json = json.loads(post_data)
                
                # Store the response globally
                global latest_response
                latest_response = request_json.get('text', '')
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ok"}).encode())
                
            except Exception as e:
                print(f"Error: {str(e)}")
                self.send_error_response(str(e))

    def do_GET(self):
        # New endpoint to get latest LLM response
        if self.path == "/get_response":
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            global latest_response
            response_data = {
                "text": latest_response,
                "hasNew": latest_response is not None
            }
            self.wfile.write(json.dumps(response_data).encode())
            # Clear the response after sending
            latest_response = None
            return
            
        return SimpleHTTPRequestHandler.do_GET(self)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def send_error_response(self, error_message):
        self.send_response(500)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({'error': str(error_message)}).encode())

def run_server():
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, CustomHandler)
    print("Server running on http://localhost:8000")
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()