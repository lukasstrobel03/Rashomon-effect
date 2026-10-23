DROP TABLE IF EXISTS AnalyticsEvents;
CREATE TABLE IF NOT EXISTS AnalyticsEvents (timestamp INTEGER, userId TEXT, experimentTag TEXT, commitHash TEXT, type TEXT, payload TEXT, userGroup TEXT);

CREATE TABLE IF NOT EXISTS BanditSelections (
	id INTEGER PRIMARY KEY,
	timestamp INTEGER NOT NULL,
	userId TEXT NOT NULL,
	experimentTag TEXT NOT NULL,
	userGroup TEXT NOT NULL,
	roundNumber INTEGER NOT NULL,
	configurationKey TEXT NOT NULL,
	encoding TEXT NOT NULL,
	modelClass TEXT,
	hyperparameters TEXT NOT NULL,
	isUpdateRound INTEGER NOT NULL,
	isAttentionCheck INTEGER NOT NULL,
	isFinalModel INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bandit_selections_model_class
	ON BanditSelections (experimentTag, modelClass);

CREATE VIEW IF NOT EXISTS ModelSelectionSummary AS
SELECT
	experimentTag,
	userGroup,
	modelClass,
	COUNT(*) AS selectionCount,
	COUNT(DISTINCT userId) AS participantCount
FROM BanditSelections
GROUP BY experimentTag, userGroup, modelClass;

CREATE VIEW IF NOT EXISTS ParticipantSummary AS
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

CREATE VIEW IF NOT EXISTS FinalModelSelection AS
SELECT
	userId,
	experimentTag,
	userGroup,
	modelClass,
	configurationKey,
	encoding,
	hyperparameters,
	roundNumber,
	time_stamp
FROM BanditSelections
WHERE isFinalModel = 1;

CREATE VIEW IF NOT EXISTS FinalModelSummary AS
SELECT
	experimentTag,
	userGroup,
	modelClass,
	COUNT(*) AS finalModelCount,
	COUNT(DISTINCT userId) AS participantCount
FROM FinalModelSelection
WHERE modelClass IS NOT NULL
GROUP BY experimentTag, userGroup, modelClass;

CREATE TABLE IF NOT EXISTS BonusPayments (
	userId TEXT PRIMARY KEY,
	prolificId TEXT NOT NULL,
	groupName TEXT NOT NULL,
	roundCount INTEGER NOT NULL,
	bonusPercentage REAL NOT NULL,
	baseCompensation REAL NOT NULL,
	bonusAmount REAL NOT NULL,
	currency TEXT NOT NULL,
	absoluteErrors TEXT NOT NULL,
	status TEXT NOT NULL,
	reviewerNotes TEXT,
	prolificBonusId TEXT,
	errorMessage TEXT,
	createdAt INTEGER NOT NULL,
	updatedAt INTEGER NOT NULL
);

CREATE VIEW IF NOT EXISTS BonusReviewQueue AS
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
	status,
	reviewerNotes,
	createdAt,
	updatedAt
FROM BonusPayments
WHERE status = 'pending_review'
ORDER BY createdAt;