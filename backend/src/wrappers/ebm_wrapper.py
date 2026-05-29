import numpy as np
from typing import List
from interpret.glassbox import ExplainableBoostingRegressor

from .base import ModelWrapper


class EBMWrapper(ModelWrapper):
    """
    Wraps InterpretML's ExplainableBoostingRegressor to conform
    to the ModelWrapper interface.
    """

    def __init__(self, **kwargs):
        """
        Pass any ExplainableBoostingRegressor kwargs here.
        """
        self._model = ExplainableBoostingRegressor(interactions=2,max_rounds=750, **kwargs)
        self._global_explanation = None

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        self._model.fit(X, y)
        self._global_explanation = self._model.explain_global(name="EBM")

    def score(self, X: np.ndarray, y: np.ndarray) -> float:
        return self._model.score(X, y)

    def get_feature_names(self) -> List[str]:
        """
        Returns the feature names passed to the EBM at construction time,
        i.e. ct.get_feature_names_out() minus excluded features.
        """
        return list(self._model.feature_names_in_)

    def get_term_names(self) -> List[str]:
        """
        Returns all term names (main effects + interactions).
        EBM interaction names use ' & ' as separator, matching our convention.
        """
        self._check_fitted()
        return list(self._global_explanation.feature_names)

    def get_shape_data(self, feature_idx: int) -> dict:
        """
        Maps EBM's explain_global().data(i) to our standard dict format.

        EBM returns:
          - numerical:    {"type": "univariate", "names": [...], "scores": [...]}
          - categorical:  {"type": "univariate", "names": [...], "scores": [...]}
          - interaction:  {"type": "interaction", "left_names": [...],
                           "right_names": [...], "scores": 2D array}
        """
        self._check_fitted()
        raw = self._global_explanation.data(feature_idx)
        feat_name = self._global_explanation.feature_names[feature_idx]

        # sinnlos -> es reicht auch raw zu returnen
        if raw["type"] == "interaction":
            return {
                "type": "interaction",
                "names": raw["left_names"],
                "scores": raw["scores"],          
                "left_names": raw["left_names"],
                "right_names": raw["right_names"],
            }
        else:
            if feat_name.startswith("cat__"):
                return {
                    "type": "categorical",
                    "names": raw["names"],
                    "scores": raw["scores"],
                }
            else:
                return {
                    "type": "numerical",
                    "names": raw["names"],
                    "scores": raw["scores"],
                }

    def monotonize(self, feature_name: str) -> "EBMWrapper":
        """
        Wraps EBM's monotonize(). Returns self so calls can be chained.
        After monotonizing, the cached explanation is refreshed.
        """
        self._model = self._model.monotonize(feature_name)
        self._global_explanation = self._model.explain_global(name="EBM")
        return self

    def get_raw_model(self) -> ExplainableBoostingRegressor:
        """Escape hatch: returns the underlying EBM if needed."""
        return self._model

    def get_feature_importances(self) -> np.ndarray:
        """
        Use EBM's own importance scores (mean absolute score)
        instead of the variance-based fallback from the base class.
        """
        self._check_fitted()
        raw = self._global_explanation.data()
        importances = np.array(raw["scores"])
        total = importances.sum()
        if total == 0:
            return np.ones(len(importances)) / len(importances)
        return importances / total

    def _check_fitted(self) -> None:
        if self._global_explanation is None:
            raise RuntimeError(
                "Model has not been fitted yet. Call .fit(X, y) first."
            )
