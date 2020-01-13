from pydub import AudioSegment
from typing import List, Any
import sys

# Max time is 6 seconds
SEGMENT_SIZE = 600 * 1000


def load_song():
    if len(sys.argv) <= 1:
        print("Please supply input song")
        sys.exit(1)
    return AudioSegment.from_wav(sys.argv[1])


def slice_song(song: Any) -> List[AudioSegment]:
    parts = []
    while len(song) > SEGMENT_SIZE:
        parts.append(song[:SEGMENT_SIZE])
        song = song[SEGMENT_SIZE:]
    parts.append(song)
    return parts


def write_song(slices: List[AudioSegment]):
    name = sys.argv[1]
    no_extension = ".".join(name.split(".")[:-1])

    for i in range(len(slices)):
        audio_slice = slices[i]
        export_name = "{}.{}.wav".format(no_extension, i)
        audio_slice.export(export_name, format="wav")
        print("Wrote {}".format(export_name))


def main():
    print("Loading song")
    song = load_song()
    print("Slicing song")
    slices = slice_song(song)
    print("Writing parts")
    write_song(slices)
    print("Done!")


if __name__ == "__main__":
    main()
