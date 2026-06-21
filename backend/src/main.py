import copy
import pickle
import os
import sys
from loguru import logger
from pathlib import Path
from typing import List, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from pygam.pygam import TermList, s, f, te
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, FunctionTransformer
from sklearn.model_selection import ParameterGrid

from config import Config, Plots
from wrappers import (
    ModelWrapper, 
    EBMWrapper, 
    GAMWrapper,
    IGANNWrapper,
)

config = Config()
plots = Plots()

logger.remove()
logger.add(sys.stderr, level="DEBUG")

def create_step_points(X, Y, num_points):
    artificial_points_X = []
    artificial_points_Y = []
    total_steps = num_points - len(X)
    steps_per_segment = total_steps // (len(X) - 1)

    for i in range(len(X) - 1):
        artificial_points_X.append(X[i])
        artificial_points_Y.append(Y[i])
        step_size = (X[i + 1] - X[i]) / (steps_per_segment + 1)
        for j in range(1, steps_per_segment + 1):
            artificial_points_X.append(X[i] + j * step_size)
            artificial_points_Y.append(Y[i])

    artificial_points_X.append(X[-1])
    artificial_points_Y.append(Y[-1])
    return artificial_points_X, artificial_points_Y


def add_plot_data(
    plot_num: int,
    X: List[float],
    Y: List[float],
    plot_type: str,
    feat_name: str,
    x_name: str,
    y_name: str,
    model: ModelWrapper,
    smooth: bool | None = None,
    Z: List[float] | None = None,
    x_labels: List[int | str] | None = None,
    y_labels: List[int | str] | None = None,
    x_min: float | None = None,
    x_max: float | None = None,
    x_ticks: List[int] | None = None,
    y_ticks: List[int] | None = None,
):
    if "plot_data" not in plots.data[-1].keys():
        plots.data[-1]["plot_data"] = []

    if feat_name in ["num__hr", "num__windspeed", "num__atemp"] and isinstance(model, EBMWrapper):
        X, Y = create_step_points(X, Y, num_points=500)

    X = np.round(X, 2)

    if plot_type == "interaction":
        Y = np.round(Y, 2)
    else:
        Y = np.round(Y)

    if Z is not None:
        Z = np.round(Z)

    plots.data[-1]["plot_data"].append(
        {
            "X": X,
            "Y": Y,
            "type": plot_type,
            "feat_name": config.name_mapping[feat_name],
            "x_name": config.name_mapping[x_name],
            "y_name": config.name_mapping[y_name],
            "Z": Z,
            "x_labels": x_labels,
            "y_labels": y_labels,
            "x_ticks": x_ticks,
            "y_ticks": y_ticks,
            "x_min": x_min,
            "x_max": x_max,
            "smooth": smooth,
        }
    )

def load_data() -> pd.DataFrame:
    df = pd.read_csv(Path(__file__).parent.parent / config.data_path)
    df = df[df["yr"] != 0]
    df["atemp"] = df["atemp"] * (50 - -16) + -16
    df["temp"] = df["temp"] * (39 - -8) + -8

    convert_dict = {
        "mnth": int, "hr": int, "temp": float, "atemp": float,
        "hum": float, "windspeed": float, "weekday": int,
        "season": str, "yr": str, "holiday": str,
        "workingday": str, "weathersit": str,
    }
    df = df.astype(convert_dict)
    config.df_original = df
    return df


def preprocess_data(
    df: pd.DataFrame,
) -> Tuple[pd.Series, pd.Series, pd.Series, pd.Series]:
    X = df[config.numerical_cols + config.categorical_cols]
    y = df[config.target]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=config.test_size, random_state=config.random_state
    )

    numeric_transformer = FunctionTransformer(feature_names_out="one-to-one")

    categorical_transformer = OneHotEncoder(handle_unknown="ignore", drop="first")

    ct = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, X.select_dtypes(include=["int64", "float64"]).columns),
            ("cat", categorical_transformer, X.select_dtypes(include=["object", "string"]).columns),
        ]
    )

    X_train = ct.fit_transform(X_train)
    X_test = ct.transform(X_test)

    return X_train, X_test, y_train, y_test, ct

