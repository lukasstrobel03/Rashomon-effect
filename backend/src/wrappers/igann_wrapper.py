import numpy as np
import pandas as pd
from typing import List
from sklearn.preprocessing import StandardScaler
from igann import IGANN

from .base import ModelWrapper

CATEGORICAL_FEATURES = {"cat__workingday_1"}


class IGANNWrapper(ModelWrapper):
    """
    Wraps IGANN to conform to the ModelWrapper interface.

    Key differences to EBMWrapper and GAMWrapper:
    - IGANN expects a pandas DataFrame as input
    - IGANN requires StandardScaler on both X and y
    - Shape functions are retrieved via get_shape_functions()
    """

    def __init__(self, feature_names: List[str], categorical_features: set = None, **kwargs):
        self._feature_names = feature_names
        self._categorical_features = categorical_features or CATEGORICAL_FEATURES
        self._model = IGANN(task='regression')# , **kwargs)
        self._scaler_X = StandardScaler()
        self._global_explanation = []

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        X_scaled = self._scaler_X.fit_transform(X)
        y_scaled = (y - y.mean()) / y.std()
        X_df = pd.DataFrame(X_scaled, columns=self._feature_names)
        self._model.fit(X_df, y_scaled)

        self._global_explanation.append(self._model.get_shape_functions_as_dict())

    def score(self, X: np.ndarray, y: np.ndarray) -> float:
        X = pd.DataFrame(X, columns=self._feature_names)
        return self._model.score(X, y, "r_2")

    def get_feature_names(self) -> List[str]:
        return self._feature_names

    def get_term_names(self) -> List[str]:
        self._check_fitted()
        return [entry["name"] for entry in self._global_explanation]

    def get_shape_data(self, feature_idx: int) -> dict:
        self._check_fitted()
        return self._global_explanation[feature_idx]

    def _check_fitted(self) -> None:
        if self._global_explanation is None:
            raise RuntimeError(
                "Model has not been fitted yet. Call .fit(X, y) first."
            )

    def get_raw_model(self):
        return self._model