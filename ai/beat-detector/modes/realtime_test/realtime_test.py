"""Main entrypoint for realtime test mode"""

from lib.log import logline, error, enter_group, exit_group
from http.server import BaseHTTPRequestHandler, HTTPServer
from ..model import create_model, apply_weights
from lib.io import IO, IOInput
from typing import List
from glob import glob
import SocketServer

def get_io() -> IO:
    return IO(
        {
            "p": IOInput(
                1234,
				int,
				has_input=True,
				arg_name="port",
				descr="The port on which to host it",
				alias="port"
            ),
			# TODO: maybe remove N?
            "n": IOInput(
                50,
                int,
                has_input=True,
                arg_name="interval",
                descr="Interval at which data is sent",
                alias="interval"
            )
        }
    )

class WebServer(BaseHTTPRequestHandler):
	def do_GET(self):
		pass

	def do_post(self):
		pass


def start_server(io: IO):
	port = io.get("port")
	httpd = WebServer(HTTPServer, ('', port))
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
    model = create_model(1)

    logline("applying learned weights")
    model = apply_weights(model, io.get("input_weights"))

	start_server(io)

	# TODO: start server
	# TODO: create some API endpoint
