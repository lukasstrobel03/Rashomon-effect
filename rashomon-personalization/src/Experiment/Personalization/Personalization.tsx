import {stateMachine} from "./stateMachine.ts";
import {useMachine} from "@xstate/react";
import Dashboard from "../../Dashboard/dashboard.tsx";
import React from "react";
import {normalizedData} from "./data.tsx";
import {MultiQuestionLikertForm} from "../../utils/LikertScale/MultiQuestionLikertForm.tsx";
import MarkdownBox from "../../utils/MarkdownBox/MarkdownBox.tsx";
import BackgroundContainer from "../../utils/BackgroundContainer/BackgroundContainer.tsx";
import Box from "../../utils/Box/Box.tsx";
import BoxCol from "../../utils/BoxCol/BoxCol.tsx";
import BoxRow from "../../utils/BoxRow/BoxRow.tsx";
import {Input} from "../stateMachine.ts";
import {Context} from "./stateMachine.ts";
import {useEffect} from "react";

const configurationLookup = normalizedData.configurationData

interface PersonalizationProps {
    onNext: (personaliationContext: Context) => void
    machineInput: Input
}

const mdIntro = `
Examine the effect plots for CityRide's bike-sharing data above.

**How helpful do you find this configuration?**
`



const mdReminder = `
Remember: Consider how this configuration might help you identify trends, patterns, and relationships in
bike-sharing usage.
`

const Personalization: React.FC<PersonalizationProps> = ({onNext, machineInput}) : JSX.Element => {

    const [snapshot, send] = useMachine(stateMachine, {input: machineInput});
    const currentResponse = snapshot.context?.responseStack?.[0];

    useEffect(() => {
        if (snapshot.status === "done") {
            const doneContext = (snapshot.output ?? snapshot.context) as Context | undefined;
            if (doneContext) {
                onNext(doneContext);
            }
        }
    }, [snapshot.status, snapshot.output, snapshot.context, onNext]);

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

    const encoding = currentResponse.encoding
    const isAttentionCheck = currentResponse.isAttentionCheck

    const handleClick = (answer: string) : void => {
        const id = currentResponse.id
        const reward = ["6", "7"].includes(answer) ? "+1" : "-1"
        send({
                type: "requestEncoding",
                encodingRequest: {id: id, reward: reward, userInput: answer}
        })
    }

    return (
        <div>
            <BackgroundContainer>
                    <BoxCol>
                        <BoxRow>
                            <Dashboard {...configurationLookup[JSON.stringify(encoding)]}/>
                        </BoxRow>
                        <BoxRow>
                            <Box color={"green"}>
                                <BoxRow>
                                    <Box color={"transparent"}>
                                        <div style={{minWidth: "25vw"}}>
                                            <MarkdownBox markdown={mdIntro}/>
                                            <MarkdownBox markdown={mdReminder}/>
                                        </div>
                                    </Box>
                                    <Box color={"transparent"}>
                                        <MultiQuestionLikertForm
                                            questions={[{
                                                id: "helpfulness-personalization",
                                                question: isAttentionCheck ? "**Rate this Dashboard with 4 to show that your are paying attention**" : "**How *helpful* was this dashboard configuration for generating insights?**",
                                                isAttentionCheck: isAttentionCheck
                                            }]}
                                            scale={{
                                                options: ["1", "2", "3", "4", "5", "6", "7"],
                                                leftLabel: "Not at all helpful",
                                                rightLabel: "Very helpful"
                                            }}
                                            //@ts-expect-error fix answer type with key
                                            onSubmit={(answer) => handleClick(answer["helpfulness-personalization"])}
                                        />
                                    </Box>
                                </BoxRow>
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