def debug_interaction_issue(model: ModelWrapper):
    """
    Checks that every interaction term only contains features
    that also appear as main effects in the model.

    Works with any ModelWrapper — no EBM-specific calls needed.
    """
    term_names = model.get_term_names()

    # Collect all main-effect feature names (no ' & ' in name)
    main_effects = {name for name in term_names if " & " not in name}

    for term in term_names:
        if " & " not in term:
            continue
        term1, term2 = term.split(" & ")
        if term1 in main_effects and term2 in main_effects:
            continue
        else:
            print(term_names)
            raise ValueError(
                f"Interaction '{term}' contains a feature without a main effect. "
                f"Missing: {[f for f in [term1, term2] if f not in main_effects]}"
            )
        
# Limitation: interactions are static for dataset 
def build_gam_terms(feature_names: list[str], model_params, params) -> TermList:
    INTERACTIONS = [
        ("num__hr", "cat__workingday_1"),
        ("num__hr", "num__atemp"), 
        ("num__hr", "num__weekday"),
    ]
    CATEGORICAL_FEATURES = config.categorical_cols
    terms = []

    for i, name in enumerate(feature_names):
        if name in CATEGORICAL_FEATURES:
            terms.append(f(i))
        elif name in params["monotonicity_constraints"] and name not in params["exclude"]:
            terms.append(s(i, n_splines=model_params["n_splines"], penalties=model_params["penalties"], constraints="monotonic_inc"))
        else:
            terms.append(s(i, n_splines=model_params["n_splines"], penalties=model_params["penalties"]))

    interactions_count = 2
    for left, right in INTERACTIONS[:interactions_count]:
        if left in feature_names and right in feature_names:
            left_idx = feature_names.index(left)
            right_idx = feature_names.index(right)
            terms.append(te(left_idx, right_idx))

    return TermList(*terms)

def get_right_parameters(model_type: str) -> dict:
    """Return the right parameters for each model."""
    if model_type == "ebm":
        return {**config.ebm_parameters, **config.parameters}
    elif model_type == "gam":
        return {**config.gam_parameters, **config.parameters}
    elif model_type == "igann":
        return {**config.igann_parameters}

def filter_param_grid(param_grid_dict: list[dict]) -> list[dict]:
    sorted_param_grid = []
    for params in param_grid_dict:
        for param in list(params["exclude"]):
            if param in params["monotonicity_constraints"]:
                continue
            sorted_param_grid.append(params)    
    
    return sorted_param_grid

def train_model(
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    y_train: pd.DataFrame,
    y_test: pd.DataFrame,
    ct: ColumnTransformer,
    model_type: str = "ebm"
) -> None:

    param_grid_dict = list(ParameterGrid(get_right_parameters(model_type)))

    if model_type != "igann":
        param_grid_dict = filter_param_grid(param_grid_dict)

    logger.info(f"Number of parameter options: {len(param_grid_dict)}\n\n")

    for i, params in enumerate(param_grid_dict):
        logger.info(f"Training model {i + 1} of {len(param_grid_dict)}")
        logger.info(params)

        model_params = {
            param_name: param_value
            for (param_name, param_value) in params.items()
            if param_name not in ("monotonicity_constraints", "exclude")
        }

        feature_names = [
            feat for feat in ct.get_feature_names_out()
            if feat not in config.parameters["exclude"]
        ]
        excluded_features_index = [
            list(ct.get_feature_names_out()).index(feat)
            for feat in ct.get_feature_names_out()
            if feat in config.parameters["exclude"]
        ]
        X_train_selected = np.delete(X_train, excluded_features_index, axis=1)
        X_test_selected = np.delete(X_test, excluded_features_index, axis=1)

        if model_type == "ebm":
            model = EBMWrapper(
                feature_names=feature_names,
                random_state=config.random_state,
                n_jobs=-1,
                **model_params,
            )
            model.fit(X_train_selected, y_train)

            if params["monotonicity_constraints"]:
                for mono_index, feature in enumerate(params["monotonicity_constraints"]):
                    if feature not in params["exclude"]:
                        logger.debug(f"Monotonize: {feature}")
                        model.monotonize(feature)
                    else:
                        params["monotonicity_constraints"].pop(mono_index)
            debug_interaction_issue(model)
        elif model_type == "gam":
            model = GAMWrapper(
                feature_names=feature_names,
                terms=build_gam_terms(
                    feature_names,
                    model_params,
                    params
                ),
            )
            model.fit(X_train_selected, y_train)
            debug_interaction_issue(model)

        elif model_type == "igann":
            model = IGANNWrapper(
                feature_names=feature_names,
                **model_params
            )
            model.fit(X_train_selected, y_train)
            debug_interaction_issue(model)

        score = model.score(X_test_selected, y_test)
        logger.debug(f"R^2 score: {score:.6f} Params: {params}")

        model_dir = _params_to_dir_name({**params, **config.parameters})
        model_dir += f"__score_{score:.6f}"
        model_path = f"{config.model_save_path}/{model_dir}"
        os.makedirs(model_path, exist_ok=True)
        with open(f"{model_path}/model.pkl", "wb") as f:
            pickle.dump(model.get_raw_model(), f)

        plots.data.append(dict(copy.deepcopy(params), score=score))
        if model_type == "igann":
            plot_igann_interaction_plots(model, model_path)
        else:
            create_plots(model, model_path)

