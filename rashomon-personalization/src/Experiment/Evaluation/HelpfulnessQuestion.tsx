import MarkdownBox from "../../utils/MarkdownBox/MarkdownBox.tsx";
import React from "react";
import Dashboard from "../../Dashboard/dashboard.tsx";
import {Encoding} from "../Personalization/bandit.ts";
import {normalizedData} from "../Personalization/data.tsx";
import BackgroundContainer from "../../utils/BackgroundContainer/BackgroundContainer.tsx";
import BoxCol from "../../utils/BoxCol/BoxCol.tsx";
import BoxRow from "../../utils/BoxRow/BoxRow.tsx";
import Box from "../../utils/Box/Box.tsx";
import PredictionQuestion from "../../utils/PredictionQuestion/PredictionQuestion.tsx";
import {getRewardFromDifference} from "../Personalization/bandit.ts";

interface ManagementInsightProps {
    encoding?: Encoding
    onNext: (answer: object) => void
}

const configurationLookup = normalizedData.configurationData

const mdHelpfulnessIntro = `
## Evaluate Your Final Model
Use the final dashboard configuration to estimate the number of rented bikes for the following observation.
`

const HelpfulnessQuestion : React.FC<ManagementInsightProps> = (
    {
        onNext,
        encoding=JSON.parse(Object.keys(configurationLookup)[0])
    }) => {

    return (
        <div>
            <BackgroundContainer>
                <div>
                    <BoxCol>
                        <BoxRow>
                            <Dashboard {...configurationLookup[JSON.stringify(encoding)]}/>
                        </BoxRow>
                        <BoxRow>
                            <BoxCol>
                                <Box color={"transparent"}>
                                    <MarkdownBox markdown={mdHelpfulnessIntro}/>
                                    <PredictionQuestion
                                        plotData={configurationLookup[JSON.stringify(encoding)]?.plotData}
                                        onSubmit={(userEstimate, groundTruth, modelPrediction) => {
                                            const userDifference = Math.abs(userEstimate - groundTruth);
                                            const modelDifference = Math.abs(modelPrediction - groundTruth);

                                            onNext({
                                                userEstimate,
                                                groundTruth,
                                                modelPrediction,
                                                userDifference,
                                                modelDifference,
                                                userReward: getRewardFromDifference(userEstimate, groundTruth),
                                                modelReward: getRewardFromDifference(modelPrediction, groundTruth),
                                            });
                                        }}
                                    />
                                </Box>
                            </BoxCol>
                        </BoxRow>
                    </BoxCol>
                </div>
            </BackgroundContainer>
        </div>
    )
}
export default HelpfulnessQuestion