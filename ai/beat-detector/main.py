#!/usr/bin/python
"""Main file used for launching everything"""

from lib.log import error, logline
from modes import mode_preprocess
import sys


def run_mode(mode):
    if mode == "preprocess":
        return mode_preprocess()
    elif mode == "train":
        error("not implemented")
        # TODO: implement
    elif mode == "test":
        error("not implemented")
        # TODO: implement
    elif mode == "realtime_test":
        error("not implemented")
        # TODO: implement
    else:
        if mode == "":
            logline("No mode supplied. Choose one of:")
        else:
            logline("Unknown mode. Choose one of:")
        logline("")
        logline("\tpreprocess	- preprocess and extract features")
        logline("\ttrain		- train on given features")
        logline("\ttest		- test trained model")
        logline("\trealtime_test	- do a realtime test by listening to music")
        return 1


def get_mode():
    if len(sys.argv) > 1:
        return sys.argv[1]
    return ""


def main():
    return run_mode(get_mode())


if __name__ == "__main__":
    exit(main())
