import {calculateBonusAmount, calculateBonusPercentage, type PredictionRound} from "../src/Experiment/bonus";

interface Env {
    AnalyticsStore: D1Database;
    BASE_COMPENSATION: string;
    PROLIFIC_CURRENCY: string;
}

interface BonusRequest {
    userId: string;
    prolificId: string;
    group: "Control" | "Treatment";
    rounds: PredictionRound[];
}

function jsonResponse(body: object, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {"Content-Type": "application/json"},
    });
}

function isValidRound(round: PredictionRound): boolean {
    return Number.isFinite(round.userEstimate) &&
        Number.isFinite(round.groundTruth) &&
        round.groundTruth > 0;
}

export const onRequestPost: PagesFunction<Env> = async ({request, env}) => {
    let body: BonusRequest;
    try {
        body = await request.json() as BonusRequest;
    } catch {
        return jsonResponse({error: "Invalid JSON body."}, 400);
    }

    if (!body.userId || !body.prolificId || !body.group || !Array.isArray(body.rounds) || !body.rounds.every(isValidRound)) {
        return jsonResponse({error: "A user ID, Prolific ID and group are required."}, 400);
    }

    const baseCompensation = Number(env.BASE_COMPENSATION);
    const currency = env.PROLIFIC_CURRENCY || "GBP";
    if (!Number.isFinite(baseCompensation) || baseCompensation < 0) {
        return jsonResponse({error: "Bonus payment configuration is incomplete."}, 500);
    }

    const existing = await env.AnalyticsStore.prepare(
        "SELECT status, bonusAmount, currency, prolificBonusId FROM BonusPayments WHERE userId = ?"
    ).bind(body.userId).first<{status: string; bonusAmount: number; currency: string; prolificBonusId: string | null}>();
    if (existing) {
        return jsonResponse({
            status: existing.status,
            bonusAmount: existing.bonusAmount,
            currency: existing.currency,
            prolificBonusId: existing.prolificBonusId,
        });
    }

    const bonusPercentage = calculateBonusPercentage(body.rounds);
    const bonusAmount = calculateBonusAmount(baseCompensation, body.rounds);
    const absoluteErrors = body.rounds.map(({userEstimate, groundTruth}) =>
        Math.abs(userEstimate - groundTruth)
    );
    const now = Date.now();

    await env.AnalyticsStore.prepare(
        `INSERT INTO BonusPayments
        (userId, prolificId, groupName, roundCount, bonusPercentage, baseCompensation, bonusAmount,
         currency, absoluteErrors, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        body.userId,
        body.prolificId,
        body.group,
        body.rounds.length,
        bonusPercentage,
        baseCompensation,
        bonusAmount,
        currency,
        JSON.stringify(absoluteErrors),
        bonusAmount === 0 ? "no_bonus" : "pending_review",
        now,
        now,
    ).run();

    if (bonusAmount === 0) {
        return jsonResponse({status: "no_bonus", bonusAmount: 0, currency});
    }

    return jsonResponse({
        status: "pending_review",
        bonusAmount,
        currency,
        message: "Bonus recorded for manual validation.",
    });
};
