from .features import Features, BINS, OUT_VEC_SIZE
import warnings

with warnings.catch_warnings():
    warnings.filterwarnings("ignore", category=FutureWarning)
    from tensorflow.keras.layers import LSTM, Dense
    from tensorflow.keras.models import Sequential

DROPOUT = 0.5
RECURRENT_DROPOUT = 0.2


def create_model(batch_size: int) -> Sequential:
    model = Sequential(name="beat_detector")

    model.add(
        LSTM(
            BINS,
            input_shape=(Features.length(), 1),
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
