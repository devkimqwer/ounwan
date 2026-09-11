ALTER TABLE "users" ADD COLUMN "public_id" varchar(10);--> statement-breakpoint
UPDATE "users" SET "public_id" = upper(substr(md5('ounwan-user:' || "id"::text), 1, 10)) WHERE "public_id" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "public_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_users_public_id" ON "users" USING btree ("public_id");