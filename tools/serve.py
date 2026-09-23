#!/usr/bin/env python3
"""Tiny static server for Noman_trading.

Threaded so the browser can pull the CSS, JS and data in parallel, and gzip
compressed so the 3.8 MB dataset crosses the wire in a few hundred KB.

    python tools/serve.py 8899        # then open http://localhost:8899/
"""
import gzip
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
GZ = ("text/", "application/javascript", "application/json", "image/svg+xml", "application/xml")


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _serve(self, head_only=False):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            path = os.path.join(path, "index.html")
        if not os.path.isfile(path):
            self.send_error(404, "Not found")
            return
        ctype = self.guess_type(path)
        with open(path, "rb") as fh:
            body = fh.read()
        extra = {}
        if any(ctype.startswith(t) or ctype == t for t in GZ) and "gzip" in (self.headers.get("Accept-Encoding") or ""):
            body = gzip.compress(body, 6)
            extra["Content-Encoding"] = "gzip"
            extra["Vary"] = "Accept-Encoding"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=300")
        for key, value in extra.items():
            self.send_header(key, value)
        self.end_headers()
        if not head_only:
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def do_GET(self):
        self._serve()

    def do_HEAD(self):
        self._serve(head_only=True)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print("Noman_trading serving %s on http://localhost:%d/  (Ctrl+C to stop)" % (ROOT, PORT))
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
