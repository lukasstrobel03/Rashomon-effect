import { useMachine } from "@xstate/react";
import {machine, type Event, Input, InitialState} from "./stateMachine.ts";
import Introduction from "./Introduction/Introduction.tsx";
import Evaluation from "./Evaluation/Evaluation.tsx";
import GoodBye from "./GoodBye.tsx";
import Personalization from "./Personalization/Personalization.tsx";
import {v4 as uuidv4} from "uuid";
import {normalizedData} from "./Personalization/data.tsx";

interface ExperimentProps {
  initialState: InitialState
}

const sessionContext = (() : Omit<Input, "initialState"> => ({
  userId: uuidv4(),
  experimentTag: "managementInsights4",
  commitHash: "notImplemented",
  group: Math.random() < 0.5 ? "Control" : "Treatment",
}))()

const configurationLookup = normalizedData.configurationData

const Experiment: React.FC<ExperimentProps> = ({initialState}) => {

  const machineInput: Input = { ...sessionContext, initialState: initialState}

  const [snapshot, send] = useMachine(machine, {input: machineInput});

  const finishExperiment = async (evaluationContext: object) => {
    send({type: "finishExperiment", evaluationContext});

    const personalizationContext = snapshot.context.personalizationContext;
    const prolificId = (snapshot.context.introContext as {prolificId?: string} | undefined)?.prolificId;
    if (!personalizationContext || !prolificId) return;

    const rounds = personalizationContext.requestStack.map((request) => ({
      userEstimate: Number(request.userInput),
      groundTruth: request.groundTruth,
    }));

    try {
      const response = await fetch("/bonus", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          userId: snapshot.context.userId,
          prolificId,
          group: snapshot.context.group,
          rounds,
        }),
      });
      if (!response.ok) {
        console.error("Bonus payment request failed:", await response.text());
      }
    } catch (error) {
      console.error("Bonus payment request failed:", error);
    }
  };

  return (
    <div>
      {snapshot.matches("Intro") && (
        <Introduction
          onNext={(introContext) => send({type: "startPersonalization", introContext: introContext} satisfies Event)}
          machineInput={machineInput}
        />
      )}
      {snapshot.matches("Personalization") && (
          <Personalization
              onNext={(personalizationContext) => send({type: "startEvaluation", personalizationContext: personalizationContext})}
              machineInput={machineInput}
          />
      )}
      {snapshot.matches("Evaluation") && (
          <Evaluation
            onNext={finishExperiment}
              machineInput={machineInput}
              finalEncoding={
                  snapshot.context.personalizationContext?.responseStack[0].encoding ||
                  JSON.parse(Object.keys(configurationLookup)[0])
          }
          />
      )}
      {snapshot.matches("GoodBye") && (
          <GoodBye/>
      )}
    </div>
  );
};

export default Experiment;