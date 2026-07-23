import {createMachine, assign, not} from "xstate";
import {type Encoding, type UserContext, type Reward, updateContext, selectEncoding, initializeContext} from "./bandit.ts";
import {type DashboardDataByConfiguration, normalizedData} from "./data.tsx";
import {v4 as uuid4} from "uuid";
import {AnalyticsEvent, sendAnalyticsEvent} from "../analytics.ts";
import {Input} from "../stateMachine.ts";


export type Event = { type: "requestEncoding", encodingRequest: EncodingRequest }

type EncodingResponse = {
    id: string,
    userContext: UserContext,
    encoding: Encoding,
    isUpdateRound: boolean,
    isAttentionCheck: boolean,
}

type EncodingRequest = {
    id: string,
    reward: Reward,
    userInput: string,
}

export interface Context extends Input {
  numPersonalizationRounds: Readonly<number>;
  attentionCheckRounds: Readonly<Array<number>>;
  responseStack: Array<EncodingResponse>;
  requestStack: Array<EncodingRequest>;
}

export interface MachineTypes {
  context: Context;
  events: Event;
  input: Input;
}

const configurationLookup = normalizedData.configurationData

const selectFromRashomonSet = (
    userContext: UserContext,
    configurationLookup: DashboardDataByConfiguration,
    selectFromSample: boolean): Encoding => {

    const availableEncodings = Object.keys(configurationLookup);
    if (availableEncodings.length === 0) {
        throw new Error("No dashboard configurations available for personalization.");
    }

    const maxAttempts = 1000;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const encodingCandidate = selectEncoding(userContext, selectFromSample || attempt > 0);
        if (Object.prototype.hasOwnProperty.call(configurationLookup, JSON.stringify(encodingCandidate))) {
            return encodingCandidate;
        }
    }

    return JSON.parse(availableEncodings[Math.floor(Math.random() * availableEncodings.length)]) as Encoding;
}

export const stateMachine = createMachine(
  {
    id: "Personalization",
    initial: "WaitForEncodingRequest",
    context: ({input}) => {
        const attentionCheckRounds = [4]
        return ({
            ...input,
            numPersonalizationRounds: 10,
            attentionCheckRounds: attentionCheckRounds,
            responseStack: [
                (()=> {
                    const initialContext = initializeContext()
                    return {
                        id: uuid4(),
                        userContext: initialContext,
                        encoding: selectFromRashomonSet(initialContext, configurationLookup, true),
                        isUpdateRound: input.group==="Treatment", // should be isControlGroup
                        isAttentionCheck: attentionCheckRounds.includes(0)
                    }
                })()
            ],
            requestStack: []
        })
    },
    states: {
      WaitForEncodingRequest: {
          on: {
              requestEncoding: {
                  actions: [
                      assign({requestStack: ({context, event}) => [
                          event.encodingRequest,
                          ...context.requestStack]
                      }),
                  ],
                  target: "SampleEncoding",
              }
          }
      },
      SampleEncoding: {
          /*
          1) TREATMENT:
            a) regular update: updateContext -> selectFromRashomonSet -> push (context, encoding)
            b) attention check: selectFromRashomonSet -> push (context, encoding)
          2) CONTROL:
            a) regular update: selectFromRashomonSet -> push (context, encoding)
            b) attention check: selectFromRashomonSet -> push (context, encoding)
           */
          always: {
                  actions: [
                      assign({
                          responseStack: ({context}) => [
                              (() => {

                                  const isTreatmentGroup = context.group === "Treatment"
                                  // todo - make it more obvious when what round is taking place
                                  const isAttentionCheckRound = context.attentionCheckRounds.includes(context.responseStack.length)
                                  const isAttentionCheckFollowRound = context.attentionCheckRounds.includes(context.responseStack.length-1)
                                  const isUpdateRound = isTreatmentGroup && !isAttentionCheckFollowRound

                                  const userContext : UserContext = isUpdateRound ?
                                      updateContext(
                                          context.responseStack[0].userContext,
                                          context.responseStack[0].encoding,
                                          context.requestStack[0].reward,
                                      ) : context.responseStack[0].userContext

                                  const isLastRound = context.requestStack.length > context.numPersonalizationRounds
                                  const encoding = isAttentionCheckFollowRound ? context.responseStack[0].encoding : selectFromRashomonSet(userContext, configurationLookup, !isLastRound)

                                  return {
                                      id: uuid4(),
                                      userContext: userContext,
                                      encoding: encoding,
                                      isUpdateRound: isUpdateRound,
                                      isAttentionCheck: isAttentionCheckRound
                                  }
                              })(),
                              ...context.responseStack]
                      }),
                      { type: "logEvent" }
                  ],
                  target: "CheckIfCompleted"
          }
      },
      CheckIfCompleted: {
          always: [
              {
                  guard: not("allRoundsCompleted"),
                  target: "WaitForEncodingRequest",
                  actions: [
                      { type: "logEvent" }
                  ]
              },
              {
                  guard: "allRoundsCompleted",
                  target: "Terminus",
                  actions: [
                      { type: "logEvent" }
                  ]
              }
          ]
      },
      Terminus: {
          entry: { type: "logEvent" },
          type: "final",
          output: ({context}) => context
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
                    type: "EventTransition-Personalization",
                    payload: {event},
                    group: context.group,
                } as AnalyticsEvent
            )}
    },
    actors: {},
    guards: {
        allRoundsCompleted: ({context}) =>
            context.responseStack.length > context.numPersonalizationRounds
    },
    delays: {},
  },
);