import { 
  Pallet, InsertPallet, 
  Lot, InsertLot,
  Transaction, InsertTransaction,
  PalletWithLots, PalletStatus
} from "@shared/schema";
import { pallets, lots, transactions } from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, sql } from "drizzle-orm";

export interface IStorage {
  // Pallet CRUD
  getPallets(statusFilter?: string): Promise<PalletWithLots[]>;
  getPallet(id: number): Promise<PalletWithLots | undefined>;
  getPalletByPalletId(palletId: string): Promise<PalletWithLots | undefined>;
  createPallet(pallet: InsertPallet): Promise<Pallet>;
  updatePallet(id: number, pallet: Partial<InsertPallet>): Promise<Pallet | undefined>;
  deletePallet(id: number): Promise<boolean>;
  archivePallet(id: number, notes?: string): Promise<Pallet | undefined>;
  
  // Lot CRUD
  getLots(palletId: number): Promise<Lot[]>;
  getLot(id: number): Promise<Lot | undefined>;
  createLot(lot: InsertLot): Promise<Lot>;
  updateLot(id: number, lot: Partial<InsertLot>): Promise<Lot | undefined>;
  deleteLot(id: number): Promise<boolean>;
  
  // Transaction CRUD
  getTransactions(): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  deleteTransaction(id: number): Promise<boolean>;
  
  // Utility
  generatePalletId(): Promise<string>;
  isPalletEmpty(palletId: number): Promise<boolean>;
  
  // FIFO/FEFO Checks
  findOlderLotsWithSameRM(rmNumber: string, excludePalletId?: string): Promise<Array<{pallet: Pallet, lot: Lot}>>;
}

export class DatabaseStorage implements IStorage {
  async findOlderLotsWithSameRM(rmNumber: string, excludePalletId?: string): Promise<Array<{pallet: Pallet, lot: Lot}>> {
    const palletsWithSameRM = await db
      .select()
      .from(pallets)
      .where(eq(pallets.rmNumber, rmNumber))
      .orderBy(asc(pallets.createdAt));
      
    // Build results
    const results: Array<{pallet: Pallet, lot: Lot}> = [];
    
    for (const pallet of palletsWithSameRM) {
      // Skip if this is the pallet we're excluding
      if (excludePalletId && pallet.palletId === excludePalletId) {
        continue;
      }
      
      // Only include active pallets
      if (pallet.status !== "active") {
        continue;
      }
      
      // Get lots for this pallet that have quantity > 0
      const activeLots = await db
        .select()
        .from(lots)
        .where(eq(lots.palletId, pallet.id))
        .orderBy(asc(lots.expirationDate));
        
      // Add each lot with its parent pallet to results
      for (const lot of activeLots) {
        if (lot.quantity > 0) {
          results.push({
            pallet,
            lot
          });
        }
      }
    }
    
    return results;
  }
  async getPallets(statusFilter?: string): Promise<PalletWithLots[]> {
    let query = db.select().from(pallets);
    
    // Apply status filter if provided
    if (statusFilter) {
      query = query.where(eq(pallets.status, statusFilter));
    }
    
    const palletsData = await query.orderBy(desc(pallets.createdAt));
    
    return Promise.all(palletsData.map(async pallet => {
      const lotsData = await this.getLots(pallet.id);
      // Cast status to PalletStatus
      const status = pallet.status as PalletStatus;
      return { ...pallet, lots: lotsData, status };
    }));
  }
  
  async archivePallet(id: number, notes?: string): Promise<Pallet | undefined> {
    // First check if the pallet is empty
    const isEmpty = await this.isPalletEmpty(id);
    if (!isEmpty) {
      throw new Error("Cannot archive a pallet that still has inventory");
    }
    
    // Update the pallet status to archived
    const [archivedPallet] = await db
      .update(pallets)
      .set({ status: "archived" })
      .where(eq(pallets.id, id))
      .returning();
      
    if (!archivedPallet) {
      return undefined;
    }
    
    // Get a sample lot to reference in the transaction
    // We'll use the first lot associated with this pallet historically
    const [firstLot] = await db
      .select()
      .from(lots)
      .where(eq(lots.palletId, id))
      .limit(1);
      
    // Record a transaction for archiving
    if (firstLot) {
      await this.createTransaction({
        lotId: firstLot.id,
        transactionType: "archive",
        quantity: 0,
        notes: notes || `Pallet ${archivedPallet.palletId} archived - empty`
      });
    }
    
    return archivedPallet;
  }
  
