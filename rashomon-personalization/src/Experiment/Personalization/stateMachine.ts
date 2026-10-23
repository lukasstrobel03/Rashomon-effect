import {createMachine, assign, not} from "xstate";
import {type Encoding, type UserContext, type Reward, updateContext, selectBestEncoding, initializeContext} from "./bandit.ts";
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
    groundTruth: number,
    modelPrediction: number,
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

function getSelectedHyperparameters(encoding: Encoding): Record<string, string | null> {
    let offset = 0;
    return Object.entries(normalizedData.metaData.hyperparameterLevels).reduce(
        (selected, [name, levels]) => {
            const selectedIndex = encoding
                .slice(offset, offset + levels.length)
                .findIndex((value) => value === 1);
            selected[name] = selectedIndex >= 0 ? levels[selectedIndex] : null;
            offset += levels.length;
            return selected;
        },
        {} as Record<string, string | null>,
    );
}

const selectFromRashomonSet = (
    userContext: UserContext,
    configurationLookup: DashboardDataByConfiguration,
    selectFromSample: boolean): Encoding => {

    const availableEncodings = Object.keys(configurationLookup);
    if (availableEncodings.length === 0) {
        throw new Error("No dashboard configurations available for personalization.");
    }

    const validEncodings = availableEncodings.map((configuration) =>
        JSON.parse(configuration) as Encoding
    );
    return selectBestEncoding(userContext, validEncodings, selectFromSample);
}

export const stateMachine = createMachine(
  {
    id: "Personalization",
    initial: "WaitForEncodingRequest",
    entry: {type: "logConfigurationSelection"},
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
                                  const isUpdateRound =
                                      isTreatmentGroup && !context.responseStack[0].isAttentionCheck

                                  const userContext : UserContext = isUpdateRound ?
                                      updateContext(
                                          context.responseStack[0].userContext,
                                          context.responseStack[0].encoding,
                                          context.requestStack[0].reward,
                                      ) : context.responseStack[0].userContext

                                  const isLastRound = context.requestStack.length >= context.numPersonalizationRounds
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
                      {type: "logConfigurationSelection"},
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
        logConfigurationSelection: async ({context}) => {
            const selectedResponse = context.responseStack[0];
            const configurationKey = JSON.stringify(selectedResponse.encoding);
            const configuration = configurationLookup[configurationKey];

            await sendAnalyticsEvent({
                userId: context.userId,
                experimentTag: context.experimentTag,
                commitHash: context.commitHash,
                type: "BanditConfigurationSelected",
                payload: {
                    roundNumber: context.responseStack.length,
                    configurationKey,
                    encoding: selectedResponse.encoding,
                    modelClass: configuration?.modelClass ?? null,
                    hyperparameters: getSelectedHyperparameters(selectedResponse.encoding),
                    isUpdateRound: selectedResponse.isUpdateRound,
                    isAttentionCheck: selectedResponse.isAttentionCheck,
                    isFinalModel: context.requestStack.length >= context.numPersonalizationRounds,
                },
                group: context.group,
            } satisfies AnalyticsEvent);
        },
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