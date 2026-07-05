import {UserContext} from "./bandit.ts";
import {DashboardPlot} from "../../Dashboard/dashboard.tsx";
import {DashboardData} from "./data.tsx";
import {hyperParameterLevels} from "./data.tsx";
import BoxRow from "../../utils/BoxRow/BoxRow.tsx";
import BoxCol from "../../utils/BoxCol/BoxCol.tsx";
import MarkdownBox from "../../utils/MarkdownBox/MarkdownBox.tsx";
import React from "react";

interface ContextVisualizationProps {
    userContext: UserContext
}

function prepareData(y: number[], feat_name: string) : DashboardData {
    const preparedData = {
        X: [...Array(y.length).keys()],
        x_labels: Object.values(hyperParameterLevels).flat(1),
        Y: y,
        Z: null,
        type: "categorical" as const,
        feat_name: feat_name,
        x_name: "Hyperparameter Level",
        y_name: feat_name,
        x_ticks: [...Array(y.length).keys()],
        y_ticks: null,
        y_labels: null,
        smooth: null,
    }
    return preparedData
}

const ContextVisualization : React.FC<ContextVisualizationProps> = ({userContext}) => {
    return (
        <div>
            <MarkdownBox markdown={"## Context Visualization for Parameter Tuning"}/>
            <BoxRow>
                <BoxCol>
                    <div className="chart-item">
                        <DashboardPlot dashboardData={prepareData(userContext.mu, "Expected Value")}/>
                    </div>
                </BoxCol>
                <BoxCol>
                    <div className="chart-item">
                        <DashboardPlot dashboardData={prepareData(userContext.sigma2, "Covariance")}/>
                    </div>
                </BoxCol>
            </BoxRow>
        </div>
    )
}

export default ContextVisualization