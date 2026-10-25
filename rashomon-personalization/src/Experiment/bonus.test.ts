import {describe, expect, test} from "vitest";
import {
  calculateAverageBonusPercentage,
  calculateBonusAmount,
  calculateBonusPercentage,
  calculateRoundBonusPercentage,
  isWithinTolerance,
} from "./bonus";

const rounds = (estimate: number, groundTruth = 100) =>
  Array.from({length: 10}, () => ({userEstimate: estimate, groundTruth}));

describe("absolute bonus", () => {
  test("supports a variable number of completed rounds", () => {
    expect(calculateBonusPercentage(rounds(100).slice(0, 9))).toBe(1);
    expect(calculateBonusPercentage([...rounds(100), ...rounds(100).slice(0, 2)])).toBe(1);
    expect(calculateBonusPercentage([...rounds(100), ...rounds(100).slice(0, 5)])).toBe(1);
    expect(calculateBonusPercentage([])).toBe(0);
  });

  test("pays 100 percent when every round is within 25 bikes", () => {
    expect(calculateBonusPercentage(rounds(125))).toBe(1);
  });

  test("pays 60 percent when 25 bikes is exceeded but 50 bikes is met", () => {
    expect(calculateBonusPercentage(rounds(150))).toBe(0.6);
  });

  test("calculates the current round percentage", () => {
    expect(calculateBonusPercentage(rounds(200))).toBe(0.3);
    expect(calculateRoundBonusPercentage({userEstimate: 200, groundTruth: 100})).toBe(0.3);
  });

  test("pays no bonus when one round exceeds 100 bikes", () => {
    const mixedRounds = rounds(125);
    mixedRounds[9] = {userEstimate: 201, groundTruth: 100};
    expect(calculateBonusPercentage(mixedRounds)).toBe(0);
  });

  test("averages round percentages before calculating the bonus", () => {
    const completedRounds = [
      {userEstimate: 100, groundTruth: 100},
      {userEstimate: 150, groundTruth: 100},
      {userEstimate: 200, groundTruth: 100},
      {userEstimate: 300, groundTruth: 100},
    ];
    expect(calculateAverageBonusPercentage(completedRounds)).toBeCloseTo(0.475);
    expect(calculateBonusAmount(7, completedRounds)).toBe(3.33);
  });

  test("uses the same fixed tolerance for different ground truths", () => {
    expect(isWithinTolerance(1025, 1000, 25)).toBe(true);
    expect(isWithinTolerance(125, 100, 25)).toBe(true);
    expect(isWithinTolerance(127, 100, 25)).toBe(false);
  });
});
