import {describe, expect, test} from "vitest";
import {calculateBonusAmount, calculateBonusPercentage, getAllowedDifference, getRelativeError, isWithinTolerance} from "./bonus";

const rounds = (estimate: number, groundTruth = 100) =>
  Array.from({length: 10}, () => ({userEstimate: estimate, groundTruth}));

describe("relative bonus", () => {
  test("supports a variable number of completed rounds", () => {
    expect(calculateBonusPercentage(rounds(100).slice(0, 9))).toBe(1);
    expect(calculateBonusPercentage([...rounds(100), ...rounds(100).slice(0, 2)])).toBe(1);
    expect(calculateBonusPercentage([...rounds(100), ...rounds(100).slice(0, 5)])).toBe(1);
    expect(calculateBonusPercentage([])).toBe(0);
  });

  test("pays 100 percent when every round is within five percent", () => {
    expect(calculateBonusPercentage(rounds(105))).toBe(1);
  });

  test("pays 60 percent when five percent is exceeded but ten percent is met", () => {
    expect(calculateBonusPercentage(rounds(110))).toBe(0.6);
  });

  test("pays 30 percent when ten percent is exceeded but twenty percent is met", () => {
    expect(calculateBonusPercentage(rounds(120))).toBe(0.3);
    expect(calculateBonusAmount(7, rounds(120))).toBe(2.1);
  });

  test("pays no bonus when one round exceeds twenty percent", () => {
    const mixedRounds = rounds(105);
    mixedRounds[9] = {userEstimate: 121, groundTruth: 100};
    expect(calculateBonusPercentage(mixedRounds)).toBe(0);
  });

  test("uses relative rather than absolute error", () => {
    expect(getRelativeError(1050, 1000)).toBe(0.05);
    expect(getRelativeError(105, 100)).toBe(0.05);
  });

  test("uses a two-bike minimum tolerance for small ground truths", () => {
    expect(getAllowedDifference(10, 0.20)).toBe(2);
    expect(isWithinTolerance(8, 10, 0.20)).toBe(true);
    expect(isWithinTolerance(12, 10, 0.20)).toBe(true);
    expect(isWithinTolerance(7, 10, 0.20)).toBe(false);
  });
});
