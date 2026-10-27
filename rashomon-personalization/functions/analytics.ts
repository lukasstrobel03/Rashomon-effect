import {AnalyticsEvent} from "../src/Experiment/analytics";
import {
    calculateAverageBonusPercentage,
    calculateBonusAmount,
    calculateRoundBonusPercentage,
    type PredictionRound,
} from "../src/Experiment/bonus";

interface Env {
    AnalyticsStore: D1Database;
    BASE_COMPENSATION: string;
    PROLIFIC_CURRENCY: string;
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

interface BonusPaymentPayload {
    prolificId: string;
    rounds: PredictionRound[];
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

function isPredictionRound(round: PredictionRound): boolean {
    return Number.isFinite(round.userEstimate) &&
        Number.isFinite(round.groundTruth) &&
        round.groundTruth > 0;
}

function isBonusPaymentPayload(payload: object): payload is BonusPaymentPayload {
    const candidate = payload as Partial<BonusPaymentPayload>;
    return typeof candidate.prolificId === "string" &&
        Array.isArray(candidate.rounds) &&
        candidate.rounds.length > 0 &&
        candidate.rounds.every(isPredictionRound);
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

        if (event.type === "BonusPaymentRecorded" && isBonusPaymentPayload(event.payload)) {
            const existing = await env.AnalyticsStore.prepare(
                "SELECT userId FROM BonusPayments WHERE userId = ?"
            ).bind(event.userId).first();

            if (!existing) {
                const baseCompensation = Number(env.BASE_COMPENSATION);
                if (!Number.isFinite(baseCompensation) || baseCompensation < 0) {
                    throw new Error("Bonus payment configuration is incomplete.");
                }

                const roundPercentages = event.payload.rounds.map(calculateRoundBonusPercentage);
                const averageBonusPercentage = calculateAverageBonusPercentage(event.payload.rounds);
                const bonusAmount = calculateBonusAmount(baseCompensation, event.payload.rounds);
                const absoluteErrors = event.payload.rounds.map(({userEstimate, groundTruth}) =>
                    Math.abs(userEstimate - groundTruth)
                );
                const now = Date.now();

                await env.AnalyticsStore.prepare(
                    `INSERT INTO BonusPayments
                    (userId, prolificId, groupName, roundCount, bonusPercentage, averageBonusPercentage,
                     roundPercentages, baseCompensation, bonusAmount, currency, absoluteErrors, status,
                     createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    event.userId,
                    event.payload.prolificId,
                    event.group,
                    event.payload.rounds.length,
                    averageBonusPercentage,
                    averageBonusPercentage,
                    JSON.stringify(roundPercentages),
                    baseCompensation,
                    bonusAmount,
                    env.PROLIFIC_CURRENCY || "GBP",
                    JSON.stringify(absoluteErrors),
                    bonusAmount === 0 ? "no_bonus" : "pending_review",
                    now,
                    now,
                ).run();
            }
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