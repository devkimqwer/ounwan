ALTER TABLE "group_join_requests" DROP CONSTRAINT "ux_group_join_requests_group_season_user";--> statement-breakpoint
ALTER TABLE "group_invites" DROP CONSTRAINT "group_invites_season_id_seasons_id_fk";
--> statement-breakpoint
ALTER TABLE "group_join_requests" DROP CONSTRAINT "group_join_requests_season_id_seasons_id_fk";
--> statement-breakpoint
DROP INDEX "idx_group_invites_group_season";--> statement-breakpoint
CREATE INDEX "idx_group_invites_group" ON "group_invites" USING btree ("group_id");--> statement-breakpoint
ALTER TABLE "group_invites" DROP COLUMN "season_id";--> statement-breakpoint
ALTER TABLE "group_join_requests" DROP COLUMN "season_id";--> statement-breakpoint
ALTER TABLE "group_join_requests" ADD CONSTRAINT "ux_group_join_requests_group_user" UNIQUE("group_id","user_id");