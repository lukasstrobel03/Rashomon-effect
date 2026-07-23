import {assign, createMachine} from "xstate";
import {sendAnalyticsEvent} from "../analytics.ts";
import {AnalyticsEvent} from "../analytics.ts";
import {Input} from "../stateMachine.ts";

export type Event =
    { type: "toEnterProlificId" } |
    { type: "toWelcomeToCityRide", prolificId: string } |
    { type: "toIntroTask1" } |
    { type: "toIntroTask2", introTask1Answer: object } |
    { type: "toIntroTask3", introTask2Answer: object } |
    { type: "toIntroTask4", introTask3Answer: object } |
    { type: "toIntroTask5", introTask4Answer: object } |
    { type: "toIntroTask6", introTask5Answer: object } |
    { type: "toGreatInsights", introTask6Answer: object } |
    { type: "toYourTask" }


interface Context extends Input {
    prolificId?: string;
    introTask1Answer?: object;
    introTask2Answer?: object;
    introTask3Answer?: object;
    introTask4Answer?: object;
    introTask5Answer?: object;
    introTask6Answer?: object;
}

export interface MachineTypes {
  context: Context;
  events: Event;
  input: Input;
}

export const stateMachine = createMachine(
  {
    id: "Introduction",
    initial: "Welcome",
    context: ({input}) => input,
    states: {
      Welcome: {
        on: {
          toEnterProlificId: {
            actions: [
                {type: "logEvent"}
            ],
            target: "EnterProlificId",
          },
        },
      },
      EnterProlificId: {
          on: {
              toWelcomeToCityRide: {
                  actions: [
                      assign({prolificId: ({event}) => event.prolificId }),
                      {type: "logEvent"}
                  ],
                  target: "WelcomeToCityRide"
              }
          }
      },
      WelcomeToCityRide: {
          on: {
              toIntroTask1: {
                  actions: [
                      {type: "logEvent"}
                  ],
                  target: "IntroTask1"
              }
          }
      },
      IntroTask1: {
          on: {
              toIntroTask2: {
                  actions: [
                      assign({introTask1Answer: ({event}) => event.introTask1Answer }),
                      {type: "logEvent"}
                  ],
                  target: "IntroTask2",
              },
          },
      },
      IntroTask2: {
          on: {
              toIntroTask3: {
                  actions: [
                      assign({introTask2Answer: ({event}) => event.introTask2Answer }),
                      {type: "logEvent"}
                  ],
                  target: "IntroTask3",
              },
          },
      },
      IntroTask3: {
          on: {
              toIntroTask4: {
                  actions: [
                      assign({introTask3Answer: ({event}) => event.introTask3Answer }),
                      {type: "logEvent"}
                  ],
                  target: "IntroTask4",
              },
          },
      },
      IntroTask4: {
          on: {
              toIntroTask5: {
                  actions: [
                      assign({introTask4Answer: ({event}) => event.introTask4Answer }),
                      {type: "logEvent"}
                  ],
                  target: "IntroTask6",
              },
          },
      },
      IntroTask5: {
          on: {
              toIntroTask6: {
                  actions: [
                      assign({introTask5Answer: ({event}) => event.introTask5Answer }),
                      {type: "logEvent"}
                  ],
                  target: "IntroTask6",
              },
          },
      },
      IntroTask6: {
          on: {
              toGreatInsights: {
                  actions: [
                      assign({introTask6Answer: ({event}) => event.introTask6Answer }),
                      {type: "logEvent"}
                  ],
                  target: "GreatInsights",
              },
          },
      },
      GreatInsights: {
          on: {
              toYourTask: {
                  target: "YourTask",
              },
          },
      },
      YourTask: {
          entry: [{type: "logEvent"}],
          type: "final"
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
                    type: "EventTransition-Introduction",
                    payload: {event},
                    group: context.group,
                } as AnalyticsEvent
            )}
    },
    actors: {},
    guards: {},
    delays: {},
  },
);