import iceCreamData from "./assets/20241104_plot_data_ice_cream.json";
import {type DashboardData} from "../../DashboardBandit/data.tsx";

export const iceCreamPlotData: Record<string, DashboardData> = 
    Object.fromEntries(
        (iceCreamData[0].plot_data as unknown as DashboardData[]).map(
            x => [x.feat_name, { ...x, smooth: x.smooth ?? null }]
        )
    )