  async isPalletEmpty(palletId: number): Promise<boolean> {
    const palletLots = await this.getLots(palletId);
    
    // Check if all lots have zero quantity
    const totalQuantity = palletLots.reduce((sum, lot) => sum + lot.quantity, 0);
    return totalQuantity <= 0 || palletLots.length === 0;
  }

  async getPallet(id: number): Promise<PalletWithLots | undefined> {
    const [pallet] = await db.select().from(pallets).where(eq(pallets.id, id));
    if (!pallet) return undefined;

    const lotsData = await this.getLots(id);
    // Cast status to PalletStatus
    const status = pallet.status as PalletStatus;
    return { ...pallet, lots: lotsData, status };
  }

  async getPalletByPalletId(palletId: string): Promise<PalletWithLots | undefined> {
    const [pallet] = await db.select().from(pallets).where(eq(pallets.palletId, palletId));
    if (!pallet) return undefined;

    const lotsData = await this.getLots(pallet.id);
    // Cast status to PalletStatus
    const status = pallet.status as PalletStatus;
    return { ...pallet, lots: lotsData, status };
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
  
  async deletePallet(id: number): Promise<boolean> {
    try {
      console.log(`Attempting to delete pallet with ID: ${id}`);
      
      // First check if the pallet exists
      const pallet = await this.getPallet(id);
      if (!pallet) {
        console.log(`Pallet with ID: ${id} not found`);
        return false;
      }
      
      console.log(`Found pallet to delete: ${pallet.palletId}`);
      
      // Find all lot IDs related to this pallet
      const lotsToDelete = await this.getLots(id);
      console.log(`Found ${lotsToDelete.length} lots to delete for pallet ID: ${id}`);
      
      // For each lot, delete related transactions first
      for (const lot of lotsToDelete) {
        console.log(`Deleting transactions for lot ID: ${lot.id}`);
        // Delete all transactions related to this lot
        await db.delete(transactions).where(eq(transactions.lotId, lot.id));
      }
      
      // Then delete all lots for this pallet
      console.log(`Deleting lots for pallet ID: ${id}`);
      await db.delete(lots).where(eq(lots.palletId, id));
      
      // Finally delete the pallet
      console.log(`Deleting pallet ID: ${id}`);
      const result = await db.delete(pallets).where(eq(pallets.id, id)).returning();
      
      console.log(`Delete result: ${JSON.stringify(result)}`);
      return result.length > 0;
    } catch (error) {
      console.error(`Error deleting pallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
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
    // If expirationDate is provided, ensure it's properly formatted
    // This prevents timezone issues when dates are saved
    if (lot.expirationDate) {
      // Log the date for debugging
      console.log("Create lot - original date from client:", lot.expirationDate);
      // Keep the date as is, don't create Date objects which could cause timezone shifts
    }
    
    const [newLot] = await db.insert(lots).values(lot).returning();
    return newLot;
  }

  async updateLot(id: number, lot: Partial<InsertLot>): Promise<Lot | undefined> {
    // If expirationDate is provided, ensure it's properly formatted
    // This prevents timezone issues when dates are saved
    if (lot.expirationDate) {
      // Extract the date portion only to prevent timezone issues
      try {
        // Keep date exactly as provided without timezone conversion
        console.log("Original date from client:", lot.expirationDate);
        
        // Format: YYYY-MM-DD - keep it as is, don't create Date objects
        // which could cause timezone shifts
      } catch (error) {
        console.error("Error normalizing date:", error);
      }
    }
    
    const [updatedLot] = await db
      .update(lots)
      .set(lot)
      .where(eq(lots.id, id))
      .returning();
    
    return updatedLot;
  }

  async deleteLot(id: number): Promise<boolean> {
    try {
      console.log(`Attempting to delete lot with ID: ${id}`);
      
      // First delete any transactions related to this lot
      console.log(`Deleting transactions for lot ID: ${id}`);
      await db.delete(transactions).where(eq(transactions.lotId, id));
      
      // Then delete the lot
      console.log(`Deleting lot ID: ${id}`);
      const result = await db.delete(lots).where(eq(lots.id, id)).returning();
      
      console.log(`Delete result: ${JSON.stringify(result)}`);
      return result.length > 0;
    } catch (error) {
      console.error(`Error deleting lot: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
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
  
  async deleteTransaction(id: number): Promise<boolean> {
    const result = await db.delete(transactions).where(eq(transactions.id, id)).returning();
    return result.length > 0;
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