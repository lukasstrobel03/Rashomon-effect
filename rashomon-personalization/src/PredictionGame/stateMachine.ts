import {assign, createMachine} from "xstate";
import {type AnalyticsEvent, sendAnalyticsEvent} from "./analytics.ts";
import {Context as PersonalizationContext} from "./Personalization/stateMachine.ts";

export type Event =
    { type: "startPersonalization", introContext: object } |
    { type: "startEvaluation", personalizationContext: PersonalizationContext }  |
    { type: "finishExperiment", evaluationContext: object }

type Group = "Control" | "Treatment"

export type InitialState = "Intro" | "Personalization" | "Evaluation"

export type Input = Pick<AnalyticsEvent, "userId" | "experimentTag" | "commitHash" > & {group: Group, initialState: InitialState}

interface Context extends Input {
    introContext?: object;
    personalizationContext?: PersonalizationContext;
    evaluationContext?: object;
}

export interface MachineTypes {
  context: Context;
  events: Event;
  input: Input;
}

export const machine = createMachine(
  {
    id: "ExperimentMachine",
    initial: "SelectInitialState",
    context: ({input}) => input,
    states: {
      SelectInitialState: {
          always: [
              {
                  guard: ({context}) => context.initialState === "Intro",
                  target: "Intro"
              },
              {
                  guard: ({context}) => context.initialState === "Personalization",
                  target: "Personalization"
              },
              {
                  guard: ({context}) => context.initialState === "Evaluation",
                  target: "Evaluation"
              },
          ]
      },
      Intro: {
        entry: [
            {
                type: "logState",
                params: {type: "ExperimentStarted"}
            }
        ],
        on: {
          startPersonalization: {
              actions: assign({introContext: ({event}) => event.introContext}),
              target: "Personalization",
          },
        },
        exit: [
            {
                type: "logState",
                params: {type: "IntroCompleted"}
            }
        ]
      },
      Personalization : {
          on : {
              startEvaluation : {
                  actions: assign({personalizationContext: ({event}) => event.personalizationContext}),
                  target: "Evaluation"
              }
          },
          exit: [
              {
                  type: "logState",
                  params: {type: "PersonalizationCompleted"}
              }
          ]
      },
      Evaluation: {
          on: {
              finishExperiment: {
                  actions: assign({evaluationContext: ({event}) => event.evaluationContext}),
                  target: "GoodBye",
              },
          },
          exit: [
              {
                  type: "logState",
                  params: {type: "EvaluationCompleted"}
              }
          ]
      },
      GoodBye: {},
      },
    types: {} as MachineTypes,
  },
  {
    actions: {
        //@ts-expect-error type of params is not recognized
        logState: async ({context, event}, params: {type: string}) => {
            await sendAnalyticsEvent({
                userId: context.userId,
                experimentTag: context.experimentTag,
                commitHash: context.commitHash,
                type: params.type,
                payload: {context, event},
                group: context.group,
            } as AnalyticsEvent
        )}
    },
    actors: {},
    guards: {},
    delays: {},
  },
);