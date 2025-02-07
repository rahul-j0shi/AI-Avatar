from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import requests
from urllib.parse import urlparse, parse_qs

class CustomHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.google_api_key = "AIzaSyCwq17UInLhZhqE-L3xyrWw5CRSlO1OJJ4"  # Your API key
        super().__init__(*args, **kwargs)

    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            request_json = json.loads(post_data)
            
            # Forward request to Google's API
            google_url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={self.google_api_key}"
            response = requests.post(
                google_url,
                json=request_json,
                headers={'Content-Type': 'application/json'}
            )
            
            # Send response back to browser
            self.send_response(response.status_code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response.content)
            
        except Exception as e:
            print(f"Error: {str(e)}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        return SimpleHTTPRequestHandler.do_GET(self)

def run_server():
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, CustomHandler)
    print("Server running on http://localhost:8000")
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()