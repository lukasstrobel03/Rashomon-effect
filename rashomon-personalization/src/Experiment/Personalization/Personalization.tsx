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
import {Reward, getRewardFromDifference} from "./bandit.ts";
import styles from "./index.module.css";
import MarkdownBox from "../../utils/MarkdownBox/MarkdownBox.tsx";

const configurationLookup = normalizedData.configurationData ?? {}

interface PersonalizationProps {
    onNext: (personaliationContext: Context) => void
    machineInput: Input
}

interface RewardPopupProps {
    reward: Reward
    estimate: number
    groundTruth: number
    modelPrediction: number
    closePopup: () => void
}

const RewardPopup: React.FC<RewardPopupProps> = ({ reward, closePopup, estimate, groundTruth, modelPrediction }) => {
    const diff = Math.abs(estimate - groundTruth);
    const estimationDiff = Math.abs(0.2 * groundTruth)
    const isGoodEstimate = diff < estimationDiff;
    const successMessage = isGoodEstimate ?
        `### Your Estimate is off by less than ${estimationDiff} bikes. +1 Point.` :
        `### Your estimate is off by more than ${estimationDiff} bikes. 0 Points.`;
    const mdMessage = `
${successMessage}

Your Estimate: *${estimate}*

Model Estimate: *${Math.round(modelPrediction)}*

Actual Number of Rented Bikes: *${groundTruth}*

Difference Between your Estimate and the Correct Answer: *${diff}*
    `;
    const overlayClass = reward === '+1' ? styles.greenOverlay : styles.redOverlay;

    return (
        <>
            <div className={`${styles.overlay} ${overlayClass}`} onClick={closePopup}></div>
            <div className={styles.popup}>
                <MarkdownBox markdown={mdMessage}/>
                <div className={styles.popupActions}>
                    <button type="button" className={styles.closeButton} onClick={closePopup}>Close</button>
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
    const [showPopup, setShowPopup] = useState(false);
    const [countdown, setCountdown] = useState(300);

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
        const newReward = getRewardFromDifference(estimate, groundTruth)

        setReward(newReward);
        setShowPopup(true);

        send({
            type: "requestEncoding",
            encodingRequest: {id: id, reward: newReward, userInput: String(estimate)}
        })
    }

    const closePopup = () => {
        setShowPopup(false);
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => prev - 1);
        }, 1000);

        if (countdown === 0) {
            clearInterval(timer)
            onNext(snapshot.context)
        }
        return () => clearInterval(timer);
    }, [showPopup, countdown, onNext, snapshot.context]);

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
                {showPopup && <RewardPopup reward={reward} closePopup={closePopup} estimate={estimate} groundTruth={groundTruth} modelPrediction={modelPrediction} />}
                <BoxCol>
                    <BoxRow>
                        <Dashboard {...configurationLookup[JSON.stringify(encoding)]}/>
                    </BoxRow>
                    <BoxRow>
                        <Box color={"green"}>
                            <Box color={"transparent"}>
                                <MarkdownBox markdown={`${String(countdown)}s remaining`}/>
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