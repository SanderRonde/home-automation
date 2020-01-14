"""Main entrypoint for train mode"""

from lib.log import logline, enter_group, exit_group
from ..preprocess.preprocess import Features, BINS
from typing import Dict, List, Union, Tuple
from keras.layers.recurrent import LSTM
from keras.layers.core import Dense
from keras.models import Sequential
from lib.io import IO, IOInput
from lib.timer import Timer
import itertools
import random
import time
import json

DROPOUT = 0.5
RECURRENT_DROPOUT = 0.2
# 1 for is_beat and 1 for is_melody
OUT_VEC_SIZE = 2


def get_io() -> IO:
    return IO(
        {
            "i": IOInput(
                "./preprocessed.pickle",
                list,
                has_input=True,
                arg_name="input_file",
                descr="Input preprocessed file",
                alias="input_file",
                is_generic=True,
            ),
            "om": IOInput(
                "./model.json",
                str,
                has_input=True,
                arg_name="output_model",
                descr="File in which the model gets stored",
                alias="output_model",
            ),
            "ow": IOInput(
                "./weights.h5",
                str,
                has_input=True,
                arg_name="output_weights",
                descr="File in which the weights gets stored",
                alias="output_weights",
            ),
            "b": IOInput(32, int, has_input=True, arg_name="batch_size", descr="The batch size", alias="batch_size",),
            "e": IOInput(10, int, has_input=True, arg_name="epochs", descr="The amount of epochs", alias="epochs",),
        }
    )


class Preprocessed:
    """Preprocessed data"""

    def __init__(self, preprocessed_json: List[Dict[str, Union[str, List[float], List[int]]]]):
        self.file_name = self._get_file_name(preprocessed_json)
        self.features = self._get_features(preprocessed_json)
        self.outputs = self._get_outputs(preprocessed_json)

        assert len(self.outputs) == len(self.features)

    def _get_file_name(preprocessed_json: List[Dict[str, Union[str, List[float], List[int]]]]) -> str:
        return preprocessed_json["file_name"]

    def _get_features(preprocessed_json: List[Dict[str, Union[str, List[float], List[int]]]]) -> List[float]:
        return preprocessed_json["features"]

    def _get_outputs(preprocessed_json: List[Dict[str, Union[str, List[float], List[int]]]]) -> List[int]:
        return preprocessed_json["outputs"]


def load_preprocessed(io: IO) -> List[Preprocessed]:
    with open(io.get("input_file", "rb")) as in_file:
        return list(map(lambda x: Preprocessed(x), json.load(in_file)))


def create_model(batch_size: int) -> Sequential:
    model = Sequential(name="beat_detector")

    model.add(
        LSTM(
            BINS,
            input_shape=(Features.length, 1),
            batch_size=batch_size,
            return_sequences=True,
            stateful=True,
            dropout=DROPOUT,
            recurrent_dropout=RECURRENT_DROPOUT,
        )
    )
    model.add(
        LSTM(
            BINS,
            input_shape=(Features.length, 1),
            batch_size=batch_size,
            return_sequences=False,
            stateful=True,
            dropout=DROPOUT,
            recurrent_dropout=RECURRENT_DROPOUT,
        )
    )
    model.add(Dense(OUT_VEC_SIZE, activation="relu"))
    model.compile(loss="mean_squared_error", optimizer="adam")

    return model


def gen_fit_params(preprocessed: List[Preprocessed]) -> Tuple[List[float], List[int]]:
    shuffled = random.sample(preprocessed, len(preprocessed))
    return (
        itertools.chain.from_iterable(map(lambda x: x.features), shuffled),
        itertools.chain.from_iterable(map(lambda x: x.outputs), shuffled),
    )


def fit_model(io: IO, model: Sequential, preprocessed: List[Preprocessed]):
    epochs = io.get("epochs")
    model.reset_states()
    for i in range(epochs):
        logline("generating input and expected data for epoch {}/{}".format(i + 1, epochs))
        input_data, expected_data = gen_fit_params(preprocessed)

        logline("training epoch {}/{}".format(i + 1, epochs))
        model.fit(input_data, expected_data, batch_size=io.get("batch_size"), epochs=1, shuffle=False)
        model.reset_states()


def export_model(model: Sequential, io: IO):
    with open(io.get("output_model"), "wb+") as output_model_file:
        logline('wrote model to file "{}"'.format(io.get("output_model")))
        output_model_file.write(model.to_json())

    logline('wrote weights to file "{}"'.format(io.get("output_weights")))
    model.save_weights(io.get("output_weights"))


def mode_train():
    """The main training mode entrypoint"""

    start_time = time.time()

    io = get_io()

    logline("train")
    enter_group()

    logline("loading preprocessed data")
    preprocessed = load_preprocessed(io)

    logline("creating models")
    train_model = create_model(io, batch_size=io.get("batch_size"))

    logline("fitting model")
    enter_group()
    fit_model(io, train_model, preprocessed)
    exit_group()

    logline("exporting model")
    export_model(train_model, io)

    exit_group()
    logline("done training, runtime is {}".format(Timer.stringify_time(Timer.format_time(time.time() - start_time))))
