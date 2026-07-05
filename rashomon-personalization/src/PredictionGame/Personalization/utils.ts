import {type HyperParameterLevels} from "./data.tsx";

export function offsets(
  configurationUniverse: HyperParameterLevels,
): number[] {
  return Object.values(configurationUniverse).map((vals) => vals.length);
}

export function assembleFeatureEncoding(
  length: number,
  indices: number[],
): number[] {
  const arr = new Array(length).fill(0);
  indices.forEach((index) => {
    arr[index] = 1;
  });
  return arr;
}

export function cumulativeSum(arr: number[]): number[] {
  const acc = (
    (sum) => (value: number) =>
      (sum += value)
  )(0);
  return arr.map(acc);
}
