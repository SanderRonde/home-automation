from typing import List, Union, Dict, Any, Iterable
from lib.io import IO
from os import path
import wave
import json


class JSONTimestamp:
    """A single beat"""

    def __init__(self, json_obj: Dict[str, Any]):
        self._json_obj = json_obj

    @property
    def timestamp(self) -> float:
        """When this beat happened"""
        return self._json_obj["time"]

    @property
    def length(self) -> float:
        """How long this beat lasted"""
        return self._json_obj["duration"]

    @property
    def beat_type(self) -> str:
        """The type of beat"""
        return self._json_obj["type"]


class JSONGenre:
    """A genre descriptor"""

    def __init__(self, json_obj: Dict[str, float]):
        self._json_obj = json_obj

    @property
    def hard(self) -> float:
        """How hard this song is"""
        return self._json_obj["hard"]

    @property
    def uptempo(self) -> float:
        """How uptempo this song is"""
        return self._json_obj["uptempo"]


class JSONDescriptor:
    """A json descriptor of a song"""

    def __init__(self, json_obj: List[Any]):
        self.timestamps = self._get_timestamps(json_obj["items"])
        self.genre = self._get_genre(json_obj["genre"])
        self.has_melody = not json_obj["nomelody"] if "nomelody" in json_obj else True

    def _get_genre(self, genre: Dict[str, float]) -> JSONGenre:
        return JSONGenre(genre)

    def _get_timestamps(self, items: List[Any]) -> List[JSONTimestamp]:
        return list(map(lambda x: JSONTimestamp(x), items))


class BinsDescriptor:
    """A descriptor for the bins file"""

    def __init__(self, json_obj: List[List[float]]):
        self.bins = json_obj


class MarkedAudioFile:
    """A single marked audio file"""

    def __init__(self, wav_path: str):
        self.base_name = ".".join(wav_path.split(".")[0:-1])
        self.name = self.base_name.split("/")[-1]

        self.wav_file = self._get_wav_file(wav_path)
        self.bins_file = self._get_bins_file(wav_path)
        try:
            self.json_file = self._get_json_file(wav_path)
        except Exception as e:
            self.wav_file.close()
            raise e

    def _get_wav_file(self, wav_path: str) -> wave.Wave_read:
        return wave.open(wav_path, "rb")

    def _get_json_file(self, wav_path: str) -> JSONDescriptor:
        json_path = "{}.json".format(self.base_name)
        with open(json_path, "rb") as json_str:
            return JSONDescriptor(json.load(json_str))

    def _get_bins_file(self, wav_path: str) -> BinsDescriptor:
        json_path = "{}.bins.json".format(self.base_name)
        with open(json_path, "rb") as json_str:
            return BinsDescriptor(json.load(json_str))

    def close(self):
        self.wav_file.close()


def has_json_file(in_file: str) -> bool:
    """Check whether given .wav file has an associated .json file"""
    base = ".".join(in_file.split(".")[0:-1])
    json_file = "{}.json".format(base)
    if not path.exists(json_file) or not path.isfile(json_file):
        return False
    return True


def collect_input_paths(io: IO) -> Union[None, List[str]]:
    """Turn the input glob into file paths"""
    all_files = io.get("input_files")
    wav_files = list(filter(lambda in_file: in_file.split(".")[-1] == "wav", all_files))

    if len(wav_files) == 0:
        print("No input files")
        return None

    annotated_files = list(filter(has_json_file, wav_files))

    return annotated_files


def get_files(input_paths: List[str]) -> Iterable[MarkedAudioFile]:
    """Read all input files"""
    for in_file in input_paths:
        yield MarkedAudioFile(in_file)
