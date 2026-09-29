import {calculateBonusAmount, calculateBonusPercentage, getRelativeError, type PredictionRound} from "../src/Experiment/bonus";

interface Env {
    AnalyticsStore: D1Database;
    PROLIFIC_API_TOKEN: string;
    PROLIFIC_STUDY_ID: string;
    BASE_COMPENSATION: string;
    PROLIFIC_CURRENCY: string;
}

interface BonusRequest {
    userId: string;
    prolificId: string;
    group: "Control" | "Treatment";
    rounds: PredictionRound[];
}

const PROLIFIC_BONUS_URL = "https://api.prolific.com/api/v1/submissions/bonus-payments/";

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
    if (!Number.isFinite(baseCompensation) || baseCompensation < 0 || !env.PROLIFIC_API_TOKEN || !env.PROLIFIC_STUDY_ID) {
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
    const relativeErrors = body.rounds.map(({userEstimate, groundTruth}) =>
        getRelativeError(userEstimate, groundTruth)
    );
    const now = Date.now();

    await env.AnalyticsStore.prepare(
        `INSERT INTO BonusPayments
        (userId, prolificId, groupName, roundCount, bonusPercentage, baseCompensation, bonusAmount,
         currency, relativeErrors, status, createdAt, updatedAt)
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
        JSON.stringify(relativeErrors),
        "pending",
        now,
        now,
    ).run();

    if (bonusAmount === 0) {
        await env.AnalyticsStore.prepare(
            "UPDATE BonusPayments SET status = ?, updatedAt = ? WHERE userId = ?"
        ).bind("no_bonus", Date.now(), body.userId).run();
        return jsonResponse({status: "no_bonus", bonusAmount: 0, currency});
    }

    try {
        const createResponse = await fetch(PROLIFIC_BONUS_URL, {
            method: "POST",
            headers: {
                Authorization: `Token ${env.PROLIFIC_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                study_id: env.PROLIFIC_STUDY_ID,
                csv_bonuses: `${body.prolificId},${bonusAmount.toFixed(2)}`,
            }),
        });

        if (!createResponse.ok) {
            throw new Error(`Prolific bonus setup failed with status ${createResponse.status}.`);
        }

        const created = await createResponse.json() as {id?: string};
        if (!created.id) throw new Error("Prolific did not return a bonus ID.");

        const payResponse = await fetch(
            `https://api.prolific.com/api/v1/bulk-bonus-payments/${created.id}/pay/`,
            {
                method: "POST",
                headers: {Authorization: `Token ${env.PROLIFIC_API_TOKEN}`},
            },
        );
        if (!payResponse.ok) {
            throw new Error(`Prolific bonus payment failed with status ${payResponse.status}.`);
        }

        await env.AnalyticsStore.prepare(
            "UPDATE BonusPayments SET status = ?, prolificBonusId = ?, updatedAt = ? WHERE userId = ?"
        ).bind("paid", created.id, Date.now(), body.userId).run();

        return jsonResponse({status: "paid", bonusAmount, currency, prolificBonusId: created.id});
    } catch (error) {
        const errorMessage = (error as Error).message;
        await env.AnalyticsStore.prepare(
            "UPDATE BonusPayments SET status = ?, errorMessage = ?, updatedAt = ? WHERE userId = ?"
        ).bind("failed", errorMessage, Date.now(), body.userId).run();
        return jsonResponse({status: "failed", error: errorMessage}, 502);
    }
};
