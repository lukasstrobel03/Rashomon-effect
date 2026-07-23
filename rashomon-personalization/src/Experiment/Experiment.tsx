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
  group: Math.random() ? "Control" : "Treatment",
}))()

const configurationLookup = normalizedData.configurationData

const Experiment: React.FC<ExperimentProps> = ({initialState}) => {

  const machineInput: Input = { ...sessionContext, initialState: initialState}

  const [snapshot, send] = useMachine(machine, {input: machineInput});

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
              onNext={(evaluationContext: object) => send({type: "finishExperiment", evaluationContext: evaluationContext})}
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