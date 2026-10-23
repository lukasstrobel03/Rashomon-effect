ALTER TABLE BonusPayments
ADD COLUMN reviewerNotes TEXT;

CREATE VIEW BonusReviewQueue AS
SELECT
    userId,
    prolificId,
    groupName,
    roundCount,
    bonusPercentage,
    baseCompensation,
    bonusAmount,
    currency,
    absoluteErrors,
    reviewStatus,
    reviewerNotes,
    createdAt,
    updatedAt
FROM BonusPayments
WHERE status = 'pending_review'
ORDER BY createdAt;
