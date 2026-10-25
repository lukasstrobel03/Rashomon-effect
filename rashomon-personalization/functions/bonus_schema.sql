CREATE TABLE IF NOT EXISTS BonusPayments (
    userId TEXT PRIMARY KEY,
    prolificId TEXT NOT NULL,
    groupName TEXT NOT NULL,
    roundCount INTEGER NOT NULL,
    bonusPercentage REAL NOT NULL,
    averageBonusPercentage REAL NOT NULL,
    roundPercentages TEXT NOT NULL,
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
