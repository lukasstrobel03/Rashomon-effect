import { assembleFeatureEncoding, cumulativeSum, offsets } from "../utils.ts";
import { type HyperParameterLevels } from "./data.tsx";

type Encoding = number[];
type Configuration = Record<string, string>

export function encode(
  configuration: Record<string, string>,
  hyperParameterLevels: HyperParameterLevels,
): number[] {
  const relativeConfigurationPositions = (
    Object.entries( hyperParameterLevels)).map(([key, value]) => value.indexOf(configuration[key]));
  const configurationOffsets = offsets( hyperParameterLevels);
  const absoluteConfigurationPositions = [
    0,
    ...configurationOffsets.slice(0, -1),
  ].map((num, idx) => num + relativeConfigurationPositions[idx]);
  const totalNumberOfFeatures = Object.entries( hyperParameterLevels).reduce(
    (acc, [, val]) => acc + val.length,
    0,
  );
  return assembleFeatureEncoding(
    totalNumberOfFeatures,
    absoluteConfigurationPositions,
  );
}

export function decode(
  encoding: Encoding,
  hyperParameterLevels: HyperParameterLevels,
): Configuration {
  const configurationOffsets = cumulativeSum([
    0,
    ...offsets(hyperParameterLevels),
  ]);

  return (
    Object.keys(hyperParameterLevels) as Array<keyof Configuration>
  ).reduce((acc, key, idx) => {
    const value = hyperParameterLevels[key];
    const slice = encoding.slice(
      configurationOffsets[idx],
      configurationOffsets[idx + 1],
    );
    acc[key] = value[slice.indexOf(1)];
    return acc;
  }, {} as Configuration);
}
