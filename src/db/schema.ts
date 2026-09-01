import { sql } from "drizzle-orm";
import { type AnySQLiteColumn, check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
};

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  avatar: text("avatar").notNull(),
  initialRating: integer("initial_rating").notNull(),
  currentRating: integer("current_rating").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  retiredAt: integer("retired_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  deletedBy: integer("deleted_by").references((): AnySQLiteColumn => users.id, { onDelete: "restrict" }),
  ...timestamps,
}, (table) => [
  uniqueIndex("users_email_ci_unique").on(sql`lower(trim(${table.email}))`),
  uniqueIndex("users_display_name_ci_unique").on(sql`lower(trim(${table.displayName}))`),
  check("users_initial_rating_range", sql`${table.initialRating} between 1000 and 2000`),
]);

export const allowedDomains = sqliteTable("allowed_domains", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domain: text("domain").notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "restrict" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [uniqueIndex("allowed_domains_domain_ci_unique").on(sql`lower(${table.domain})`)]);

export const magicLinks = sqliteTable("magic_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("magic_links_email_idx").on(table.email)]);

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("sessions_user_id_idx").on(table.userId)]);

export const emailChanges = sqliteTable("email_changes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  newEmail: text("new_email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("email_changes_user_id_idx").on(table.userId)]);

export const games = sqliteTable("games", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerOneId: integer("player_one_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  playerTwoId: integer("player_two_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  result: text("result", { enum: ["player_one", "player_two", "draw"] }).notNull(),
  playedOn: text("played_on").notNull(),
  sequence: integer("sequence").notNull(),
  registeredBy: integer("registered_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  playerOneDelta: integer("player_one_delta").notNull(),
  playerTwoDelta: integer("player_two_delta").notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  deletedBy: integer("deleted_by").references(() => users.id, { onDelete: "restrict" }),
  ...timestamps,
}, (table) => [
  check("games_distinct_players", sql`${table.playerOneId} <> ${table.playerTwoId}`),
  check("games_zero_sum", sql`${table.playerOneDelta} + ${table.playerTwoDelta} = 0`),
  uniqueIndex("games_sequence_unique").on(table.sequence),
  index("games_recompute_order_idx").on(table.playedOn, table.sequence),
]);

export const ratingResets = sqliteTable("rating_resets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  rating: integer("rating").notNull(),
  effectiveOn: text("effective_on").notNull(),
  sequence: integer("sequence").notNull(),
  setBy: integer("set_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  deletedBy: integer("deleted_by").references(() => users.id, { onDelete: "restrict" }),
  ...timestamps,
}, (table) => [
  check("rating_resets_range", sql`${table.rating} between 1000 and 2000`),
  uniqueIndex("rating_resets_sequence_unique").on(table.sequence),
  index("rating_resets_user_id_idx").on(table.userId),
  index("rating_resets_recompute_order_idx").on(table.effectiveOn, table.sequence),
]);

export const monthlyAwards = sqliteTable("monthly_awards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  awardMonth: text("award_month").notNull(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  level: text("level", { enum: ["bronze", "silver", "gold"] }).notNull(),
  streak: integer("streak").notNull(),
  awardedAt: integer("awarded_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  deletedBy: integer("deleted_by").references((): AnySQLiteColumn => users.id, { onDelete: "restrict" }),
}, (table) => [
  uniqueIndex("monthly_awards_month_unique").on(table.awardMonth),
  index("monthly_awards_user_id_idx").on(table.userId),
  check("monthly_awards_streak_positive", sql`${table.streak} > 0`),
]);

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorId: integer("actor_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("audit_log_created_at_idx").on(table.createdAt)]);
