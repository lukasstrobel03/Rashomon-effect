export interface PredictionRound {
  userEstimate: number;
  groundTruth: number;
}

export const BONUS_TIERS = [
  {maximumRelativeError: 0.05, bonusPercentage: 1},
  {maximumRelativeError: 0.10, bonusPercentage: 0.60},
  {maximumRelativeError: 0.20, bonusPercentage: 0.30},
] as const;

export const MINIMUM_ABSOLUTE_TOLERANCE = 2;

export function getAllowedDifference(groundTruth: number, relativeTolerance: number): number {
  return Math.max(MINIMUM_ABSOLUTE_TOLERANCE, Math.abs(groundTruth) * relativeTolerance);
}

export function isWithinTolerance(
  userEstimate: number,
  groundTruth: number,
  relativeTolerance: number,
): boolean {
  if (!Number.isFinite(userEstimate) || !Number.isFinite(groundTruth) || groundTruth <= 0) {
    return false;
  }

  return Math.abs(userEstimate - groundTruth) <= getAllowedDifference(groundTruth, relativeTolerance);
}

export function getRelativeError(userEstimate: number, groundTruth: number): number {
  if (!Number.isFinite(userEstimate) || !Number.isFinite(groundTruth) || groundTruth <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(userEstimate - groundTruth) / groundTruth;
}

export function calculateBonusPercentage(rounds: PredictionRound[]): number {
  if (rounds.length === 0) return 0;

  const tier = BONUS_TIERS.find(({maximumRelativeError}) =>
    rounds.every(({userEstimate, groundTruth}) =>
      isWithinTolerance(userEstimate, groundTruth, maximumRelativeError)
    )
  );

  return tier?.bonusPercentage ?? 0;
}

export function calculateBonusAmount(baseCompensation: number, rounds: PredictionRound[]): number {
  if (!Number.isFinite(baseCompensation) || baseCompensation < 0) return 0;

  return Number((baseCompensation * calculateBonusPercentage(rounds)).toFixed(2));
}
