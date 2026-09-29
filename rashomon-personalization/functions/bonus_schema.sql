CREATE TABLE IF NOT EXISTS BonusPayments (
    userId TEXT PRIMARY KEY,
    prolificId TEXT NOT NULL,
    groupName TEXT NOT NULL,
    roundCount INTEGER NOT NULL,
    bonusPercentage REAL NOT NULL,
    baseCompensation REAL NOT NULL,
    bonusAmount REAL NOT NULL,
    currency TEXT NOT NULL,
    relativeErrors TEXT NOT NULL,
    status TEXT NOT NULL,
    prolificBonusId TEXT,
    errorMessage TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);
