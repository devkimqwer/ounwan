import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userStatusEnum = pgEnum("user_status", ["active", "blocked", "deleted"]);
export const oauthProviderEnum = pgEnum("oauth_provider", ["kakao"]);
export const groupVisibilityEnum = pgEnum("group_visibility", ["private", "public"]);
export const memberRoleEnum = pgEnum("member_role", ["admin", "treasurer", "member"]);
export const seasonStatusEnum = pgEnum("season_status", ["active", "closed"]);
export const inviteStatusEnum = pgEnum("invite_status", ["active", "disabled", "expired"]);
export const joinRequestStatusEnum = pgEnum("join_request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);
export const mediaTypeEnum = pgEnum("media_type", ["image", "video"]);
export const storageProviderEnum = pgEnum("storage_provider", ["local", "s3", "oci"]);
export const settlementStatusEnum = pgEnum("settlement_status", ["draft", "confirmed"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  avatarStorageKey: text("avatar_storage_key"),
  status: userStatusEnum("status").notNull().default("active"),
  ...timestamps,
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: oauthProviderEnum("provider").notNull(),
    providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("ux_oauth_accounts_provider_user").on(table.provider, table.providerUserId),
    unique("ux_oauth_accounts_user_provider").on(table.userId, table.provider),
  ],
);

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedByUserId: bigint("updated_by_user_id", { mode: "bigint" }).references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const groups = pgTable("groups", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  visibility: groupVisibilityEnum("visibility").notNull().default("private"),
  ownerUserId: bigint("owner_user_id", { mode: "bigint" })
    .notNull()
    .references(() => users.id),
  ...timestamps,
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: bigint("group_id", { mode: "bigint" })
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roles: memberRoleEnum("roles").array().notNull().default(sql`ARRAY['member']::member_role[]`),
    joinedAt: date("joined_at").notNull(),
    leftAt: date("left_at"),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    check("ck_group_members_left_after_join", sql`${table.leftAt} IS NULL OR ${table.leftAt} >= ${table.joinedAt}`),
  ],
);

export const seasons = pgTable(
  "seasons",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    groupId: bigint("group_id", { mode: "bigint" })
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    targetWorkoutCountPerWeek: integer("target_workout_count_per_week").notNull(),
    finePerMiss: integer("fine_per_miss").notNull(),
    status: seasonStatusEnum("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ux_seasons_one_active_per_group")
      .on(table.groupId)
      .where(sql`${table.status} = 'active'`),
    check("ck_seasons_end_after_start", sql`${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`),
    check("ck_seasons_target_positive", sql`${table.targetWorkoutCountPerWeek} > 0`),
    check("ck_seasons_fine_non_negative", sql`${table.finePerMiss} >= 0`),
  ],
);

export const seasonParticipantPeriods = pgTable(
  "season_participant_periods",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    seasonId: bigint("season_id", { mode: "bigint" })
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_season_participant_periods_season_user").on(table.seasonId, table.userId),
    check(
      "ck_season_participant_periods_end_after_start",
      sql`${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`,
    ),
  ],
);

export const groupInvites = pgTable(
  "group_invites",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    groupId: bigint("group_id", { mode: "bigint" })
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    seasonId: bigint("season_id", { mode: "bigint" })
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    inviteToken: varchar("invite_token", { length: 120 }).notNull().unique(),
    createdByUserId: bigint("created_by_user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    status: inviteStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_group_invites_group_season").on(table.groupId, table.seasonId),
    check("ck_group_invites_max_uses", sql`${table.maxUses} IS NULL OR ${table.maxUses} > 0`),
    check("ck_group_invites_used_count", sql`${table.usedCount} >= 0`),
  ],
);

export const groupJoinRequests = pgTable(
  "group_join_requests",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    groupId: bigint("group_id", { mode: "bigint" })
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    seasonId: bigint("season_id", { mode: "bigint" })
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    inviteId: bigint("invite_id", { mode: "bigint" }).references(() => groupInvites.id, { onDelete: "set null" }),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: joinRequestStatusEnum("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedByUserId: bigint("reviewed_by_user_id", { mode: "bigint" }).references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    unique("ux_group_join_requests_group_season_user").on(table.groupId, table.seasonId, table.userId),
    index("idx_group_join_requests_review").on(table.groupId, table.status, table.requestedAt),
  ],
);