FEATURE_ABBREV = {
    "num__windspeed": "ws",
    "num__atemp": "at",
    "num__weekday": "wd",
    "num__hr": "hr",
    "cat__workingday_1": "wk",
}

def _params_to_dir_name(params: dict) -> str:
    parts = []
    for key, value in params.items():
        short_key = {
            "exclude": "ex",
            "interactions": "int",
            "max_bins": "mb",
            "min_samples_leaf": "msl",
            "monotonicity_constraints": "mono",
            "penalties": "pen",
            "n_splines": "nspl",
            "boost_rate": "bt",
            "n_hid": "n_hid",
            "n_estimators": "est",              
            "elm_scale": "esc",
        }.get(key, key)

        if isinstance(value, tuple):
            # exclude ist ein Tuple von Feature-Namen z.B. ('num__windspeed',)
            abbreviated = [FEATURE_ABBREV.get(v, str(v)) for v in value]
            value_str = "-".join(abbreviated) if abbreviated else "none"
        elif isinstance(value, list):
            # monotonicity_constraints ist eine Liste von Feature-Namen
            abbreviated = [FEATURE_ABBREV.get(w, str(w)) for v in value for w in v]
            value_str = "-".join(abbreviated) if abbreviated else "none"
        elif isinstance(value, float):
            value_str = f"{value:.4f}"
        elif callable(value):
            value_str = value.__name__
        else:
            value_str = str(value)

        parts.append(f"{short_key}_{value_str}")
    return "__".join(parts)


