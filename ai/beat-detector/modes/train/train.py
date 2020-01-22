"""Main entrypoint for train mode"""

from ..features import Features, OUT_VEC_SIZE, Preprocessed
from lib.log import logline, enter_group, exit_group
from typing import List, Tuple
from ..model import create_model
from lib.io import IO, IOInput
from lib.timer import Timer
import numpy as np
import warnings
import random
import pickle
import json
import time

with warnings.catch_warnings():
    warnings.filterwarnings("ignore", category=FutureWarning)
    from tensorflow.keras.models import Sequential


def get_io() -> IO:
    return IO(
        {
            "i": IOInput(
                "./data/preprocessed.pickle",
                str,
                has_input=True,
                arg_name="input_file",
                descr="Input preprocessed file",
                alias="input_file",
                is_generic=True,
            ),
            "ow": IOInput(
                "./data/weights.h5",
                str,
                has_input=True,
                arg_name="output_weights",
                descr="File in which the weights gets stored",
                alias="output_weights",
            ),
            "ot": IOInput(
                "./data/train_config.json",
                str,
                has_input=True,
                arg_name="output_train",
                descr="File in which the training config gets stored",
                alias="output_train",
            ),
            "s": IOInput(
                80,
                int,
                has_input=True,
                arg_name="split",
                descr="The split between training and test sets",
                alias="split",
            ),
            "b": IOInput(32, int, has_input=True, arg_name="batch_size", descr="The batch size", alias="batch_size",),
            "e": IOInput(10, int, has_input=True, arg_name="epochs", descr="The amount of epochs", alias="epochs",),
        }
    )


def load_preprocessed(io: IO) -> List[Preprocessed]:
    with open(io.get("input_file"), "rb") as in_file:
        return list(map(lambda x: Preprocessed(x), pickle.load(in_file)))


def output_split(all: List[Preprocessed], train: List[Preprocessed], io: IO):
    obj = {
        "training_set": list(map(lambda x: x.file_name, train)),
        "test_set": list(map(lambda x: x.file_name, filter(lambda x: x not in train, all))),
    }
    with open(io.get("output_train"), "w+") as out_file:
        json.dump(obj, out_file)
        logline("wrote training/testing config to {}".format(io.get("output_train")))


def gen_split(preprocessed: List[Preprocessed], io: IO) -> List[Preprocessed]:
    split = io.get("split")
    if split == 100:
        output_split(preprocessed, preprocessed, io)
        return preprocessed

    shuffled = random.sample(preprocessed, len(preprocessed))

    total_len = sum(map(lambda x: len(x.features), preprocessed))
    train_len = (total_len / 100.0) * split

    train_items = list()
    current_len = 0
    for i in range(len(preprocessed) - 1):
        new_len = current_len + len(shuffled[i].features)

        if new_len >= train_len:
            output_split(preprocessed, train_items, io)
            return train_items

        current_len = new_len
        train_items.append(shuffled[i])

    output_split(preprocessed, train_items, io)
    return train_items


def gen_fit_params(preprocessed: List[Preprocessed]) -> Tuple[np.ndarray, np.ndarray]:
    shuffled = random.sample(preprocessed, len(preprocessed))

    train_x = list()
    train_y = list()
    for i in range(len(shuffled)):
        train_x = train_x + shuffled[i].features
        train_y = train_y + shuffled[i].outputs

    x_np = np.array(train_x)
    y_np = np.array(train_y)

    x_np = np.reshape(x_np, (x_np.shape[0], x_np.shape[1], 1))

    assert len(x_np.shape) == 3
    assert len(y_np.shape) == 2

    x_shape_1, x_shape_2, _ = x_np.shape
    y_shape_1, y_shape_2 = y_np.shape

    assert x_shape_1 == y_shape_1
    assert x_shape_2 == Features.length()
    assert y_shape_2 == OUT_VEC_SIZE

    return x_np, y_np


def trim_params(params: Tuple[np.ndarray, np.ndarray], io: IO) -> Tuple[np.ndarray, np.ndarray]:
    batch_size = io.get("batch_size")

    x_param, y_param = params

    length = x_param.shape[0]

    remainder = length % batch_size
    if remainder == 0:
        return params
    return x_param[:-remainder], y_param[:-remainder]


def fit_model(io: IO, model: Sequential, preprocessed: List[Preprocessed]):
    epochs = io.get("epochs")
    model.reset_states()

    logline("splitting into training set and testing set ({}%)".format(io.get("split")))
    split = gen_split(preprocessed, io)
    for i in range(epochs):
        logline("generating input and expected data for epoch {}/{}".format(i + 1, epochs))
        train_x, train_y = trim_params(gen_fit_params(split), io)

        logline("training epoch {}/{}".format(i + 1, epochs))
        model.fit(train_x, train_y, batch_size=io.get("batch_size"), epochs=1, shuffle=False)
        model.reset_states()


def export_model(model: Sequential, io: IO):
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
    train_model = create_model(batch_size=io.get("batch_size"))

    logline("fitting model")
    enter_group()
    fit_model(io, train_model, preprocessed)
    exit_group()

    logline("exporting model")
    export_model(train_model, io)

    exit_group()
    logline("done training, runtime is {}".format(Timer.stringify_time(Timer.format_time(time.time() - start_time))))
