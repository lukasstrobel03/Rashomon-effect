import {assign, createMachine} from "xstate";
import {Input} from "../stateMachine.ts";
import {AnalyticsEvent, sendAnalyticsEvent} from "../analytics.ts";

export type Event =
    { type: "toManagementInsightQuestion" } |
    { type: "toHelpfulnessQuestion", managementInsightAnswer: object } |
    { type: "toOptionalFeedback", helpfulnessAnswer: object } |
    { type: "toPerceivedUsefulness", optionalFeedbackAnswer: object } |
    { type: "toPerceivedEaseOfUse", perceivedUsefulnessAnswer: object } |
    { type: "toPerceivedCognitiveEffort", perceivedEaseOfUseAnswer: object } |
    { type: "toPerceivedInformativeness", perceivedCognitiveEffortAnswer: object, onNext: (snapshot: object) => void } |
    { type: "toMentalModelGoal", perceivedInformativenessAnswer: object } |
    { type: "finishEvaluation", mentalModelGoalAnswer: object, onNext: (snapshot: object) => void }

interface Context extends Input {
    taskReminderAnswer?: object;
    managementInsightAnswer?: object
    helpfulnessAnswer?: object
    optionalFeedbackAnswer?: object
    perceivedCognitiveEffortAnswer?: object
    perceivedInformativenessAnswer?: object
    mentalModelGoalAnswer?: object
    mentalModelInformationAnswer?: object
    perceivedUsefulnessAnswer?: object
    perceivedEaseOfUseAnswer?: object
}

export interface MachineTypes {
  context: Context;
  events: Event;
  input: Input;
}

export const stateMachine = createMachine(
  {
    id: "Evaluation",
    initial: "ManagementInsightQuestion",
    context: ({input}) => input,
    states: {
      TaskReminder: {
        on: {
          toManagementInsightQuestion: {
            actions: {type: "logEvent"},
            target: "ManagementInsightQuestion",
          },
        },
      },
      ManagementInsightQuestion: {
          on: {
              toHelpfulnessQuestion: {
                  actions: [
                      assign({managementInsightAnswer: ({event}) => event.managementInsightAnswer}),
                      {type: "logEvent"}
                  ],
                  target: "HelpfulnessQuestion",
              },
          },
        },
      HelpfulnessQuestion: {
          on: {
              toOptionalFeedback: {
                  actions: [
                      assign({helpfulnessAnswer: ({event}) => event.helpfulnessAnswer}),
                      {type: "logEvent"}
                  ],
                  target: "OptionalFeedback",
              },
          },
      },
      OptionalFeedback: {
          on: {
              toPerceivedUsefulness: {
                  actions: [
                      assign({optionalFeedbackAnswer: ({event}) => event.optionalFeedbackAnswer}),
                      {type: "logEvent"}
                  ],
                  target: "PerceivedUsefulness",
              },
          },
      },
      PerceivedUsefulness: {
          on: {
              toPerceivedEaseOfUse: {
                  actions: [
                      assign({perceivedUsefulnessAnswer: ({event}) => event.perceivedUsefulnessAnswer}),
                      {type: "logEvent"}
                  ],
                  target: "PerceivedEaseOfUse",
              },
          },
      },
      PerceivedEaseOfUse: {
          on: {
              toPerceivedCognitiveEffort: {
                  actions: [
                      assign({perceivedEaseOfUseAnswer: ({event}) => event.perceivedEaseOfUseAnswer}),
                      {type: "logEvent"}
                  ],
                  target: "PerceivedCognitiveEffort",
              },
          },
      },
      PerceivedCognitiveEffort: {
          on: {
              toPerceivedInformativeness: {
                  actions: [
                      assign({perceivedCognitiveEffortAnswer: ({event}) => event.perceivedCognitiveEffortAnswer}),
                      {type: "logEvent"},
                      ({context, event}) => event.onNext(context),
                  ],
                  target: "PerceivedInformativeness",
              },
          },
      },
      PerceivedInformativeness: {
          on: {
              toMentalModelGoal: {
                  actions: [
                      assign({perceivedInformativenessAnswer: ({event}) => event.perceivedInformativenessAnswer}),
                      {type: "logEvent"}
                  ],
                  target: "MentalModelGoal",
              },
          },
      },
      MentalModelGoal: {
          on: {
              finishEvaluation: {
                  actions: [
                      assign({mentalModelGoalAnswer: ({event}) => event.mentalModelGoalAnswer}),
                      {type: "logEvent"},
                      ({context, event}) => event.onNext(context)
                  ],
              },
          },
      },
    },
    types: {} as MachineTypes,
  },
  {
    actions: {
        logEvent: async ({event, context}) => {
            await sendAnalyticsEvent({
                    userId: context.userId,
                    experimentTag: context.experimentTag,
                    commitHash: context.commitHash,
                    type: "EventTransition-Evaluation",
                    payload: {event},
                    group: context.group
                } as AnalyticsEvent
            )}
    },
    actors: {},
    guards: {},
    delays: {},
  },
);