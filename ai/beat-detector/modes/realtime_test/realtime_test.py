"""Main entrypoint for realtime test mode"""

from http.server import SimpleHTTPRequestHandler, HTTPServer
from lib.log import logline, enter_group, exit_group
from ..model import create_model, apply_weights
from lib.io import IO, IOInput
from functools import partial
from http import HTTPStatus
from typing import Any
import youtube_dl
import json
import os

CUR_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)))


def get_io() -> IO:
    return IO(
        {
            "p": IOInput(
                1234, int, has_input=True, arg_name="port", descr="The port on which to host it", alias="port"
            ),
            "n": IOInput(
                50, int, has_input=True, arg_name="interval", descr="Interval at which data is sent", alias="interval"
            ),
        }
    )


interval: int = 100
model = None


class WebServer(SimpleHTTPRequestHandler):
    def get_public_url(self, url: str):
        return "/files/{}.mp3".format(url)

    def dl_exists(self, url: str):
        return os.path.isfile(os.path.join(CUR_DIR, "public/files", "{}.mp3".format(url)))

    def download_url(self, url: str):
        dl = youtube_dl.YoutubeDL(
            {
                "format": "bestaudio",
                "outtmpl": os.path.join(CUR_DIR, "public/files/{}.mp3".format(url)),
                "verbose": True,
            }
        )
        print("Starting download")
        dl.download([url])

    def parse_json(self):
        length = int(self.headers["Content-Length"])
        return json.loads(self.rfile.read(length))

    def respond_json(self, data: Any, status=HTTPStatus.OK):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        content = json.dumps(data).encode("utf8")
        self.send_header("Content-Length", len(content))
        self.end_headers()
        self.wfile.write(content)

    def handle_api(self):
        if self.path.startswith("/api/beat"):
            self.parse_json()
            # TODO: make prediction
        elif self.path.startswith("/api/dl"):
            url = self.parse_json()["url"]
            if self.dl_exists(url):
                return self.respond_json({"done": True, "url": self.get_public_url(url)})
            self.download_url(url)
            self.respond_json({"status": "downloading"})
        elif self.path.startswith("/api/dlReady"):
            url = self.parse_json()["url"]
            exists = self.dl_exists(url)
            self.respond_json({"done": exists, "url": self.get_public_url(url)})
        elif self.path.startswith("/api/interval"):
            self.respond_json({"interval": interval})
        else:
            self.respond_json({"?": "?"}, 404)

    def do_POST(self):
        path = self.path
        if path.startswith("/api"):
            return self.handle_api()

        self.respond_json({"?": "?"}, 404)


def start_server(io: IO):
    global interval
    interval = io.get("interval")

    port = io.get("port")
    httpd = HTTPServer(("", port), partial(WebServer, directory=os.path.join(CUR_DIR, "public")))
    logline("listening at port", port)
    enter_group()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    exit_group()
    logline("stopped listening")


def mode_realtime_test():
    """The main realtime test entrypoint"""
    io = get_io()

    logline("realtime test")
    enter_group()

    logline("reconstructing model")
    global model
    model = create_model(1)

    logline("applying learned weights")
    model = apply_weights(model, io)

    start_server(io)
