import { pgTable, text, serial, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Pallet table
export const pallets = pgTable("pallets", {
  id: serial("id").primaryKey(),
  palletId: text("pallet_id").notNull().unique(), // PAL00001, PAL00002, etc.
  rmNumber: text("rm_number").notNull(),
  location: text("location").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Lot table
export const lots = pgTable("lots", {
  id: serial("id").primaryKey(),
  palletId: integer("pallet_id").notNull().references(() => pallets.id, { onDelete: "cascade" }),
  lotNumber: text("lot_number").notNull(),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull(), // KGS or LBS
  expirationDate: text("expiration_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Transaction table for history
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  lotId: integer("lot_id").notNull().references(() => lots.id),
  transactionType: text("transaction_type").notNull(), // 'pick', 'add', 'return', etc.
  quantity: real("quantity").notNull(),
  destination: text("destination"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Zod schemas for validation
export const insertPalletSchema = createInsertSchema(pallets).omit({
  id: true,
  createdAt: true,
});

export const insertLotSchema = createInsertSchema(lots).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

// Types
export type Pallet = typeof pallets.$inferSelect;
export type InsertPallet = z.infer<typeof insertPalletSchema>;

export type Lot = typeof lots.$inferSelect;
export type InsertLot = z.infer<typeof insertLotSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// Extended types for frontend use
export type PalletWithLots = Pallet & {
  lots: Lot[];
};

// Unit type
export const unitSchema = z.enum(["KGS", "LBS"]);
export type Unit = z.infer<typeof unitSchema>;

// Transaction type
export const transactionTypeSchema = z.enum(["pick", "add", "return", "edit", "archive"]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

// Pallet status type
export const palletStatusSchema = z.enum(["active", "archived", "damaged"]);
export type PalletStatus = z.infer<typeof palletStatusSchema>;

// User related schemas
export const userRoleSchema = z.enum(["admin", "manager", "operator", "viewer"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // Hashed password, never store plaintext!
  role: text("role", { enum: ["admin", "manager", "operator", "viewer"] }).notNull().default("viewer"),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastLogin: timestamp("last_login")
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLogin: true
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
