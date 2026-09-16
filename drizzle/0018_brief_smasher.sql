ALTER TABLE "post_likes" ADD COLUMN "reaction_type" varchar(20) DEFAULT 'cheer' NOT NULL;--> statement-breakpoint
ALTER TABLE "post_likes" DROP CONSTRAINT "post_likes_post_id_user_id_pk";--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_user_id_reaction_type_pk" PRIMARY KEY("post_id","user_id","reaction_type");