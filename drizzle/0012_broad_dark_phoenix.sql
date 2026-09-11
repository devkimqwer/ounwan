CREATE TYPE "public"."daily_duplicate_policy" AS ENUM('count_once', 'count_all');--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "week_start_day" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "day_start_time" time DEFAULT '04:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "daily_duplicate_policy" "daily_duplicate_policy" DEFAULT 'count_once' NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "ck_seasons_week_start_day" CHECK ("seasons"."week_start_day" BETWEEN 0 AND 6);