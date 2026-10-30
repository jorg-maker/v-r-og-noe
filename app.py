from collections import OrderedDict
import json
import os
import ssl
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from time import monotonic
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).parent
HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "8000"))
USER_AGENT = os.environ.get("WEATHER_USER_AGENT", "VaerSiden/1.0")
CERT_FILE = Path(os.environ.get("HTTPS_CERT_FILE", ROOT / "certs" / "localhost.pem"))
KEY_FILE = Path(os.environ.get("HTTPS_KEY_FILE", ROOT / "certs" / "localhost-key.pem"))
SEARCH_CACHE_TTL = 24 * 60 * 60
WEATHER_CACHE_TTL = 10 * 60
API_CACHE_MAX_ENTRIES = 128

api_cache: OrderedDict[str, tuple[float, dict[str, Any]]] = OrderedDict()
api_cache_lock = Lock()


def create_ssl_context():
    context = ssl.create_default_context()
    if sys.platform == "win32" and hasattr(ssl, "enum_certificates"):
        certificates = [
            ssl.DER_cert_to_PEM_cert(certificate)
            for certificate, encoding, _ in ssl.enum_certificates("ROOT")
            if encoding == "x509_asn"
        ]
        if certificates:
            context.load_verify_locations(cadata="".join(certificates))
    return context


SSL_CONTEXT = create_ssl_context()


def fetch_json(url):
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=15, context=SSL_CONTEXT) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_cached_json(url, ttl_seconds):
    now = monotonic()
    with api_cache_lock:
        cached = api_cache.get(url)
        if cached is not None:
            expires_at, payload = cached
            if expires_at > now:
                api_cache.move_to_end(url)
                return payload, True
            del api_cache[url]

    payload = fetch_json(url)
    with api_cache_lock:
        cached = api_cache.get(url)
        if cached is not None and cached[0] > monotonic():
            api_cache.move_to_end(url)
            return cached[1], True

        api_cache[url] = (monotonic() + ttl_seconds, payload)
        api_cache.move_to_end(url)
        while len(api_cache) > API_CACHE_MAX_ENTRIES:
            api_cache.popitem(last=False)
    return payload, False


def find_places(query):
    url = "https://geocoding-api.open-meteo.com/v1/search?" + urlencode(
        {"name": query, "count": 6, "language": "no", "format": "json"}
    )
    result, cache_hit = fetch_cached_json(url, SEARCH_CACHE_TTL)
    places = [
        {
            "name": place["name"],
            "admin1": place.get("admin1", ""),
            "country": place.get("country", ""),
            "latitude": place["latitude"],
            "longitude": place["longitude"],
        }
        for place in result.get("results", [])
    ]
    return places, cache_hit


def get_weather(latitude, longitude):
    url = "https://api.met.no/weatherapi/locationforecast/2.0/compact?" + urlencode(
        {"lat": latitude, "lon": longitude}
    )
    return fetch_cached_json(url, WEATHER_CACHE_TTL)


class WeatherHandler(BaseHTTPRequestHandler):
    def send_json(self, status, payload, cache_seconds=0, cache_hit=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        cache_control = f"private, max-age={cache_seconds}" if cache_seconds else "no-store"
        self.send_header("Cache-Control", cache_control)
        if cache_hit is not None:
            self.send_header("X-Cache", "HIT" if cache_hit else "MISS")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/api/search":
            query = params.get("q", [""])[0].strip()
            if len(query) < 2:
                self.send_json(400, {"error": "Skriv minst to bokstaver for å søke."})
                return
            try:
                places, cache_hit = find_places(query)
                self.send_json(
                    200,
                    {"results": places},
                    cache_seconds=SEARCH_CACHE_TTL,
                    cache_hit=cache_hit,
                )
            except (HTTPError, URLError, TimeoutError, ValueError) as error:
                self.send_json(502, {"error": f"Stedssøket er utilgjengelig akkurat nå: {error}"})
            return

        if parsed.path == "/api/weather":
            try:
                latitude = float(params.get("lat", [""])[0])
                longitude = float(params.get("lon", [""])[0])
            except ValueError:
                self.send_json(400, {"error": "Ugyldige koordinater."})
                return
            if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                self.send_json(400, {"error": "Koordinatene er utenfor gyldig område."})
                return
            try:
                payload, cache_hit = get_weather(latitude, longitude)
                self.send_json(
                    200,
                    payload,
                    cache_seconds=WEATHER_CACHE_TTL,
                    cache_hit=cache_hit,
                )
            except (HTTPError, URLError, TimeoutError, ValueError) as error:
                self.send_json(502, {"error": f"Værdata er utilgjengelig akkurat nå: {error}"})
            return

        if parsed.path == "/" or parsed.path == "/index.html":
            self.send_file("index.html", "text/html; charset=utf-8")
        elif parsed.path == "/style.css":
            self.send_file("style.css", "text/css; charset=utf-8")
        elif parsed.path == "/app.js":
            self.send_file("app.js", "text/javascript; charset=utf-8")
        else:
            self.send_json(404, {"error": "Fant ikke siden."})

    def send_file(self, filename, content_type):
        body = (ROOT / filename).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "private, max-age=3600")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format_string, *args):
        print(f"{self.address_string()} - {format_string % args}")


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), WeatherHandler)
    try:
        tls_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        tls_context.load_cert_chain(certfile=CERT_FILE, keyfile=KEY_FILE)
        server.socket = tls_context.wrap_socket(server.socket, server_side=True)
        print(f"Værsiden kjører på https://localhost:{PORT}")
        server.serve_forever()
    except FileNotFoundError as error:
        raise SystemExit(
            "HTTPS-sertifikat mangler. Kjør .\\setup-https.ps1 først."
        ) from error
    except KeyboardInterrupt:
        print("\nStopper værsiden.")
    finally:
        server.server_close()
