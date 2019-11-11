"""Main entrypoint for features mode"""

from .files import read_input_files
from typing import List, Union, Dict, Any
from lib.io import IO, IOInput

# Take a (somehow) set of wav files, each
# annotated by a JSON file containing an array
# of "beats". Each beat is marked at a given time
# for a given length and a "type" of this beat.
# It can either be a beat beat or a melody-type beat
# Use of those two is yet to be determined but it's
# handy to train on it



def get_io() -> IO:
    return IO(
        {
            "i": IOInput(
                glob("./*.wav"),
                list,
                has_input=True,
                arg_name="input_files",
                descr="Input .wav files",
                alias="input_files",
                is_generic=True,
            ),
            "o": IOInput(
                "./features",
                str,
                has_input=True,
                arg_name="output_dir",
                descr="Directory in which the features get placed",
                alias="output_dir",
            ),
        }
    )



def mode_features():
    io = get_io()
    with read_input_files(io) as input_files:
        if not input_files:
            return None
        pass

