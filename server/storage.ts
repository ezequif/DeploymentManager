import { 
  pallets, Pallet, InsertPallet, 
  lots, Lot, InsertLot,
  transactions, Transaction, InsertTransaction,
  PalletWithLots 
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, sql } from "drizzle-orm";

export interface IStorage {
  // Pallet CRUD
  getPallets(): Promise<PalletWithLots[]>;
  getPallet(id: number): Promise<PalletWithLots | undefined>;
  getPalletByPalletId(palletId: string): Promise<PalletWithLots | undefined>;
  createPallet(pallet: InsertPallet): Promise<Pallet>;
  updatePallet(id: number, pallet: Partial<InsertPallet>): Promise<Pallet | undefined>;
  
  // Lot CRUD
  getLots(palletId: number): Promise<Lot[]>;
  getLot(id: number): Promise<Lot | undefined>;
  createLot(lot: InsertLot): Promise<Lot>;
  updateLot(id: number, lot: Partial<InsertLot>): Promise<Lot | undefined>;
  deleteLot(id: number): Promise<boolean>;
  
  // Transaction CRUD
  getTransactions(): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  
  // Utility
  generatePalletId(): Promise<string>;
}

export class DatabaseStorage implements IStorage {
  async getPallets(): Promise<PalletWithLots[]> {
    const palletsData = await db.select().from(pallets).orderBy(desc(pallets.createdAt));
    
    return Promise.all(palletsData.map(async pallet => {
      const lotsData = await this.getLots(pallet.id);
      return { ...pallet, lots: lotsData };
    }));
  }

  async getPallet(id: number): Promise<PalletWithLots | undefined> {
    const [pallet] = await db.select().from(pallets).where(eq(pallets.id, id));
    if (!pallet) return undefined;

    const lotsData = await this.getLots(id);
    return { ...pallet, lots: lotsData };
  }

  async getPalletByPalletId(palletId: string): Promise<PalletWithLots | undefined> {
    const [pallet] = await db.select().from(pallets).where(eq(pallets.palletId, palletId));
    if (!pallet) return undefined;

    const lotsData = await this.getLots(pallet.id);
    return { ...pallet, lots: lotsData };
  }

  async createPallet(pallet: InsertPallet): Promise<Pallet> {
    const [newPallet] = await db.insert(pallets).values(pallet).returning();
    return newPallet;
  }

  async updatePallet(id: number, pallet: Partial<InsertPallet>): Promise<Pallet | undefined> {
    const [updatedPallet] = await db
      .update(pallets)
      .set(pallet)
      .where(eq(pallets.id, id))
      .returning();
    
    return updatedPallet;
  }

  async getLots(palletId: number): Promise<Lot[]> {
    const lotsData = await db
      .select()
      .from(lots)
      .where(eq(lots.palletId, palletId))
      .orderBy(asc(lots.expirationDate));
    
    return lotsData;
  }

  async getLot(id: number): Promise<Lot | undefined> {
    const [lot] = await db.select().from(lots).where(eq(lots.id, id));
    return lot;
  }

  async createLot(lot: InsertLot): Promise<Lot> {
    const [newLot] = await db.insert(lots).values(lot).returning();
    return newLot;
  }

  async updateLot(id: number, lot: Partial<InsertLot>): Promise<Lot | undefined> {
    const [updatedLot] = await db
      .update(lots)
      .set(lot)
      .where(eq(lots.id, id))
      .returning();
    
    return updatedLot;
  }

  async deleteLot(id: number): Promise<boolean> {
    const result = await db.delete(lots).where(eq(lots.id, id)).returning();
    return result.length > 0;
  }

  async getTransactions(): Promise<Transaction[]> {
    const transactionsData = await db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.createdAt));
    
    return transactionsData;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values({
        ...transaction,
        transactionType: transaction.transactionType as string
      })
      .returning();
    
    return newTransaction;
  }

  async generatePalletId(): Promise<string> {
    // Check if any pallets exist
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pallets);
    
    if (result.count === 0) {
      return "PAL00001";
    }
    
    // Get the highest palletId
    const [maxResult] = await db
      .select({ maxId: pallets.palletId })
      .from(pallets)
      .orderBy(desc(pallets.palletId))
      .limit(1);
    
    if (!maxResult) {
      return "PAL00001";
    }
    
    // Extract the numeric part
    const match = maxResult.maxId.match(/PAL(\d+)/);
    if (!match) {
      return "PAL00001";
    }
    
    const maxNumericPart = parseInt(match[1], 10);
    const nextNumericPart = maxNumericPart + 1;
    
    // Format with leading zeros (5 digits)
    return `PAL${nextNumericPart.toString().padStart(5, '0')}`;
  }
}

export const storage = new DatabaseStorage();