import {stateMachine} from "./stateMachine.ts";
import {useMachine} from "@xstate/react";
import Dashboard from "../../Dashboard/dashboard.tsx";
import React, {useEffect, useState} from "react";
import {normalizedData} from "./data.tsx";
import BackgroundContainer from "../../utils/BackgroundContainer/BackgroundContainer.tsx";
import Box from "../../utils/Box/Box.tsx";
import BoxCol from "../../utils/BoxCol/BoxCol.tsx";
import BoxRow from "../../utils/BoxRow/BoxRow.tsx";
import {Input} from "../stateMachine.ts";
import {Context} from "./stateMachine.ts";
import PredictionQuestion from "../../utils/PredictionQuestion/PredictionQuestion.tsx";
import {Reward, getRewardFromRelativeDifference} from "./bandit.ts";
import {calculateBonusAmount, getAllowedDifference} from "../bonus.ts";
import styles from "./index.module.css";
import MarkdownBox from "../../utils/MarkdownBox/MarkdownBox.tsx";

const configurationLookup = normalizedData.configurationData ?? {}
const BASE_COMPENSATION = 7;

interface PersonalizationProps {
    onNext: (personaliationContext: Context) => void
    machineInput: Input
}

interface RewardPopupProps {
    reward: Reward
    estimate: number
    groundTruth: number
    modelPrediction: number
    bonusAmount: number
    roundCount: number
    closePopup: () => void
}

const RewardPopup: React.FC<RewardPopupProps> = ({ reward, closePopup, estimate, groundTruth, modelPrediction, bonusAmount, roundCount }) => {
    const diff = Math.abs(estimate - groundTruth);
    const estimationDiff = getAllowedDifference(groundTruth, 0.20)
    const isGoodEstimate = diff <= estimationDiff;
    const successMessage = isGoodEstimate ?
        `### Your Estimate is off by less than ${estimationDiff} bikes. +1 Point.` :
        `### Your estimate is off by more than ${estimationDiff} bikes. 0 Points.`;
    const mdMessage = `
${successMessage}

Your Estimate: *${estimate}*

Model Estimate: *${Math.round(modelPrediction)}*

Actual Number of Rented Bikes: *${groundTruth}*

Difference Between your Estimate and the Correct Answer: *${diff}*

Current additional compensation: *£${bonusAmount.toFixed(2)}*

This is the current bonus after ${roundCount} round${roundCount === 1 ? "" : "s"}. The final amount is calculated after the last round.
    `;
    const overlayClass = reward === '+1' ? styles.greenOverlay : styles.redOverlay;

    return (
        <>
            <div className={`${styles.overlay} ${overlayClass}`} onClick={closePopup}></div>
            <div className={styles.popup}>
                <MarkdownBox markdown={mdMessage}/>
                <div className={styles.popupActions}>
                    <button type="button" className={styles.closeButton} onClick={closePopup}>Next</button>
                </div>
            </div>
        </>
    );
}

const Personalization: React.FC<PersonalizationProps> = ({onNext, machineInput}): JSX.Element => {

    const [snapshot, send] = useMachine(stateMachine, {input: machineInput});

    const currentResponse = snapshot.context?.responseStack?.[0];
    const encoding = currentResponse?.encoding ?? (
        Object.keys(configurationLookup).length > 0 ? JSON.parse(Object.keys(configurationLookup)[0]) : []
    );

    const [reward, setReward] = useState<Reward>("-1");
    const [estimate, setEstimate] = useState<number>(0)
    const [groundTruth, setGroundTruth] = useState<number>(0)
    const [modelPrediction, setModelPrediction] = useState<number>(0)
    const [bonusAmount, setBonusAmount] = useState<number>(0)
    const [roundCount, setRoundCount] = useState<number>(0)
    const [showPopup, setShowPopup] = useState(false);

    useEffect(() => {
        if (snapshot.status === "done") {
            const doneContext = (snapshot.output ?? snapshot.context) as Context | undefined;
            if (doneContext) {
                onNext(doneContext);
            }
        }
    }, [snapshot.status, snapshot.output, snapshot.context, onNext]);

    const handleClick = (estimate: number, groundTruth: number, modelPrediction: number) : void => {
        setEstimate(estimate)
        setGroundTruth(groundTruth)
        setModelPrediction(modelPrediction)

        const id = currentResponse?.id ?? ""
        const newReward = getRewardFromRelativeDifference(estimate, groundTruth)
        const completedRounds = [
            ...snapshot.context.requestStack.map((request) => ({
                userEstimate: Number(request.userInput),
                groundTruth: request.groundTruth,
            })),
            {userEstimate: estimate, groundTruth},
        ];
        setBonusAmount(calculateBonusAmount(BASE_COMPENSATION, completedRounds));
        setRoundCount(completedRounds.length);

        setReward(newReward);
        setShowPopup(true);

        send({
            type: "requestEncoding",
            encodingRequest: {
                id: id,
                reward: newReward,
                userInput: String(estimate),
                groundTruth,
                modelPrediction,
            }
        })
    }

    const closePopup = () => {
        setShowPopup(false);
    };

    if (!currentResponse) {
        return (
            <div>
                <BackgroundContainer>
                    <BoxCol>
                        <BoxRow>
                            <Box color={"green"}>
                                <Box color={"transparent"}>
                                    <MarkdownBox markdown={"Preparing the next dashboard..."}/>
                                </Box>
                            </Box>
                        </BoxRow>
                    </BoxCol>
                </BackgroundContainer>
            </div>
        );
    }

    return (
        <div>
            <BackgroundContainer>
                {showPopup && <RewardPopup
                    reward={reward}
                    closePopup={closePopup}
                    estimate={estimate}
                    groundTruth={groundTruth}
                    modelPrediction={modelPrediction}
                    bonusAmount={bonusAmount}
                    roundCount={roundCount}
                />}
                <BoxCol>
                    <BoxRow>
                        <Dashboard {...configurationLookup[JSON.stringify(encoding)]}/>
                    </BoxRow>
                    <BoxRow>
                        <Box color={"green"}>
                            <Box color={"transparent"}>
                                <PredictionQuestion
                                    plotData={configurationLookup[JSON.stringify(encoding)]?.plotData ?? []}
                                    onSubmit={handleClick}
                                />
                            </Box>
                        </Box>
                    </BoxRow>
                </BoxCol>
            </BackgroundContainer>
        </div>
    );
};

export default Personalization;