export const workoutPosts = pgTable(
  "workout_posts",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    groupId: bigint("group_id", { mode: "bigint" })
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    seasonId: bigint("season_id", { mode: "bigint" })
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id),
    workoutDate: date("workout_date").notNull(),
    workoutType: varchar("workout_type", { length: 50 }),
    content: text("content"),
    isInvalid: boolean("is_invalid").notNull().default(false),
    invalidatedByUserId: bigint("invalidated_by_user_id", { mode: "bigint" }).references(() => users.id),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_workout_posts_feed")
      .on(table.groupId, table.seasonId, table.createdAt.desc())
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_workout_posts_weekly_count")
      .on(table.seasonId, table.userId, table.workoutDate)
      .where(sql`${table.deletedAt} IS NULL AND ${table.isInvalid} = false`),
  ],
);

export const postMedia = pgTable(
  "post_media",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    postId: bigint("post_id", { mode: "bigint" })
      .notNull()
      .references(() => workoutPosts.id, { onDelete: "cascade" }),
    mediaType: mediaTypeEnum("media_type").notNull(),
    storageProvider: storageProviderEnum("storage_provider").notNull().default("local"),
    storageKey: text("storage_key").notNull(),
    url: text("url"),
    thumbnailUrl: text("thumbnail_url"),
    fileSizeBytes: bigint("file_size_bytes", { mode: "bigint" }),
    contentType: varchar("content_type", { length: 100 }),
    sortOrder: integer("sort_order").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_post_media_post_order").on(table.postId, table.sortOrder),
    check("ck_post_media_sort_order", sql`${table.sortOrder} > 0`),
    check("ck_post_media_file_size", sql`${table.fileSizeBytes} IS NULL OR ${table.fileSizeBytes} >= 0`),
  ],
);

export const postLikes = pgTable(
  "post_likes",
  {
    postId: bigint("post_id", { mode: "bigint" })
      .notNull()
      .references(() => workoutPosts.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.postId, table.userId] })],
);

export const postComments = pgTable(
  "post_comments",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    postId: bigint("post_id", { mode: "bigint" })
      .notNull()
      .references(() => workoutPosts.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_post_comments_post_created")
      .on(table.postId, table.createdAt)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const weeklySettlements = pgTable(
  "weekly_settlements",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    groupId: bigint("group_id", { mode: "bigint" })
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    seasonId: bigint("season_id", { mode: "bigint" })
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    weekStartDate: date("week_start_date").notNull(),
    weekEndDate: date("week_end_date").notNull(),
    status: settlementStatusEnum("status").notNull().default("draft"),
    comment: text("comment"),
    confirmedByUserId: bigint("confirmed_by_user_id", { mode: "bigint" }).references(() => users.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique("ux_weekly_settlements_group_week").on(table.groupId, table.weekStartDate),
    index("idx_weekly_settlements_season_week").on(table.seasonId, table.weekStartDate.desc()),
    check("ck_weekly_settlements_date_range", sql`${table.weekEndDate} >= ${table.weekStartDate}`),
  ],
);

export const weeklySettlementRows = pgTable(
  "weekly_settlement_rows",
  {
    settlementId: bigint("settlement_id", { mode: "bigint" })
      .notNull()
      .references(() => weeklySettlements.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id),
    validWorkoutCount: integer("valid_workout_count").notNull(),
    missedCount: integer("missed_count").notNull(),
    autoFineAmount: integer("auto_fine_amount").notNull(),
    finalFineAmount: integer("final_fine_amount").notNull(),
    memo: text("memo"),
    updatedByUserId: bigint("updated_by_user_id", { mode: "bigint" }).references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.settlementId, table.userId] }),
    check(
      "ck_weekly_settlement_rows_counts",
      sql`${table.validWorkoutCount} >= 0 AND ${table.missedCount} >= 0 AND ${table.autoFineAmount} >= 0 AND ${table.finalFineAmount} >= 0`,
    ),
  ],
);

export const bankAccounts = pgTable("bank_accounts", {
  groupId: bigint("group_id", { mode: "bigint" })
    .primaryKey()
    .references(() => groups.id, { onDelete: "cascade" }),
  bankName: varchar("bank_name", { length: 100 }).notNull(),
  accountNumber: varchar("account_number", { length: 100 }).notNull(),
  holderName: varchar("holder_name", { length: 100 }).notNull(),
  updatedByUserId: bigint("updated_by_user_id", { mode: "bigint" }).references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bankBalanceRecords = pgTable(
  "bank_balance_records",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    groupId: bigint("group_id", { mode: "bigint" })
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdByUserId: bigint("created_by_user_id", { mode: "bigint" })
      .notNull()
      .references(() => users.id),
    memo: text("memo"),
    imageStorageProvider: storageProviderEnum("image_storage_provider").notNull().default("local"),
    imageStorageKey: text("image_storage_key").notNull(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_bank_balance_records_group_created").on(table.groupId, table.createdAt.desc())],
);
