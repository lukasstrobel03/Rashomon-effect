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
        self._model = IGANN(task='regression', random_state=42, **kwargs)
        self._scaler_X = StandardScaler()
        self._global_explanation = []
        self._y_mean = None
        self._y_std = None

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        X_scaled = self._scaler_X.fit_transform(X)
        # store training y-scaling so we can use the same scaling at test time
        self._y_mean = np.mean(y)
        self._y_std = np.std(y)
        if self._y_std == 0 or np.isnan(self._y_std):
            raise ValueError("y has zero standard deviation or contains NaNs; cannot scale.")
        y_scaled = (y - self._y_mean) / self._y_std

        X_df = pd.DataFrame(X_scaled, columns=self._feature_names)

        # Interactions for IGANN
        interactions = [("num__hr", "cat__workingday_1"),("num__hr", "num__atemp")]
        for col_a, col_b in interactions:
            X_df[f"{col_a} & {col_b}"] = X_df[col_a] * X_df[col_b]
        self._model.fit(X_df, y_scaled)
        self._global_explanation.append(self._model.get_shape_functions_as_dict())

    def score(self, X: np.ndarray, y: np.ndarray) -> float:
        if self._y_mean is None or self._y_std is None:
            raise RuntimeError("Model has not been fitted or y-scaling statistics are missing.")

        X_scaled = self._scaler_X.transform(X)
        X_df = pd.DataFrame(X_scaled, columns=self._feature_names)

        # Interactions for IGANN
        interactions = [("num__hr", "cat__workingday_1"),("num__hr", "num__atemp")]
        for col_a, col_b in interactions:
            X_df[f"{col_a} & {col_b}"] = X_df[col_a] * X_df[col_b]

        y_scaled = (y - self._y_mean) / self._y_std
        return self._model.score(X_df, y_scaled, "r_2")

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