def create_plots(model: ModelWrapper, model_path: str | os.PathLike):
    """Creates all plots using only the ModelWrapper interface."""
    os.makedirs(f"{model_path}/jpg/", exist_ok=True)
    os.makedirs(f"{model_path}/svg/", exist_ok=True)

    term_names = model.get_term_names()

    for index, feat_name in enumerate(term_names):
        logger.debug(f"Create plot for {feat_name}.")
        feat_data = model.get_shape_data(index)

        if feat_data.get("type") == "interaction" or " & " in feat_name:
            feature_name_left, feature_name_right = feat_name.split(" & ")
            _create_interaction_plot(model_path, feat_data, feat_name)

            y_values = feat_data["right_names"]
            if len(y_values) == 3:
                y_ticks = [0.25, 0.75]
                y_labels = ["No", "Yes"]
            else:
                y_ticks = None
                y_labels = None

            if feature_name_right == "num__weekday":
                y_labels = [
                    "Sunday", 
                    "Monday", 
                    "Tuesday", 
                    "Wednesday",
                    "Thursday", 
                    "Friday", 
                    "Saturday"
                ]

            add_plot_data(
                index,
                np.array(feat_data["left_names"]),
                feat_data["right_names"],
                "interaction",
                feat_name,
                feature_name_left,
                feature_name_right,
                model,
                Z=np.transpose(feat_data["scores"]),
                y_ticks=y_ticks if y_ticks is not None else None,
                y_labels=y_labels if y_labels is not None else None,
            )

        elif feat_data.get("type") == "categorical" or feat_name.startswith("cat__"):
            _create_cat_plot(model_path, feat_data, feat_name)
            y_values = __calculate_y_values(feat_data["names"], feat_data["scores"])
            x_values = np.array(feat_data["names"])
            add_plot_data(
                index,
                [x_values[0], x_values[-1]],
                [y_values[0], y_values[-1]],
                "categorical",
                feat_name,
                feat_name,
                "Effect on Prediction",
                model,
                x_ticks=[0.25, 0.75],
                x_labels=["No", "Yes"],
            )

        else:  # numerical
            _create_num_plot(model_path, feat_data, feat_name, model)
            y_values = __calculate_y_values(feat_data["names"], feat_data["scores"])

            if feat_name == "num__hr":
                y_values = y_values + 430

            x_values = np.array(feat_data["names"])
            x_min = config.df_original[feat_name.split("__")[1]].min()
            x_max = config.df_original[feat_name.split("__")[1]].max()

            add_plot_data(
                index,
                x_values,
                y_values,
                "numerical",
                feat_name,
                feat_name,
                "Effect on Prediction",
                model,
                smooth=False if isinstance(model, EBMWrapper) else True,
                x_min=x_min,
                x_max=x_max,
                x_labels=(
                    ["Sunday", "Monday", "Tuesday", "Wednesday",
                     "Thursday", "Friday", "Saturday"]
                    if feat_name == "num__weekday" else None
                ),
            )


def plot_igann_interaction_plots(model: "IGANNWrapper", model_path: str | os.PathLike):
    """
    Public entry point for IGANN plotting, called from train_model().

    Despite the name (kept for continuity with the original prototype),
    this creates the full set of plots for an IGANN model — numerical,
    categorical, AND interaction — not just interactions. It delegates to
    create_igann_plots(), which mirrors create_plots()'s dispatch logic
    but reads IGANN's own get_shape_functions_as_dict() schema instead of
    the EBM/GAM "names"/"scores" schema.
    """
    create_igann_plots(model, model_path)


def create_igann_plots(model: "IGANNWrapper", model_path: str | os.PathLike):
    """
    Creates numerical, categorical, and interaction plots for an IGANNWrapper.

    IGANN's get_shape_functions_as_dict() uses a different schema than
    EBM/GAM ("x"/"y"/"datatype" instead of "names"/"scores", and no native
    2D interaction surfaces), so this mirrors create_plots()'s structure
    but adapts the data extraction step accordingly. Interaction surfaces
    are computed on demand via model.get_interaction_surface(), since IGANN
    only fits interactions as engineered product columns, not as a
    queryable 2D shape function like EBM/GAM.
    """
    os.makedirs(f"{model_path}/jpg/", exist_ok=True)
    os.makedirs(f"{model_path}/svg/", exist_ok=True)

    term_names = model.get_term_names()

    for index, feat_name in enumerate(term_names):
        logger.debug(f"Create IGANN plot for {feat_name}.")
        feat_data = model.get_shape_data(index)

        if feat_data["type"] == "interaction":
            feature_name_left, feature_name_right = feat_name.split(" & ")
            surface = model.get_interaction_surface(feature_name_left, feature_name_right)
            _create_interaction_plot(model_path, surface, feat_name)

            y_values = surface["right_names"]
            if feature_name_right in CATEGORICAL_FEATURES_IGANN:
                y_ticks = [0, 1]
                y_labels = ["No", "Yes"]
            else:
                y_ticks = None
                y_labels = None

            add_plot_data(
                index,
                np.array(surface["left_names"]),
                surface["right_names"],
                "interaction",
                feat_name,
                feature_name_left,
                feature_name_right,
                model,
                Z=np.transpose(surface["scores"]),
                y_ticks=y_ticks,
                y_labels=y_labels,
            )

        elif feat_data["type"] == "categorical":
            _create_igann_cat_plot(model_path, feat_data, feat_name)

            # IGANN gives class labels as strings ("0"/"1"); add_plot_data
            # expects numeric X (it calls np.round on it), and the existing
            # 0.25/0.75 x_ticks convention from the EBM/GAM categorical path
            # maps those ticks to "No"/"Yes" labels. Sort by class so "0"
            # (No) always maps to 0.25 and "1" (Yes) to 0.75, regardless of
            # the order IGANN happened to return them in.
            class_to_x = {"0": 0.25, "1": 0.75}
            paired = sorted(
                zip(feat_data["x"], feat_data["y"]),
                key=lambda pair: class_to_x.get(str(pair[0]), 0.0),
            )
            x_numeric = [class_to_x.get(str(cls), 0.0) for cls, _ in paired]
            y_numeric = [val for _, val in paired]

            add_plot_data(
                index,
                [x_numeric[0], x_numeric[-1]],
                [y_numeric[0], y_numeric[-1]],
                "categorical",
                feat_name,
                feat_name,
                "Effect on Prediction",
                model,
                x_ticks=[0.25, 0.75],
                x_labels=["No", "Yes"],
            )

        else:  # numerical
            x_values_original = model.inverse_transform_feature(feat_name, feat_data["x"])
            feat_data_original = {**feat_data, "x": x_values_original}
            _create_igann_num_plot(model_path, feat_data_original, feat_name)

            y_values = np.array(feat_data["y"])

            x_min = config.df_original[feat_name.split("__")[1]].min()
            x_max = config.df_original[feat_name.split("__")[1]].max()

            add_plot_data(
                index,
                x_values_original,
                y_values,
                "numerical",
                feat_name,
                feat_name,
                "Effect on Prediction",
                model,
                smooth=True,
                x_min=x_min,
                x_max=x_max,
                x_labels=(
                    ["Sunday", "Monday", "Tuesday", "Wednesday",
                     "Thursday", "Friday", "Saturday"]
                    if feat_name == "num__weekday" else None
                ),
            )


