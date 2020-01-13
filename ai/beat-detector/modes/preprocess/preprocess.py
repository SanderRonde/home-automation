"""Main entrypoint for mode_preprocess mode"""

from .files import get_files, collect_input_paths, MarkedAudioFile
from lib.log import logline, error, enter_group, exit_group
from typing import List, Union, Dict, Any
from lib.io import IO, IOInput
from lib.timer import Timer
from glob import glob
import pickle
import time
import sys

# Take a (somehow) set of wav files, each
# annotated by a JSON file containing an array
# of "beats". Each beat is marked at a given time
# for a given length and a "type" of this beat.
# It can either be a beat beat or a melody-type beat
# Use of those two is yet to be determined but it's
# handy to train on it

# Interval in milliseconds
INTERVAL = 50
# The amount of bins in which the sound spectrum is divided
BINS = 100


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
                "./preprocessed.pickle",
                str,
                has_input=True,
                arg_name="output_file",
                descr="File in which the features and outputs get placed",
                alias="output_file",
            ),
        }
    )


class Features:
    """A set of features describing one time unit of sound"""

    def __init__(self, hard: int, uptempo: int, spectrum_bins: List[float]):
        self.hard = hard
        self.uptemo = uptempo
        self.spectrum_bins = spectrum_bins

        self.length = 1 + 1 + BINS

    def to_arr(self) -> List[Union[int, float]]:
        """A feature array"""
        return [self.hard, self.uptemo] + self.spectrum_bins


class ExpectedOutput:
    """A class describing the expected output at a given time unit of sound"""

    def __init__(self, is_beat: bool, is_melody: bool):
        self.is_beat = is_beat
        self.is_melody = is_melody

    def to_arr(self):
        """Convert to an array"""
        return [int(self.is_beat), int(self.is_melody)]


def gen_features(file: MarkedAudioFile) -> Features:
    """Gen features based on the file"""
    hard = file.json_file.genre.hard
    uptempo = file.json_file.genre.uptempo
    bins = file.bins_file.bins
    return Features(hard, uptempo, bins)


def get_closest(timestamp_time: int) -> int:
    """Get the closest multiple of INTERVAL to the timestamp"""
    lowerbound = (timestamp_time // INTERVAL) * INTERVAL
    upperbound = lowerbound + INTERVAL

    lowerbound_diff = timestamp_time - lowerbound
    upperbound_diff = upperbound - timestamp_time

    return lowerbound if lowerbound_diff <= upperbound_diff else upperbound


def gen_outputs(file: MarkedAudioFile) -> List[ExpectedOutput]:
    """Gen a list of marked outputs for given file"""
    out_len = len(file.bins_file.bins)
    outputs = [ExpectedOutput(False, False) for x in range(out_len)]

    for timestamp in file.json_file.timestamps:
        # Round it to the range
        timestamp_time = timestamp.timestamp * 1000
        closest = get_closest(timestamp_time)

        timestamp_index = int(closest / INTERVAL)

        if timestamp_index >= out_len:
            continue
        
        if timestamp.beat_type == "beat":
            output_mark = outputs[timestamp_index]
            output_mark.is_beat = True
        elif timestamp.beat_type == "melody":
            closest_end = get_closest(timestamp_time + (timestamp.length * 1000))
            for i in range(int((closest_end - closest) / INTERVAL)):
                outputs[timestamp_index + i].is_melody = True
        
    return outputs



def mode_preprocess():
    """The main preprocessing entrypoint"""
    start_time = time.time()

    preprocessed = []

    io = get_io()
    logline("preprocessing")
    enter_group()
    logline("reading input paths")
    enter_group()

    input_paths = collect_input_paths(io)
    for input_path in input_paths:
        logline("found path: {}".format(input_path))

    exit_group()

    logline("iterating files")
    enter_group()
    for file in get_files(input_paths):
        if not file:
            error("no files")
            return None

        features = gen_features(file)
        outputs = gen_outputs(file)
        
        preprocessed.append({
            "file_name": file.name,
            "features": features.to_arr(),
            "outputs": list(map(lambda x: x.to_arr(), outputs))
        })
        logline("done with file: {}".format(file.name))
    exit_group()
    logline("done iterating files")
    
    with open(io.get("output_file"), "wb+") as file:
        pickle.dump(preprocessed, file)
        logline("wrote output to file: {}".format(io.get("output_file")))
    
    exit_group()
    logline("done preprocessing, runtime is {}".format(Timer.stringify_time(Timer.format_time(time.time() - start_time))))
