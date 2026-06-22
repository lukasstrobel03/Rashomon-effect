import numpy as np
from typing import List

from sklearn.metrics import r2_score
from pygam.pygam import (
    LinearGAM, 
    TensorTerm, 
    FactorTerm
)

from .base import ModelWrapper


CATEGORICAL_FEATURES = {"cat__workingday_1"}


class GAMWrapper(ModelWrapper):
    """
    Wraps a pyGAM's Linear Generalized Additive Model to conform to the
    ModelWrapper interface.
    """

    def __init__(self, feature_names: list[str], categorical_features: set = None, **kwargs):
        """
        Pass any LinearGAM kwargs here. 
        """
        self._feature_names = feature_names
        self._categorical_features = categorical_features or CATEGORICAL_FEATURES
        self._model = LinearGAM(**kwargs)

        # construct global_explanation from interpret EBM to explain GAM
        self._global_explanation = None
        self._X_train = None

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        """
        Train the model with its parameters and save the global_explanation.
        """
        # eventuell auch splines anpassen bzw. erhöhen in den spline-Funktionen
        # XXX: gridsearch anstelle von fit probieren für bessere Ergebnisse, um Modell in das Rashomon Set aufnehmen zu können.
        # gridsearch() steigert R² score um ca. 1% ggü. fit()
        self._model.fit(X, y)
        # Needed by _explain_global() to look up the real, discrete values
        # a categorical feature takes (e.g. [0., 1.]), since pyGAM's
        # generate_X_grid() has no concept of "categorical" and would
        # otherwise linearly interpolate 100 points between -0.5 and 1.5.
        self._X_train = X
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

            if isinstance(term, TensorTerm):
                feat_idx_left, feat_idx_right = term.feature
                name_left = self._feature_names[feat_idx_left]
                name_right = self._feature_names[feat_idx_right]

                left_names, right_names, scores_2d = self._interaction_grid(
                    i, term, feat_idx_left, feat_idx_right
                )

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
                names, scores = self._categorical_main_effect(i, feat_idx)
                model_explanation.append({
                    "type": "categorical",
                    "name": self._feature_names[feat_idx],
                    "names": names,
                    "scores": scores,
                })
            else:
                feat_idx = term.feature
                XX = self._model.generate_X_grid(term=i)
                y_values = self._model.partial_dependence(term=i, X=XX)
                model_explanation.append({
                    "type": "numerical",
                    "name": self._feature_names[feat_idx],
                    "names": XX[:, feat_idx],
                    "smooth": True,
                    "scores": y_values,
                })
        
        return model_explanation

    def _is_categorical(self, feat_idx: int) -> bool:
        """
        Whether the feature at this index is one of the model's known
        categorical features. We can't rely on isinstance(term, FactorTerm)
        for this in general: a TensorTerm's subterms are always SplineTerm,
        even when te() wraps a feature that's categorical, so pyGAM gives
        no signal there that the feature is discrete.
        """
        return self._feature_names[feat_idx] in self._categorical_features

    def _categorical_main_effect(self, term_idx: int, feat_idx: int):
        """
        Evaluates a FactorTerm's partial dependence at the feature's real,
        observed category values (e.g. [0., 1.]) instead of pyGAM's default
        generate_X_grid(), which linearly interpolates 100 points between
        -0.5 and 1.5 regardless of the term being categorical — producing
        a misleading pseudo-continuous shape function for what is actually
        a 2-level (or k-level) discrete feature.
        """
        categories = np.unique(self._X_train[:, feat_idx])
        XX = np.zeros((len(categories), self._X_train.shape[1]))
        XX[:, feat_idx] = categories
        scores = self._model.partial_dependence(term=term_idx, X=XX)
        return categories, scores

    def _interaction_grid(self, term_idx: int, term: TensorTerm, feat_idx_left: int, feat_idx_right: int):
        """
        Builds the (left_names, right_names, scores_2d) grid for a
        TensorTerm, using real discrete category values on any axis that
        is categorical (per self._categorical_features) instead of
        generate_X_grid()'s default 100-point linear interpolation. This
        matters because build_gam_terms() pairs num__hr with
        cat__workingday_1 as an actual interaction, and without this fix
        that categorical axis would render as a fake continuum from 0 to 1
        with no "No"/"Yes" structure.
        """
        left_is_cat = self._is_categorical(feat_idx_left)
        right_is_cat = self._is_categorical(feat_idx_right)

        if not left_is_cat and not right_is_cat:
            # Fast path: identical to the original behavior, since
            # generate_X_grid already does the right thing for two
            # numerical features (verified to produce a correctly
            # row-major (left, right) grid).
            XX = self._model.generate_X_grid(term=term_idx)
            y_values = self._model.partial_dependence(term=term_idx, X=XX)
            left_names = np.unique(XX[:, feat_idx_left])
            right_names = np.unique(XX[:, feat_idx_right])
            scores_2d = y_values.reshape(len(left_names), len(right_names))
            return left_names, right_names, scores_2d

        n_grid = 100
        if left_is_cat:
            left_names = np.unique(self._X_train[:, feat_idx_left])
        else:
            edge_knots = self._edge_knots_for(term, feat_idx_left)
            left_names = np.linspace(edge_knots[0], edge_knots[1], n_grid)

        if right_is_cat:
            right_names = np.unique(self._X_train[:, feat_idx_right])
        else:
            edge_knots = self._edge_knots_for(term, feat_idx_right)
            right_names = np.linspace(edge_knots[0], edge_knots[1], n_grid)

        LL, RR = np.meshgrid(left_names, right_names, indexing="ij")
        XX = np.zeros((LL.size, self._X_train.shape[1]))
        XX[:, feat_idx_left] = LL.ravel()
        XX[:, feat_idx_right] = RR.ravel()

        y_values = self._model.partial_dependence(term=term_idx, X=XX)
        scores_2d = y_values.reshape(len(left_names), len(right_names))
        return left_names, right_names, scores_2d

    def _edge_knots_for(self, term: TensorTerm, feat_idx: int):
        """Finds the subterm within a TensorTerm matching feat_idx, to read its edge_knots_."""
        for subterm in term:
            if subterm.feature == feat_idx:
                return subterm.edge_knots_
        raise ValueError(f"No subterm found for feature index {feat_idx} in {term}")
        
    def _check_fitted(self) -> None:
        if self._global_explanation is None:
            raise RuntimeError(
                "Model has not been fitted yet. Call .fit(X, y) first."
            )