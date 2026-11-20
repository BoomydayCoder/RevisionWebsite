CREATE TABLE sources (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  PRIMARY KEY (owner, id)
);
--> statement-breakpoint
CREATE TABLE notes (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (owner, id)
);
