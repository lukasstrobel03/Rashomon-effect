DROP TABLE IF EXISTS AnalyticsEvents;
CREATE TABLE IF NOT EXISTS AnalyticsEvents (timestamp INTEGER, userId TEXT, experimentTag TEXT, commitHash TEXT, type TEXT, payload TEXT, group TEXT);