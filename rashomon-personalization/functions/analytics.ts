import {AnalyticsEvent} from "../src/Experiment/analytics";

interface Env {
    AnalyticsStore: D1Database;
}

interface BanditSelectionPayload {
    roundNumber: number;
    configurationKey: string;
    encoding: number[];
    modelClass: string | null;
    hyperparameters: Record<string, string | null>;
    isUpdateRound: boolean;
    isAttentionCheck: boolean;
    isFinalModel: boolean;
}

function isBanditSelectionPayload(payload: object): payload is BanditSelectionPayload {
    const candidate = payload as Partial<BanditSelectionPayload>;
    return Number.isInteger(candidate.roundNumber) &&
        typeof candidate.configurationKey === "string" &&
        Array.isArray(candidate.encoding) &&
        candidate.encoding.every((value) => typeof value === "number") &&
        (candidate.modelClass === null || typeof candidate.modelClass === "string") &&
        typeof candidate.hyperparameters === "object" &&
        candidate.hyperparameters !== null &&
        typeof candidate.isUpdateRound === "boolean" &&
        typeof candidate.isAttentionCheck === "boolean" &&
        typeof candidate.isFinalModel === "boolean";
}

export const onRequest : PagesFunction<Env>  = async ({request, env}): Promise<Response> => {
    try {
        const event: AnalyticsEvent = await request.json();
        const result = await env.AnalyticsStore.prepare(
            "INSERT INTO AnalyticsEvents (timestamp, userId, experimentTag, commitHash, type, payload, userGroup) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(Date.now(), event.userId, event.experimentTag, event.commitHash, event.type, JSON.stringify(event.payload), event.group).run();

        if (event.type === "BanditConfigurationSelected" && isBanditSelectionPayload(event.payload)) {
            const selection = event.payload;
            await env.AnalyticsStore.prepare(
                `INSERT INTO BanditSelections
                (timestamp, userId, experimentTag, userGroup, roundNumber, configurationKey,
                 encoding, modelClass, hyperparameters, isUpdateRound, isAttentionCheck, isFinalModel)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                Date.now(),
                event.userId,
                event.experimentTag,
                event.group,
                selection.roundNumber,
                selection.configurationKey,
                JSON.stringify(selection.encoding),
                selection.modelClass,
                JSON.stringify(selection.hyperparameters),
                selection.isUpdateRound ? 1 : 0,
                selection.isAttentionCheck ? 1 : 0,
                selection.isFinalModel ? 1 : 0,
            ).run();
        }

        return new Response("Analytics event inserted successfully!", { status: 201 });
    } catch (error) {
        return new Response(`Error inserting event: ${(error as Error).message}`, { status: 500 });
    }
}

export default {
  async fetch(request: any): Promise<Response> {
    if (request.method === "POST" && new URL(request.url).pathname === "/analytics") {
    }
    return new Response("Endpoint not found", { status: 404 });
  },
};