import iceCreamData from "./assets/20241104_plot_data_ice_cream.json";
import {type DashboardData} from "../../DashboardBandit/data.tsx";

export const iceCreamPlotData = Object.fromEntries(
    iceCreamData[0].plot_data.map(
        x => [
            x.feat_name,
            {
                X: x.X,
                Y: x.Y,
                Z: x.Z ?? null,
                type: x.type as "numerical" | "categorical" | "interaction",
                feat_name: x.feat_name,
                x_name: x.x_name,
                y_name: x.y_name,
                x_ticks: x.x_ticks ?? null,
                y_ticks: x.y_ticks ?? null,
                x_labels: x.x_labels ?? null,
                y_labels: x.y_labels ?? null,
                smooth: null,
            }
        ]
    )
) as unknown as Record<string, DashboardData>