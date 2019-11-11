from typing import List, Union, Dict, Any
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
		return self._json_obj["timestamp"]

	@property
	def length(self) -> float:
		"""How long this beat lasted"""
		return self._json_obj["length"]

	@property
	def beat_type(self) -> int:
		"""The type of beat"""
		return self._json_obj["type"]


class JSONDescriptor:
	"""An array of timestamped beat moments"""

	def __init__(self, json_obj: List[Any]):
		assert (type(json_obj) == list, "json object is not an array")
		self.timestamps = self._get_timestamps()

	def _get_timestamps(self, json_obj: List[Any]) -> List[JSONTimestamp]:
		return list(map(lambda x: JSONTimestamp(x), json_obj))


class MarkedAudioFile:
	"""A single marked audio file"""
	def __init__(self, wav_path: str):
		self.wav_file = self._get_wav_file(wav_path)
		try:
			self.json_file = self._get_json_File(wav_path)
		except Exception as e:
			self.wav_file.close()
			raise e

	def _get_wav_file(self, wav_path: str) -> wave.Wave_read:
		return wave.open(wav_path, "rb")

	def _get_json_file(self, wav_path: str) -> JSONDescriptor:
		base = ".".join(wav_path.split(".")[0:-1])
		json_path = "{}.json".format(base)
		with open(json_path, "rb") as json_str:
			return JSONDescriptor(json.load(json_str))

	def close(self):
		self.wav_file.close()

def collect_input_paths(io: IO) -> Union[None, List[str]]:
	all_files = io.get("input_files")
	wav_files = list(filter(lambda in_file: in_file.split(".")[-1] == "wav", all_files))

	if len(wav_files) == 0:
		print("No input files")
		return None

	# Check if there's a .json file for every wav file
	for in_file in wav_files:
		base = ".".join(in_file.split(".")[0:-1])
		json_file = "{}.json".format(base)
		print(json_file)
		if not path.exists(json_file) or not path.isfile(json_file):
			print('File "{}" is missing JSON annotation file'.format(in_file))
			return None
	return wav_files


def _read_input_files(io: IO) -> List[MarkedAudioFile]:
	input_paths = collect_input_paths(io)
	if not input_paths:
		return None

	audio_files = list()
	for in_file in input_paths:
		try:
			audio_files.append(MarkedAudioFile(in_file))
		except Exception as e:
			# Close remaining files
			for audio_file in audio_files:
				audio_file.close()
			raise e
	return audio_files

class read_input_files:
	def __enter__(self, io: IO) -> List[MarkedAudioFile]:
		return _read_input_files(io)
	def __exit__(self, type, value, traceback):
		tear things down




def close_input_files(files: List[MarkedAudioFile]):
	for audio_file in files:
		audio_file.close()
