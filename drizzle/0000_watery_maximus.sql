CREATE TYPE "public"."group_visibility" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('active', 'disabled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."join_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('admin', 'treasurer', 'member');--> statement-breakpoint
CREATE TYPE "public"."oauth_provider" AS ENUM('kakao');--> statement-breakpoint
CREATE TYPE "public"."season_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('draft', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."storage_provider" AS ENUM('local', 's3', 'oci');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'blocked', 'deleted');--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"group_id" bigint PRIMARY KEY NOT NULL,
	"bank_name" varchar(100) NOT NULL,
	"account_number" varchar(100) NOT NULL,
	"holder_name" varchar(100) NOT NULL,
	"updated_by_user_id" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_balance_records" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"group_id" bigint NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"memo" text,
	"image_storage_provider" "storage_provider" DEFAULT 'local' NOT NULL,
	"image_storage_key" text NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_invites" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"group_id" bigint NOT NULL,
	"season_id" bigint NOT NULL,
	"invite_token" varchar(120) NOT NULL,
	"created_by_user_id" bigint NOT NULL,
	"expires_at" timestamp with time zone,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"status" "invite_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_invites_invite_token_unique" UNIQUE("invite_token"),
	CONSTRAINT "ck_group_invites_max_uses" CHECK ("group_invites"."max_uses" IS NULL OR "group_invites"."max_uses" > 0),
	CONSTRAINT "ck_group_invites_used_count" CHECK ("group_invites"."used_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "group_join_requests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"group_id" bigint NOT NULL,
	"season_id" bigint NOT NULL,
	"invite_id" bigint,
	"user_id" bigint NOT NULL,
	"status" "join_request_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by_user_id" bigint,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "ux_group_join_requests_group_season_user" UNIQUE("group_id","season_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"roles" "member_role"[] DEFAULT ARRAY['member']::member_role[] NOT NULL,
	"joined_at" date NOT NULL,
	"left_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_members_group_id_user_id_pk" PRIMARY KEY("group_id","user_id"),
	CONSTRAINT "ck_group_members_left_after_join" CHECK ("group_members"."left_at" IS NULL OR "group_members"."left_at" >= "group_members"."joined_at")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"visibility" "group_visibility" DEFAULT 'private' NOT NULL,
	"owner_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_oauth_accounts_provider_user" UNIQUE("provider","provider_user_id"),
	CONSTRAINT "ux_oauth_accounts_user_provider" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "post_comments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"post_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "post_likes" (
	"post_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_likes_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "post_media" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"post_id" bigint NOT NULL,
	"media_type" "media_type" NOT NULL,
	"storage_provider" "storage_provider" DEFAULT 'local' NOT NULL,
	"storage_key" text NOT NULL,
	"url" text,
	"thumbnail_url" text,
	"file_size_bytes" bigint,
	"content_type" varchar(100),
	"sort_order" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_post_media_sort_order" CHECK ("post_media"."sort_order" > 0),
	CONSTRAINT "ck_post_media_file_size" CHECK ("post_media"."file_size_bytes" IS NULL OR "post_media"."file_size_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "season_participant_periods" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"season_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_season_participant_periods_end_after_start" CHECK ("season_participant_periods"."end_date" IS NULL OR "season_participant_periods"."end_date" >= "season_participant_periods"."start_date")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"group_id" bigint NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"target_workout_count_per_week" integer NOT NULL,
	"fine_per_miss" integer NOT NULL,
	"status" "season_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_seasons_end_after_start" CHECK ("seasons"."end_date" IS NULL OR "seasons"."end_date" >= "seasons"."start_date"),
	CONSTRAINT "ck_seasons_target_positive" CHECK ("seasons"."target_workout_count_per_week" > 0),
	CONSTRAINT "ck_seasons_fine_non_negative" CHECK ("seasons"."fine_per_miss" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"avatar_color" varchar(20),
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "weekly_settlement_rows" (
	"settlement_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"valid_workout_count" integer NOT NULL,
	"missed_count" integer NOT NULL,
	"auto_fine_amount" integer NOT NULL,
	"final_fine_amount" integer NOT NULL,
	"memo" text,
	"updated_by_user_id" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_settlement_rows_settlement_id_user_id_pk" PRIMARY KEY("settlement_id","user_id"),
	CONSTRAINT "ck_weekly_settlement_rows_counts" CHECK ("weekly_settlement_rows"."valid_workout_count" >= 0 AND "weekly_settlement_rows"."missed_count" >= 0 AND "weekly_settlement_rows"."auto_fine_amount" >= 0 AND "weekly_settlement_rows"."final_fine_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "weekly_settlements" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"group_id" bigint NOT NULL,
	"season_id" bigint NOT NULL,
	"week_start_date" date NOT NULL,
	"week_end_date" date NOT NULL,
	"status" "settlement_status" DEFAULT 'draft' NOT NULL,
	"comment" text,
	"confirmed_by_user_id" bigint,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_weekly_settlements_group_week" UNIQUE("group_id","week_start_date"),
	CONSTRAINT "ck_weekly_settlements_date_range" CHECK ("weekly_settlements"."week_end_date" >= "weekly_settlements"."week_start_date")
);
--> statement-breakpoint
CREATE TABLE "workout_posts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"group_id" bigint NOT NULL,
	"season_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"workout_date" date NOT NULL,
	"workout_type" varchar(50) NOT NULL,
	"content" text,
	"is_invalid" boolean DEFAULT false NOT NULL,
	"invalidated_by_user_id" bigint,
	"invalidated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_balance_records" ADD CONSTRAINT "bank_balance_records_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_balance_records" ADD CONSTRAINT "bank_balance_records_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_invite_id_group_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."group_invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_workout_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."workout_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_workout_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."workout_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_workout_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."workout_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_participant_periods" ADD CONSTRAINT "season_participant_periods_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_participant_periods" ADD CONSTRAINT "season_participant_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_settlement_rows" ADD CONSTRAINT "weekly_settlement_rows_settlement_id_weekly_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."weekly_settlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_settlement_rows" ADD CONSTRAINT "weekly_settlement_rows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_settlement_rows" ADD CONSTRAINT "weekly_settlement_rows_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_settlements" ADD CONSTRAINT "weekly_settlements_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_settlements" ADD CONSTRAINT "weekly_settlements_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_settlements" ADD CONSTRAINT "weekly_settlements_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_posts" ADD CONSTRAINT "workout_posts_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_posts" ADD CONSTRAINT "workout_posts_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_posts" ADD CONSTRAINT "workout_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_posts" ADD CONSTRAINT "workout_posts_invalidated_by_user_id_users_id_fk" FOREIGN KEY ("invalidated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bank_balance_records_group_created" ON "bank_balance_records" USING btree ("group_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_group_invites_group_season" ON "group_invites" USING btree ("group_id","season_id");--> statement-breakpoint
CREATE INDEX "idx_group_join_requests_review" ON "group_join_requests" USING btree ("group_id","status","requested_at");--> statement-breakpoint
CREATE INDEX "idx_post_comments_post_created" ON "post_comments" USING btree ("post_id","created_at") WHERE "post_comments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_post_media_post_order" ON "post_media" USING btree ("post_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_season_participant_periods_season_user" ON "season_participant_periods" USING btree ("season_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_seasons_one_active_per_group" ON "seasons" USING btree ("group_id") WHERE "seasons"."status" = 'active';--> statement-breakpoint
CREATE INDEX "idx_weekly_settlements_season_week" ON "weekly_settlements" USING btree ("season_id","week_start_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_workout_posts_feed" ON "workout_posts" USING btree ("group_id","season_id","created_at" DESC NULLS LAST) WHERE "workout_posts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_workout_posts_weekly_count" ON "workout_posts" USING btree ("season_id","user_id","workout_date") WHERE "workout_posts"."deleted_at" IS NULL AND "workout_posts"."is_invalid" = false;