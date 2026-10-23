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
    isAttentionCheck INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bandit_selections_model_class
    ON BanditSelections (experimentTag, modelClass);

CREATE VIEW IF NOT EXISTS BanditModelSelectionSummary AS
SELECT
    experimentTag,
    userGroup,
    modelClass,
    COUNT(*) AS selectionCount,
    COUNT(DISTINCT userId) AS participantCount
FROM BanditSelections
GROUP BY experimentTag, userGroup, modelClass;
