from typing import List, Union, Dict
import numpy as np

# Interval in milliseconds
INTERVAL = 50

# The amount of bins into which the sound spectrum is divided
BINS = 100

# Padding from spectrum description
FEATURE_LEN = 1 + 1 + BINS

# one for is_beat and one for is_melody
OUT_VEC_SIZE = 2

BEAT_MIN = 0.5
MELODY_MIN = 0.5


class Features:
    """A set of features describing one time unit of sound"""

    def __init__(self, hard: int, uptempo: int, spectrum_bins: List[float]):
        self.hard = hard
        self.uptemo = uptempo
        self.spectrum_bins = spectrum_bins

    def to_arr(self) -> List[Union[int, float]]:
        """A feature array"""
        return [self.hard, self.uptemo] + self.spectrum_bins

    @staticmethod
    def length():
        return FEATURE_LEN


class ExpectedOutput:
    """A class describing the expected output at a given time unit of sound"""

    def __init__(self, is_beat: bool, is_melody: bool):
        self.is_beat = is_beat
        self.is_melody = is_melody

    def to_arr(self):
        """Convert to an array"""
        return [int(self.is_beat), int(self.is_melody)]


class Preprocessed:
    """Preprocessed data"""

    def __init__(self, preprocessed_json: Dict[str, Union[str, List[float], List[int]]]):
        self.file_name = self._get_file_name(preprocessed_json)
        self.features = self._get_features(preprocessed_json)
        self.outputs = self._get_outputs(preprocessed_json)

        assert np.array(self.features).shape[1] == Features.length()
        assert np.array(self.outputs).shape[1] == OUT_VEC_SIZE

    def _get_file_name(self, preprocessed_json: Dict[str, Union[str, List[float], List[int]]]) -> str:
        return preprocessed_json["file_name"]

    def _get_features(self, preprocessed_json: Dict[str, Union[str, List[float], List[int]]]) -> List[float]:
        return preprocessed_json["features"]

    def _get_outputs(self, preprocessed_json: Dict[str, Union[str, List[float], List[int]]]) -> List[int]:
        return preprocessed_json["outputs"]


def is_positive_beat(value: float):
    return value > BEAT_MIN


def is_positive_melody(value: float):
    return value > MELODY_MIN