# Mirrors IGANNWrapper's own categorical-feature set; kept here too so
# plotting logic doesn't need a live wrapper instance to know which
# features are categorical.
CATEGORICAL_FEATURES_IGANN = {"cat__workingday_1"}


def _create_igann_cat_plot(model_path, feat_data: dict, feat: str):
    os.makedirs(f"{model_path}/jpg/", exist_ok=True)
    os.makedirs(f"{model_path}/svg/", exist_ok=True)

    try:
        paired = sorted(zip(feat_data["x"], feat_data["y"]), key=lambda pair: str(pair[0]))
        x_values = [str(cls) for cls, _ in paired]
        y_values = [val for _, val in paired]

        plt.title(f"{feat} Feature Effect")
        plt.xlabel(f"{feat}'s value")
        plt.ylabel("Effect on Prediction")
        plt.bar(x_values, y_values)
        plt.savefig(f"{model_path}/jpg/{feat}.jpg", format="jpg", dpi=300)
        plt.savefig(f"{model_path}/svg/{feat}.svg", format="svg")
    except FileNotFoundError as e:
        logger.error(f"Could not create IGANN categorical plot: {e}")
    finally:
        plt.close()


def _create_igann_num_plot(model_path, feat_data: dict, feat: str):
    os.makedirs(f"{model_path}/jpg/", exist_ok=True)
    os.makedirs(f"{model_path}/svg/", exist_ok=True)

    try:
        x_values = np.array(feat_data["x"])
        y_values = np.array(feat_data["y"])
        order = np.argsort(x_values)

        plt.xlim(
            config.df_original[feat.split("__")[1]].min(),
            config.df_original[feat.split("__")[1]].max(),
        )
        plt.title(f"{feat} Feature Effect")
        plt.xlabel(f"{feat}'s value")
        plt.ylabel("Effect on Prediction")

        if feat == "num__weekday":
            plt.xticks(
                ticks=range(7),
                labels=["Sunday", "Monday", "Tuesday", "Wednesday",
                        "Thursday", "Friday", "Saturday"],
            )

        plt.plot(x_values[order], y_values[order])
        plt.savefig(f"{model_path}/jpg/{feat}.jpg", format="jpg", dpi=300)
        plt.savefig(f"{model_path}/svg/{feat}.svg", format="svg")
    except FileNotFoundError as e:
        logger.error(f"Directory for IGANN numeric plot doesn't exist: {e}")
    finally:
        plt.close()


