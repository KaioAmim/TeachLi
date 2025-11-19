import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Sessões de interpretação
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }),
  type: mysqlEnum("type", ["professor", "aluno"]).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

// Histórico de traduções
export const translations = mysqlTable("translations", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  type: mysqlEnum("type", ["speech_to_libras", "libras_to_speech"]).notNull(),
  originalText: text("originalText"),
  translatedText: text("translatedText"),
  videoUrl: varchar("videoUrl", { length: 500 }),
  confidence: int("confidence"), // 0-100
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Translation = typeof translations.$inferSelect;
export type InsertTranslation = typeof translations.$inferInsert;

// Gestos de Libras treinados (para expansão futura)
export const gestures = mysqlTable("gestures", {
  id: int("id").autoincrement().primaryKey(),
  word: varchar("word", { length: 100 }).notNull(),
  gloss: varchar("gloss", { length: 100 }),
  landmarksData: text("landmarksData"), // JSON
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Gesture = typeof gestures.$inferSelect;
export type InsertGesture = typeof gestures.$inferInsert;