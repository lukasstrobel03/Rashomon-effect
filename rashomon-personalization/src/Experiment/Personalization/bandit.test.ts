import {test, expect} from "vitest"
import {updateMu, updateSigma2, getRewardFromDifference, getRewardFromRelativeDifference} from "./bandit";

test('test negative rewards decrease mu', () => {
  expect(
      updateMu([0, 0], [1, 1], [1, 0], -1)[0]
  ).to.be.lessThan(0);
});

test('test positive rewards increase mu', () => {
    expect(
        updateMu([0, 0], [1, 1], [1, 0], 1)[0]
    ).to.be.greaterThan(0);
});

test('test updates decrease variance', () => {
    expect(
        updateSigma2([0, 0], [1, 1], [1, 0], -1)[0]
    ).to.be.lessThan(1);
    expect(
        updateSigma2([0, 0], [1, 1], [1, 0], 1)[0]
    ).to.be.lessThan(1);
});

test('test reward is positive when the user estimate is close to the value', () => {
    expect(getRewardFromDifference(120, 200)).toBe("+1");
    expect(getRewardFromDifference(150, 200)).toBe("+1");
    expect(getRewardFromDifference(300, 200)).toBe("-1");
    expect(getRewardFromDifference(200, 200)).toBe("+1");
});

test('test relative reward uses the ground truth as denominator', () => {
    expect(getRewardFromRelativeDifference(110, 100)).toBe("+1");
    expect(getRewardFromRelativeDifference(121, 100)).toBe("-1");
});
