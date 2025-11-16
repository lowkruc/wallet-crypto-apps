-- Add username column temporarily nullable
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Populate usernames based on email local part, normalized to lowercase alphanumerics/underscores
UPDATE "User"
SET "username" = lower(regexp_replace(split_part("email", '@', 1), '[^a-z0-9_]', '_', 'g'))
WHERE "username" IS NULL;

-- Ensure uniqueness by appending suffixes to duplicates
WITH ranked AS (
  SELECT
    "id",
    "username",
    ROW_NUMBER() OVER (PARTITION BY "username" ORDER BY "id") AS rn
  FROM "User"
)
UPDATE "User"
SET "username" = concat("User"."username", '_', ranked.rn - 1)
FROM ranked
WHERE "User"."id" = ranked."id"
  AND ranked.rn > 1;

-- Final guard to replace any empty usernames with generated handles
UPDATE "User"
SET "username" = concat('user_', substr(md5("id"::text), 1, 8))
WHERE "username" IS NULL
   OR length(trim("username")) = 0;

-- Enforce constraints
ALTER TABLE "User"
  ALTER COLUMN "username" SET NOT NULL;

ALTER TABLE "User"
  ADD CONSTRAINT "User_username_key" UNIQUE ("username");
