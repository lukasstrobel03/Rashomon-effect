import iceCreamData from "./assets/20241104_plot_data_ice_cream.json";
import {type DashboardData} from "../../DashboardBandit/data.tsx";

export const iceCreamPlotData: Record<string, DashboardData> = Object.fromEntries(
    iceCreamData[0].plot_data.map(
        x => [
            x.feat_name,
            {
                ...x,
                type: (x.type as "numerical" | "categorical" | "interaction"),
                name: x.feat_name,
                smooth: false,
            }
        ]
    )
)