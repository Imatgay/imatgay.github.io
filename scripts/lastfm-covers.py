"""Serve or export artwork from the top 100 Last.fm albums."""

import argparse
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from time import monotonic
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen


def album_covers(albums):
    covers = {}
    for entry in albums:
        album = entry["name"]
        artist = entry["artist"]["name"]
        image = next((item["#text"] for item in reversed(entry["image"]) if item["#text"]), "")
        url = urlsplit(image)
        if url.scheme != "https" or url.hostname not in {
            "lastfm-img.freetls.fastly.net",
            "lastfm.freetls.fastly.net",
        }:
            continue
        if album and artist and "2a96cbd8b46e442fc41c2b86b821562f" not in url.path:
            cover = {"title": f"{album} by {artist}", "image": image}
            if album.casefold() == "my beautiful dark twisted fantasy" and artist.casefold() == "kanye west":
                cover["pixelated"] = True
            covers.setdefault((artist, album), cover)
    return list(covers.values())


def top_covers(key):
    query = urlencode({
        "method": "user.gettopalbums",
        "user": "mg_james",
        "api_key": key,
        "format": "json",
        "limit": 100,
        "period": "3month",
    })
    try:
        request = Request(
            f"https://ws.audioscrobbler.com/2.0/?{query}",
            headers={"User-Agent": "imatgay.github.io album slideshow"},
        )
        with urlopen(request, timeout=15) as response:
            albums = json.load(response)["topalbums"]["album"]
        covers = album_covers(albums)
    except HTTPError as error:
        raise RuntimeError(f"Last.fm returned HTTP {error.code}.") from None
    except (OSError, ValueError, KeyError, TypeError):
        raise RuntimeError("Could not read top albums from Last.fm.") from None

    if not covers:
        raise RuntimeError("Last.fm returned no usable album covers.")

    return covers


def serve(key, port):
    cached_covers = None
    refresh_at = 0
    lock = Lock()

    class PreviewHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory="public", **kwargs)

        def do_GET(self):
            nonlocal cached_covers, refresh_at
            if urlsplit(self.path).path != "/writing/album-covers.json":
                return super().do_GET()

            with lock:
                if monotonic() >= refresh_at:
                    try:
                        cached_covers = top_covers(key)
                    except RuntimeError as error:
                        self.log_error("%s", error)
                        refresh_at = monotonic() + 60
                    else:
                        refresh_at = monotonic() + 7 * 24 * 60 * 60
                covers = cached_covers

            data = json.dumps(covers or []).encode()
            self.send_response(200 if covers else 503)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

    with ThreadingHTTPServer(("127.0.0.1", port), PreviewHandler) as server:
        print(f"Listening on http://127.0.0.1:{port}/writing/", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serve", type=int, metavar="PORT")
    options = parser.parse_args()
    key = os.environ.get("LASTFM_API_KEY")
    if not key:
        raise SystemExit("Set LASTFM_API_KEY to generate the album slideshow.")
    if options.serve is not None:
        serve(key, options.serve)
        raise SystemExit

    try:
        covers = top_covers(key)
    except RuntimeError as error:
        raise SystemExit(str(error)) from None
    Path("public/writing/album-covers.json").write_text(json.dumps(covers), encoding="utf-8")
