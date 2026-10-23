ALTER TABLE BanditSelections
ADD COLUMN isFinalModel INTEGER NOT NULL DEFAULT 0;

DROP VIEW IF EXISTS BanditModelSelectionSummary;
DROP VIEW IF EXISTS ModelSelectionSummary;
DROP VIEW IF EXISTS ParticipantSummary;
DROP VIEW IF EXISTS FinalModelSelection;
DROP VIEW IF EXISTS FinalModelSummary;

CREATE VIEW ModelSelectionSummary AS
SELECT
    experimentTag,
    userGroup,
    modelClass,
    COUNT(*) AS selectionCount,
    COUNT(DISTINCT userId) AS participantCount
FROM BanditSelections
WHERE modelClass IS NOT NULL
GROUP BY experimentTag, userGroup, modelClass;

CREATE VIEW ParticipantSummary AS
SELECT
    userId,
    experimentTag,
    userGroup,
    COUNT(*) AS personalizationRounds,
    MIN(timestamp) AS startedAt,
    MAX(timestamp) AS finishedAt,
    MAX(roundNumber) AS lastRound
FROM BanditSelections
GROUP BY userId, experimentTag, userGroup;

CREATE VIEW FinalModelSelection AS
SELECT
    userId,
    experimentTag,
    userGroup,
    modelClass,
    configurationKey,
    encoding,
    hyperparameters,
    roundNumber,
    timestamp
FROM BanditSelections
WHERE isFinalModel = 1;

CREATE VIEW FinalModelSummary AS
SELECT
    experimentTag,
    userGroup,
    modelClass,
    COUNT(*) AS finalModelCount,
    COUNT(DISTINCT userId) AS participantCount
FROM FinalModelSelection
WHERE modelClass IS NOT NULL
GROUP BY experimentTag, userGroup, modelClass;
