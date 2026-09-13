ALTER TABLE "weekly_settlements" DROP CONSTRAINT "ux_weekly_settlements_group_week";--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "next_settlement_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "weekly_settlements" ADD CONSTRAINT "ux_weekly_settlements_season_week" UNIQUE("season_id","week_start_date");