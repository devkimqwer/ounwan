ALTER TABLE "bank_balance_records" DROP COLUMN "image_storage_provider";
ALTER TABLE "post_media" DROP COLUMN "storage_provider";
DROP TYPE "public"."storage_provider";
