import gaussian from "gaussian";
import { assembleFeatureEncoding, cumulativeSum, offsets } from "./utils.ts";
import {normalizedData} from "./data.tsx";

export type Encoding = number[]

export type Reward = "+1" | "-1"

const configurationUniverse = normalizedData.metaData.hyperparameterLevels

export interface UserContext {
  mu: number[];
  sigma2: number[];
  beta: number;
}

export function initializeContext(): UserContext {
  const totalNumberOfFeatures = Object.entries(configurationUniverse).reduce(
    (acc, [, val]) => acc + val.length,
    0,
  );
  return {
    mu: new Array(totalNumberOfFeatures).fill(0),
    sigma2: new Array(totalNumberOfFeatures).fill(0.5),
    beta: 0.5,
  };
}

export function updateContext(
  context: UserContext,
  encoding: Encoding,
  reward: Reward,
): UserContext {
  const rewardLookup: Record<Reward, number> = {"-1": -1, "+1": 1}
  return {
    mu: updateMu(context.mu, context.sigma2, encoding, rewardLookup[reward]),
    sigma2: updateSigma2(context.mu, context.sigma2, encoding, rewardLookup[reward]),
    beta: context.beta,
  };
}

export function updateMu(
  mu: number[],
  sigma2: number[],
  x: number[],
  y: number,
): number[] {
  const sEval = Math.sqrt(s2(sigma2, x, 1));
  const nuEval = nu((y * dotProd(x, mu)) / sEval);

  return mu.reduce((acc, m, idx) => {
    acc[idx] = m + ((y * x[idx] * sigma2[idx]) / sEval) * nuEval;
    return acc;
  }, [] as number[]);
}

export function updateSigma2(
  mu: number[],
  sigma2: number[],
  x: number[],
  y: number,
): number[] {
  const s2Eval = s2(sigma2, x, 1);
  const wEval = w((y * dotProd(x, mu)) / Math.sqrt(s2Eval));
  return sigma2.reduce((acc, s, idx) => {
    acc[idx] = s * (1 - (x[idx] / s2Eval) * wEval);
    return acc;
  }, [] as number[]);
}

function s2(sigma2: number[], x: number[], beta: number): number {
  return Math.pow(beta, 2) + dotProd(x, sigma2);
}

function w(t: number): number {
  const nuEval = nu(t);
  return nuEval * (nuEval + t);
}

function nu(t: number): number {
  const distribution = gaussian(0, 1);
  return distribution.pdf(t) / distribution.cdf(t);
}

function dotProd(x: number[], y: number[]) {
  if (x.length !== y.length) {
    throw new Error("x and y are not of equal length!");
  } else {
    return x.reduce((acc, key, index) => acc + key * y[index], 0);
  }
}

function argMax(array: number[]): number {
  return array.map((x, i) => [x, i]).reduce((r, a) => (a[0] > r[0] ? a : r))[1];
}

function sampleMultiVariateNormal(mu: number[], sigma2: number[]): number[] {
  return mu.reduce((acc, m, idx) => {
    const distribution = gaussian(m, sigma2[idx]);
    acc[idx] = distribution.ppf(Math.random());
    return acc;
  }, [] as number[]);
}

export function selectEncoding(context: UserContext, selectFromSample: boolean): Encoding {
  const mu = selectFromSample ? sampleMultiVariateNormal(context.mu, context.sigma2) : context.mu
  const cumulativeOffsets = cumulativeSum(offsets(configurationUniverse));
  const absoluteConfigurationPositions = [
    0,
    ...cumulativeOffsets.slice(0, -1),
  ].map((o, idx) => o + argMax(mu.slice(o, cumulativeOffsets[idx])));
  return assembleFeatureEncoding(
    cumulativeOffsets[cumulativeOffsets.length - 1],
    absoluteConfigurationPositions,
  );
}
