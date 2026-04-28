import numpy as np
from typing import List

from sklearn.metrics import r2_score
from pygam.pygam import (
    LinearGAM, 
    TensorTerm, 
    FactorTerm
)

from .base import ModelWrapper


class GAMWrapper(ModelWrapper):
    """
    Wraps a pyGAM's Linear Generalized Additive Model to conform to the
    ModelWrapper interface.
    """

    def __init__(self, feature_names: list[str], **kwargs):
        """
        Pass any LinearGAM kwargs here. 
        """
        self._feature_names = feature_names
        self._model = LinearGAM(**kwargs)

        # construct global_explanation from interpret EBM to explain GAM
        self._global_explanation = None

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        """
        Train the model with its parameters and save the global_explanation.
        """
        # eventuell auch splines anpassen bzw. erhöhen in den spline-Funktionen
        # XXX: gridsearch anstelle von fit probieren für bessere Ergebnisse, um Modell in das Rashomon Set aufnehmen zu können.
        # gridsearch() steigert R² score um ca. 1% ggü. fit()
        self._model.gridsearch(X, y)
        self._global_explanation = self._explain_global()
    
    def score(self, X: np.ndarray, y: np.ndarray) -> float:
        """Calculate the models R²-Score."""
        y_pred = self._model.predict(X)
        return r2_score(y, y_pred)
    
    def get_feature_names(self) -> List[str]:
        """
        Returns the feature names passed to the GAM.
        """
        return self._feature_names

    def get_term_names(self):
        self._check_fitted()
        return [term["name"] for term in self._global_explanation]

    def get_shape_data(self, feature_idx: int) -> dict:
        self._check_fitted()
        raw = self._global_explanation
        return raw[feature_idx]
    
    def get_raw_model(self) -> LinearGAM:
        return self._model
    
    # ---------------------------------------------------------------
    # Helper for explaining the LinearGAM, 
    # similar to explain_global() in interpret.glassbox EBM
    # ---------------------------------------------------------------
    def _explain_global(self) -> list[dict]:
        """
        Explains the LinearGAM to get an understanding about the importance of 
        different input parameter.

        Args:
            X: NumPy array for samples.
            y: NumPy array for targets.

        Returns:
            global explanation of the model

        """
        model_explanation = []

        for i, term in enumerate(self._model.terms):
            if term.isintercept:
                continue

            XX = self._model.generate_X_grid(term=i)
            y_values = self._model.partial_dependence(term=i, X=XX)

            if isinstance(term, TensorTerm):
                feat_idx_left, feat_idx_right = term.feature
                name_left = self._feature_names[feat_idx_left]
                name_right = self._feature_names[feat_idx_right]

                left_names = np.unique(XX[:, feat_idx_left])
                right_names = np.unique(XX[:, feat_idx_right])

                scores_2d = y_values.reshape(len(left_names), len(right_names))

                model_explanation.append({
                    "type": "interaction",
                    "name": f"{name_left} & {name_right}",
                    "names": left_names,
                    "scores": scores_2d,
                    "left_names": left_names,
                    "right_names": right_names,
                })
            elif isinstance(term, FactorTerm):
                feat_idx = term.feature
                model_explanation.append({
                    "type": "categorical",
                    "name": self._feature_names[feat_idx],
                    "names": XX[:, feat_idx],
                    "scores": y_values,
                })
            else:
                feat_idx = term.feature
                model_explanation.append({
                    "type": "numerical",
                    "name": self._feature_names[feat_idx],
                    "names": XX[:, feat_idx],
                    "scores": y_values,
                })
        
        return model_explanation
        
    def _check_fitted(self) -> None:
        if self._global_explanation is None:
            raise RuntimeError(
                "Model has not been fitted yet. Call .fit(X, y) first."
            )
        

