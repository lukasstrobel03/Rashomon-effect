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
import {Reward} from "./bandit.ts";
import styles from "./index.module.css"
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
    closePopup: () => void
}

const RewardPopup : React.FC<RewardPopupProps> = ({ reward, closePopup, estimate, groundTruth })=>  {
    const diff = Math.abs(estimate-groundTruth)
    const isGoodEstimate = diff < 100
    const successMessage = isGoodEstimate ?
        "### Your Estimate is off by less than 100 bikes. +1 Point." :
        "### Your estimate is off by more than 100 bikes. 0 Points."
    const mdMessage = `
${successMessage}

Your Estimate: *${estimate}*

Actual Number of Rented Bikes: *${groundTruth}*

Difference Between your Estimate and the Correct Answer: *${diff}*
    `
    const overlayClass = reward === '+1' ? styles.greenOverlay : styles.redOverlay;
    
    return (
        <>
            <div className={`${styles.overlay} ${overlayClass}`} onClick={closePopup}></div>


            <div className={styles.popup}>
                <MarkdownBox markdown={mdMessage}/>
            </div>
        </>
    );
}

const Personalization: React.FC<PersonalizationProps> = ({onNext, machineInput}): JSX.Element => {

    const [snapshot, send] = useMachine(stateMachine, {input: machineInput});

    const encoding = snapshot.context.responseStack[0].encoding
    
    const [reward, setReward] = useState<Reward>("-1");
    const [estimate, setEstimate] = useState<number>(0)
    const [groundTruth, setGroundTruth] = useState<number>(0)
    const [showPopup, setShowPopup] = useState(false);

    const [countdown, setCountdown] = useState(300);

    const handleClick = (estimate: number, groundTruth: number) : void => {
        setEstimate(estimate)
        setGroundTruth(groundTruth)
        const id = snapshot.context.responseStack[0].id
        const difference = Math.abs(estimate - groundTruth)
        const newReward = difference < 100 ? "+1" : "-1"

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
        return () => clearInterval(timer); // Cleanup on component unmount or countdown change
    }, [showPopup, countdown]);

    return (
        <div>
            <BackgroundContainer>
                {showPopup && <RewardPopup reward={reward} closePopup={closePopup} estimate={estimate} groundTruth={groundTruth} />}
                    <BoxCol>
                        <BoxRow>
                            <Dashboard {...configurationLookup[JSON.stringify(encoding)]}/>
                        </BoxRow>
                        <BoxRow>
                            <Box color={"green"}>
                                <Box color={"transparent"}>
                                    <MarkdownBox markdown={`${String(countdown)}s remaining`}/>
                                    <PredictionQuestion onSubmit={handleClick}/>
                                </Box>
                            </Box>
                        </BoxRow>
                        {/*<BoxRow>
                            <ContextVisualization userContext={
                                snapshot.context.responseStack[0].userContext
                            }/>
                        </BoxRow>
                        <BoxRow>
                            <pre>
                           {JSON.stringify(decode(encoding, hyperParameterLevels), null, 2)}
                            </pre>
                            <pre>
                                {JSON.stringify(encoding)}
                            </pre>
                            <pre>
                                {JSON.stringify(configurationLookup[JSON.stringify(encoding)], null, 2)}
                            </pre>
                        </BoxRow>*/}
                    </BoxCol>
            </BackgroundContainer>
        </div>
    )
        ;
};

export default Personalization;