export interface PredictionRound {
  userEstimate: number;
  groundTruth: number;
}

export const BONUS_TIERS = [
  {maximumAbsoluteDifference: 25, bonusPercentage: 1},
  {maximumAbsoluteDifference: 50, bonusPercentage: 0.60},
  {maximumAbsoluteDifference: 100, bonusPercentage: 0.30},
] as const;

export function isWithinTolerance(
  userEstimate: number,
  groundTruth: number,
  maximumAbsoluteDifference: number,
): boolean {
  if (!Number.isFinite(userEstimate) || !Number.isFinite(groundTruth) || groundTruth <= 0) {
    return false;
  }

  return Math.abs(userEstimate - groundTruth) <= maximumAbsoluteDifference;
}

export function calculateBonusPercentage(rounds: PredictionRound[]): number {
  if (rounds.length === 0) return 0;

  const tier = BONUS_TIERS.find(({maximumAbsoluteDifference}) =>
    rounds.every(({userEstimate, groundTruth}) =>
      isWithinTolerance(userEstimate, groundTruth, maximumAbsoluteDifference)
    )
  );

  return tier?.bonusPercentage ?? 0;
}

export function calculateRoundBonusPercentage(round: PredictionRound): number {
  const tier = BONUS_TIERS.find(({maximumAbsoluteDifference}) =>
    isWithinTolerance(round.userEstimate, round.groundTruth, maximumAbsoluteDifference)
  );

  return tier?.bonusPercentage ?? 0;
}

export function calculateAverageBonusPercentage(rounds: PredictionRound[]): number {
  if (rounds.length === 0) return 0;

  return rounds.reduce(
    (total, round) => total + calculateRoundBonusPercentage(round),
    0,
  ) / rounds.length;
}

export function calculateBonusAmount(baseCompensation: number, rounds: PredictionRound[]): number {
  if (!Number.isFinite(baseCompensation) || baseCompensation < 0) return 0;

  return Number((baseCompensation * calculateAverageBonusPercentage(rounds)).toFixed(2));
}
