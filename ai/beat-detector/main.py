#!/usr/bin/python
"""Main file used for launching everything"""

from modes import mode_features
import sys

def run_mode(mode):
	if mode == "features":
		return mode_features()
	elif mode == "train":
		print("not implemented")
	elif mode == "test":
		print("not implemented")
	elif mode == "realtime_test":
		print("not implemented")
	else:
		if mode == "":
			print("No mode supplied. Choose one of:\n")
		else:
			print("Unknown mode. Choose one of:\n")
		print("\tfeatures	- extract features")
		print("\ttrain		- train on given features")
		print("\ttest		- test trained model")
		print("\trealtime_test	- do a realtime test by listening to music")
		return 1

def get_mode():
	if len(sys.argv) > 1:
		return sys.argv[1]
	return ""

def main():
	return run_mode(get_mode())

if __name__ == "__main__":
	exit(main())
