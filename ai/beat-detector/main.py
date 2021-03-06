#!/usr/bin/python
"""Main file used for launching everything"""

from modes.realtime_test.realtime_test import mode_realtime_test
from modes.preprocess.preprocess import mode_preprocess
from modes.train.train import mode_train
from modes.test.test import mode_test
from lib.log import error, logline
import sys


def run_mode(mode):
    if mode == "preprocess":
        return mode_preprocess()
    elif mode == "train":
        return mode_train()
    elif mode == "test":
        return mode_test()
    elif mode == "realtime_test":
        return mode_realtime_test()
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
