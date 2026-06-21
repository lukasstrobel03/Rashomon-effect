import json
import os
import glob
import uuid
import pandas as pd
from functools import reduce

def adjust_plot_datum(plot_datum: dict) -> dict:
    time_ticks = [0, 6, 12, 18]
    time_labels = ["00:00", "06:00", "12:00", "18:00"]
    # Handle different naming conventions (e.g. GAM might use 'name' instead of 'feat_name')
    feat_name = plot_datum.get("feat_name", plot_datum.get("name", ""))
    
    match feat_name:
        case "Workingday":
            return {
                **plot_datum,
                "x_ticks": None,
                "x_labels": ["No", "Yes"],
                "X": ["No", "Yes"],
                "Y": plot_datum.get("Y", plot_datum.get("y"))
            }
        case "Weekday":
            return {
                **plot_datum,
                "type": "categorical",
                "X": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
            }
        case "Workingday x Time":
            return {
                **plot_datum,
                "y_labels": ["No", "Yes"],
                "x_ticks": time_ticks,
                "x_labels": time_labels
            }
        case "Weekday x Time":
            return {
                **plot_datum,
                "Y": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                "x_ticks": time_ticks,
                "x_labels": time_labels
            }
        case "Time":
            return {
                **plot_datum,
                "x_ticks": time_ticks,
                "x_labels": time_labels
            }
        case "Temperature x Time":
            return {
                **plot_datum,
                "x_ticks": time_ticks,
                "x_labels": time_labels
            }
        case _:
            return plot_datum

def preprocess_df(df: pd.DataFrame) -> pd.DataFrame:
    if "monotonicity_constraints" in df.columns:
        df["monotonicity_constraints"] = df["monotonicity_constraints"].apply(lambda l: json.dumps(l))
    if "exclude" in df.columns:
        df["exclude"] = df["exclude"].apply(lambda l: json.dumps(l))
    
    # Process plot_data if it exists
    if "plot_data" in df.columns:
        df["plotData"] = df["plot_data"].apply(lambda pd_list: [adjust_plot_datum(pd_item) for pd_item in pd_list])
    return df

def prepare_data_for_study_frontend(raw_data: dict) -> dict:
    df = preprocess_df(pd.DataFrame.from_dict(raw_data))

    # If this dataset does not have 'plot_data' wrapped with hyperparameters, we skip it
    if "plotData" not in df.columns:
        raise ValueError("Datensatz enthaelt nicht die benoetigte 'plot_data' Array-Struktur (moeglicherweise nur einzelner Plot).")

    # Dynamische Erkennung aller relevanten Hyperparameter-Spalten
    possible_hyperparameters = ["exclude", "max_bins", "min_samples_leaf", "n_splines", "penalties", "monotonicity_constraints"]
    actual_hyperparameters = [hp for hp in possible_hyperparameters if hp in df.columns]

    encodings, sorted_hyper_parameter_levels = zip(*[
        (one_hot_encodings := pd.get_dummies(df[hp]), {hp: list(map(str, one_hot_encodings.columns))}) 
        for hp in actual_hyperparameters
    ])

    meta_data = {"hyperparameterLevels": reduce(lambda a, b: {**a, **b}, sorted_hyper_parameter_levels)}

    configuration_data = pd.concat(
        [
            df[["plotData", "score"]], 
            pd.concat(encodings, axis=1).apply(lambda row: json.dumps(row.tolist()), axis=1).rename("encoding")
        ], 
        axis=1
    ).set_index("encoding")

    deduplicated_configuration_data = configuration_data[~configuration_data.index.duplicated()]

    return { "metaData": meta_data, "configurationData": deduplicated_configuration_data.to_dict("index") }

def main():
    raw_files = glob.glob("raw_data/*.json")
    out_dir = "../rashomon-personalization/src/assets"
    os.makedirs(out_dir, exist_ok=True)
    
    print(f"Gefundene Dateien: {len(raw_files)}")
    
    for file in raw_files:
        print(f"\nVerarbeite {file} ...")
        with open(file, 'r') as fp:
            data = json.load(fp)
            
        try:
            prepared_data = prepare_data_for_study_frontend(data)
            
            base_name = os.path.basename(file).replace(".json", "")
            out_filename = f"rashomon_study_data_{base_name}_{str(uuid.uuid4())}.json"
            out_path = os.path.join(out_dir, out_filename)
            
            with open(out_path, 'w') as out_fp:
                json.dump(prepared_data, out_fp)
            print(f" -> Gespeichert in {out_path}")
        except ValueError as e:
            print(f" -> Uebersprungen: {e}")

if __name__ == "__main__":
    main()
