-- مكتبة الموارد — مادّة خارج الدورة، تمرّ بسلسلة الكتالوج نفسها.
CREATE TABLE IF NOT EXISTS "LibraryResource" (
  "id"            TEXT PRIMARY KEY,
  "kind"          TEXT NOT NULL,
  "titleAr"       TEXT NOT NULL,
  "descriptionAr" TEXT,
  "url"           TEXT NOT NULL,
  "sourceAr"      TEXT,
  "minutes"       INTEGER,
  "skillSlugs"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sortOrder"     INTEGER NOT NULL DEFAULT 0,
  "status"        TEXT NOT NULL DEFAULT 'published',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LibraryResource_status_sortOrder_idx" ON "LibraryResource" ("status", "sortOrder");
