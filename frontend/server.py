"""
Servidor HTTP simples para o frontend.
Uso: python server.py
Acesse: http://localhost:5500
"""
import http.server
import socketserver
import os

PORT = 5500
os.chdir(os.path.dirname(os.path.abspath(__file__)))

Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({'.js': 'application/javascript'})

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Frontend rodando em http://localhost:{PORT}")
    print("Ctrl+C para parar")
    httpd.serve_forever()