def _create_cat_plot(model_path, feat_data: dict, feat: str):

    os.makedirs(f"{model_path}/jpg/", exist_ok=True)
    os.makedirs(f"{model_path}/svg/", exist_ok=True)

    try:
        y_values = __calculate_y_values(feat_data["names"], feat_data["scores"])

        plt.xlim(0, 1)
        plt.xticks(ticks=[0.25, 0.75], labels=[0, 1])
        plt.title(f"{feat} Feature Effect")
        plt.xlabel(f"{feat}'s value")
        plt.ylabel("Effect on Prediction")
        plt.step(feat_data["names"], y_values, where="post")
        plt.savefig(f"{model_path}/jpg/{feat}.jpg", format="jpg", dpi=300)
        plt.savefig(f"{model_path}/svg/{feat}.svg", format="svg")
    except FileNotFoundError as e:
        logger.error(f"Could not create Categorical Plot: {e}")
    finally:
        plt.close()


def _create_num_plot(model_path, feat_data: dict, feat: str, model: ModelWrapper):

    os.makedirs(f"{model_path}/jpg/", exist_ok=True)
    os.makedirs(f"{model_path}/svg/", exist_ok=True)
    try:
        y_values = __calculate_y_values(feat_data["names"], feat_data["scores"])
        if feat == "num__hr":
            y_values = y_values + 430

        plt.xlim(
            config.df_original[feat.split("__")[1]].min(),
            config.df_original[feat.split("__")[1]].max(),
        )
        plt.title(f"{feat} Feature Effect")
        plt.xlabel(f"{feat}'s value")
        plt.ylabel("Effect on Prediction")

        if feat == "num__weekday":
            plt.xticks(
                ticks=range(7),
                labels=["Sunday", "Monday", "Tuesday", "Wednesday",
                        "Thursday", "Friday", "Saturday"],
            )

        if isinstance(model, EBMWrapper):
            plt.step(feat_data["names"], y_values, where="post")
        else:
            plt.plot(feat_data["names"], y_values)  
        plt.savefig(f"{model_path}/jpg/{feat}.jpg", format="jpg", dpi=300)
        plt.savefig(f"{model_path}/svg/{feat}.svg", format="svg")
    except FileNotFoundError as e:
        logger.error(f"Directory for numeric plot doesn't exist: {e}")
    finally:
        plt.close()


def _create_interaction_plot(model_path, feat_data: dict, feat_name: str):
    safe_feat_name = feat_name.replace(" & ", "__x__").replace(" ", "_")
    feature_name_left, feature_name_right = feat_name.split(" & ")

    os.makedirs(f"{model_path}/jpg/", exist_ok=True)
    os.makedirs(f"{model_path}/svg/", exist_ok=True)

    fig, ax = plt.subplots()
    try: 
        im = ax.pcolormesh(
            feat_data["left_names"],
            feat_data["right_names"],
            np.transpose(feat_data["scores"]),
            shading="auto",
        )
        fig.colorbar(im, ax=ax)
        plt.xlabel(feature_name_left)
        plt.ylabel(feature_name_right)
        plt.title(f"Feature: {feature_name_right} x {feature_name_left}")
        plt.savefig(f"{model_path}/jpg/{safe_feat_name}.jpg", format="jpg", dpi=300)
        plt.savefig(f"{model_path}/svg/{safe_feat_name}.svg", format="svg")
    except FileNotFoundError as e:
        logger.error(f"Plot could not be created: {e}")
    finally:
        plt.close()

def __calculate_y_values(names, scores):
    if len(names) == len(scores) + 1:
        return np.append(scores, scores[-1])
    else:
        return scores


def main() -> None:
    df = load_data()
    X_train, X_test, y_train, y_test, ct = preprocess_data(df)
    train_model(X_train, X_test, y_train, y_test, ct, "igann") 
    scores_df = pd.DataFrame(plots.data)
    scores_df.to_csv("scores.csv", index=False)
    scores_df.to_excel("scores.xlsx", index=False)
    scores_df.to_json("plot_data.json", orient="records", indent=2)

if __name__ == "__main__":
    main()