from dataclasses import dataclass, field
from typing import List

import pandas as pd


@dataclass
class Config:
    data_path: str = "datasets/bike.csv"
    numerical_cols: List[str] = field(
        default_factory=lambda: [
            "hr",
            "atemp",
            "windspeed",
            "weekday",
        ]
    )
    categorical_cols: List[str] = field(
        default_factory=lambda: ["workingday"]
    )
    target: str = field(default_factory=lambda: "cnt")
    test_size: float = 0.3
    random_state: int = 42
    model_save_path: str = "models/"
    ebm_parameters: dict = field(
        default_factory=lambda: {
            "max_bins": [8, 16, 256],
            "min_samples_leaf": [16, 64, 256],
        }
    )
    gam_parameters: dict = field(
        default_factory=lambda: {
            "n_splines": [20, 40, 60],
            "penalties": ["auto", "l2", None]
        }
    )
    igann_parameters: dict = field(
        default_factory=lambda: {
            "boost_rate": [0.01, 0.1, 0.2],
            "n_hid": [10, 100, 1000]
        }
    )
    parameters: dict = field(
        default_factory=lambda: {
            "exclude": [
                (),
                ("num__windspeed",),
                ("num__weekday",),
                ("num__windspeed", "num__weekday"),
            ],
            "monotonicity_constraints": [
                [],
                ["num__atemp"],
                ["num__windspeed"],
                ["num__atemp", "num__windspeed"],
            ],
        }
    )
    name_mapping: dict = field(
        default_factory=lambda: {
            "num__hr": "Time",
            "num__weekday": "Weekday",
            "num__windspeed": "Windspeed",
            "num__atemp": "Temperature",
            "cat__workingday_1": "Workday",
            "num__hr & cat__workingday_1": "Workday x Time",
            "num__hr & num__atemp": "Temperature x Time",
            "num__hr & num__weekday": "Weekday x Time",
            "num__hr & num__windspeed": "Windspeed x Time",
            "num__atemp & cat__workingday_1": "Workday x Temperature",
            "Effect on Prediction": "Effect on Rentals",
        }
    )
    df_original: pd.DataFrame = field(default_factory=lambda: pd.DataFrame())


@dataclass
class Plots:
    data: List[dict] = field(default_factory=lambda: [])