ALTER TABLE BonusPayments ADD COLUMN averageBonusPercentage NOT NULL DEFAULT 0;
ALTER TABLE BonusPayments ADD COLUMN roundPercentages NOT NULL DEFAULT '[]';

DROP VIEW IF EXISTS BonusReviewQueue;

CREATE VIEW BonusReviewQueue AS
SELECT
    userId,
    prolificId,
    groupName,
    roundCount,
    bonusPercentage,
    averageBonusPercentage,
    roundPercentages,
    baseCompensation,
    bonusAmount,
    currency,
    absoluteErrors,
    reviewStatus,
    reviewerNotes,
    createdAt,
    updatedAt
FROM BonusPayments
WHERE reviewStatus = 'pending_review'
ORDER BY createdAt;
