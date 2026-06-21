import numpy as np
import pandas as pd
from typing import List
from sklearn.preprocessing import StandardScaler
from igann import IGANN

from .base import ModelWrapper


CATEGORICAL_FEATURES = {"cat__workingday_1"}

# Same interaction pairs used during fit() — kept as a single source of truth
# so fit(), score() and get_interaction_surface() never drift apart.
IGANN_INTERACTIONS = [
    ("num__hr", "cat__workingday_1"),
    ("num__hr", "num__atemp"),
]


class IGANNWrapper(ModelWrapper):
    """
    Wraps IGANN to conform to the ModelWrapper interface.

    Key differences to EBMWrapper and GAMWrapper:
    - IGANN expects a pandas DataFrame as input
    - IGANN requires StandardScaler on numerical features and y
    - IGANN decides numerical vs. categorical per-column purely from
      pandas dtype (object/string/category -> categorical, everything
      else -> numerical), regardless of any "cat__" naming convention.
      Categorical columns must therefore be left as strings, NOT scaled
      to float, or IGANN will silently treat them as numerical.
    - Shape functions are retrieved via get_shape_functions_as_dict(),
      which returns a dict keyed by feature name (not a list), so we
      normalize it into an ordered list the same way EBM/GAM expose terms.
    - Interaction terms (e.g. "num__hr & num__atemp") are engineered as
      product columns before fitting, so IGANN treats them as ordinary
      numerical features with a 1D shape function. We detect them by name
      (" & " separator) and tag them as type="interaction" so create_plots
      knows to render them as 2D surfaces instead of 1D curves.
    """

    def __init__(self, feature_names: List[str], categorical_features: set = None, **kwargs):
        self._feature_names = feature_names
        self._categorical_features = categorical_features or CATEGORICAL_FEATURES
        self._numerical_features = [f for f in feature_names if f not in self._categorical_features]
        self._numerical_idx = [feature_names.index(f) for f in self._numerical_features]

        self._model = IGANN(task='regression', random_state=42, **kwargs)
        self._scaler_X = StandardScaler()
        self._global_explanation = None
        self._term_names = None
        self._y_mean = None
        self._y_std = None

    def _build_dataframe(self, X: np.ndarray, fit_scaler: bool) -> pd.DataFrame:
        """
        Builds the DataFrame IGANN expects: numerical columns scaled and
        kept as float, categorical columns kept as their raw 0/1 values
        cast to string so IGANN's internal select_dtypes() correctly
        classifies them as categorical (NOT mixed in with the scaled
        numerical features).
        """
        X_num = X[:, self._numerical_idx]
        X_num_scaled = (
            self._scaler_X.fit_transform(X_num) if fit_scaler
            else self._scaler_X.transform(X_num)
        )

        X_df = pd.DataFrame(X_num_scaled, columns=self._numerical_features)

        for feat in self._categorical_features:
            if feat in self._feature_names:
                idx = self._feature_names.index(feat)
                X_df[feat] = X[:, idx].astype(int).astype(str)

        X_df = self._add_interactions(X_df)
        return X_df

    def _add_interactions(self, X_df: pd.DataFrame) -> pd.DataFrame:
        for col_a, col_b in IGANN_INTERACTIONS:
            if col_a in X_df.columns and col_b in X_df.columns:
                # both operands must be numeric to form the product, even
                # if one of them is a categorical 0/1 column stored as string
                a = X_df[col_a].astype(float)
                b = X_df[col_b].astype(float)
                X_df[f"{col_a} & {col_b}"] = a * b
        return X_df

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        self._y_mean = np.mean(y)
        self._y_std = np.std(y)
        if self._y_std == 0 or np.isnan(self._y_std):
            raise ValueError("y has zero standard deviation or contains NaNs; cannot scale.")
        y_scaled = (y - self._y_mean) / self._y_std

        X_df = self._build_dataframe(X, fit_scaler=True)
        self._model.fit(X_df, y_scaled)

        # get_shape_functions_as_dict() returns {feat_name: {...}}, not a
        # list. Normalize into an ordered list so get_term_names() /
        # get_shape_data() behave like the EBM/GAM wrappers (index
        # addressable, stable order).
        raw = self._model.get_shape_functions_as_dict()
        self._term_names = list(raw.keys())
        self._global_explanation = [raw[name] for name in self._term_names]

    def score(self, X: np.ndarray, y: np.ndarray) -> float:
        if self._y_mean is None or self._y_std is None:
            raise RuntimeError("Model has not been fitted or y-scaling statistics are missing.")

        X_df = self._build_dataframe(X, fit_scaler=False)
        y_scaled = (y - self._y_mean) / self._y_std
        return self._model.score(X_df, y_scaled, "r_2")

    def get_feature_names(self) -> List[str]:
        return self._feature_names

    def get_term_names(self) -> List[str]:
        self._check_fitted()
        return self._term_names

    def get_shape_data(self, feature_idx: int) -> dict:
        self._check_fitted()
        entry = self._global_explanation[feature_idx]
        name = self._term_names[feature_idx]

        if " & " in name:
            return {**entry, "type": "interaction"}
        elif entry.get("datatype") == "categorical":
            return {**entry, "type": "categorical"}
        else:
            return {**entry, "type": "numerical"}

    def get_interaction_surface(self, feat_a: str, feat_b: str, resolution: int = 50) -> dict:
        """
        IGANN has no native 2D shape function for interaction terms — the
        interaction is only an engineered product column. To visualize it
        like an EBM/GAM interaction plot, we build a grid over the two base
        features (in their original, already-fitted scale) and query the
        full fitted model's prediction, holding all other numerical
        features at their training mean (0, since they're standardized)
        and other categorical features at their reference (most frequent
        training) class.

        Returns a dict shaped like the EBM/GAM interaction feat_data:
        {"left_names": [...], "right_names": [...], "scores": 2D array}
        with left/right_names in original (unscaled) units for numerical
        features, and ["0", "1"] for categorical features.
        """
        self._check_fitted()
        if feat_a not in self._feature_names or feat_b not in self._feature_names:
            raise ValueError(f"Unknown interaction features: {feat_a}, {feat_b}")

        is_cat_a = feat_a in self._categorical_features
        is_cat_b = feat_b in self._categorical_features

        grid_a = np.array([0.0, 1.0]) if is_cat_a else np.linspace(-2.5, 2.5, resolution)
        grid_b = np.array([0.0, 1.0]) if is_cat_b else np.linspace(-2.5, 2.5, resolution)

        AA, BB = np.meshgrid(grid_a, grid_b, indexing="ij")
        n_points = AA.size

        # Build the grid directly in IGANN's expected DataFrame shape:
        # numerical features at their standardized mean (0), categorical
        # features at their reference class ("0"), then override the two
        # features being swept.
        X_grid_df = pd.DataFrame(
            0.0, index=range(n_points), columns=self._numerical_features
        )
        for feat in self._categorical_features:
            if feat in self._feature_names:
                X_grid_df[feat] = "0"

        if is_cat_a:
            X_grid_df[feat_a] = AA.ravel().astype(int).astype(str)
        else:
            X_grid_df[feat_a] = AA.ravel()

        if is_cat_b:
            X_grid_df[feat_b] = BB.ravel().astype(int).astype(str)
        else:
            X_grid_df[feat_b] = BB.ravel()

        X_grid_df = self._add_interactions(X_grid_df)

        preds_scaled = self._model.predict(X_grid_df)
        preds = np.asarray(preds_scaled).reshape(-1) * self._y_std + self._y_mean

        scores = preds.reshape(AA.shape)

        def to_original_units(grid, feat, is_cat):
            if is_cat:
                return grid
            idx_in_numerical = self._numerical_features.index(feat)
            return grid * self._scaler_X.scale_[idx_in_numerical] + self._scaler_X.mean_[idx_in_numerical]

        left_names = to_original_units(grid_a, feat_a, is_cat_a)
        right_names = to_original_units(grid_b, feat_b, is_cat_b)

        return {
            "left_names": left_names,
            "right_names": right_names,
            "scores": scores,
        }

    def inverse_transform_feature(self, feat_name: str, values) -> np.ndarray:
        """
        Converts standardized x-axis values from get_shape_data() back into
        the feature's original units. IGANN's shape functions are computed
        on the scaled input space (since fit() receives StandardScaler
        output for numerical features), unlike EBM/GAM which report shape
        data in original units. Categorical features are returned as-is
        since they were never scaled.
        """
        values = np.asarray(values, dtype=float)
        if feat_name in self._categorical_features:
            return values
        idx = self._numerical_features.index(feat_name)
        return values * self._scaler_X.scale_[idx] + self._scaler_X.mean_[idx]

    def _check_fitted(self) -> None:
        if self._global_explanation is None:
            raise RuntimeError(
                "Model has not been fitted yet. Call .fit(X, y) first."
            )

    def get_raw_model(self):
        return self._model