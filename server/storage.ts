import { 
  pallets, Pallet, InsertPallet, 
  lots, Lot, InsertLot,
  transactions, Transaction, InsertTransaction,
  PalletWithLots 
} from "@shared/schema";

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

export class MemStorage implements IStorage {
  private pallets: Map<number, Pallet>;
  private lots: Map<number, Lot>;
  private transactions: Map<number, Transaction>;
  private currentPalletId: number;
  private currentLotId: number;
  private currentTransactionId: number;

  constructor() {
    this.pallets = new Map();
    this.lots = new Map();
    this.transactions = new Map();
    this.currentPalletId = 1;
    this.currentLotId = 1;
    this.currentTransactionId = 1;
  }

  async getPallets(): Promise<PalletWithLots[]> {
    const palletArray = Array.from(this.pallets.values());
    return Promise.all(palletArray.map(async pallet => {
      const palletLots = await this.getLots(pallet.id);
      return { ...pallet, lots: palletLots };
    }));
  }

  async getPallet(id: number): Promise<PalletWithLots | undefined> {
    const pallet = this.pallets.get(id);
    if (!pallet) return undefined;

    const palletLots = await this.getLots(id);
    return { ...pallet, lots: palletLots };
  }

  async getPalletByPalletId(palletId: string): Promise<PalletWithLots | undefined> {
    const pallet = Array.from(this.pallets.values()).find(
      p => p.palletId === palletId
    );
    if (!pallet) return undefined;

    const palletLots = await this.getLots(pallet.id);
    return { ...pallet, lots: palletLots };
  }

  async createPallet(pallet: InsertPallet): Promise<Pallet> {
    const id = this.currentPalletId++;
    const newPallet: Pallet = {
      ...pallet,
      id,
      createdAt: new Date(),
    };
    this.pallets.set(id, newPallet);
    return newPallet;
  }

  async updatePallet(id: number, pallet: Partial<InsertPallet>): Promise<Pallet | undefined> {
    const existingPallet = this.pallets.get(id);
    if (!existingPallet) return undefined;

    const updatedPallet: Pallet = {
      ...existingPallet,
      ...pallet,
    };
    this.pallets.set(id, updatedPallet);
    return updatedPallet;
  }

  async getLots(palletId: number): Promise<Lot[]> {
    return Array.from(this.lots.values()).filter(
      lot => lot.palletId === palletId
    );
  }

  async getLot(id: number): Promise<Lot | undefined> {
    return this.lots.get(id);
  }

  async createLot(lot: InsertLot): Promise<Lot> {
    const id = this.currentLotId++;
    const newLot: Lot = {
      ...lot,
      id,
      createdAt: new Date(),
    };
    this.lots.set(id, newLot);
    return newLot;
  }

  async updateLot(id: number, lot: Partial<InsertLot>): Promise<Lot | undefined> {
    const existingLot = this.lots.get(id);
    if (!existingLot) return undefined;

    const updatedLot: Lot = {
      ...existingLot,
      ...lot,
    };
    this.lots.set(id, updatedLot);
    return updatedLot;
  }

  async deleteLot(id: number): Promise<boolean> {
    return this.lots.delete(id);
  }

  async getTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values());
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const id = this.currentTransactionId++;
    const newTransaction: Transaction = {
      ...transaction,
      id,
      createdAt: new Date(),
    };
    this.transactions.set(id, newTransaction);
    return newTransaction;
  }

  async generatePalletId(): Promise<string> {
    // Find the highest numerical part of existing pallet IDs
    const palletIds = Array.from(this.pallets.values()).map(p => p.palletId);
    
    // Starting with PAL00001 if no pallets exist
    if (palletIds.length === 0) {
      return "PAL00001";
    }
    
    // Extract numerical parts and find the highest
    const numericParts = palletIds.map(id => {
      const match = id.match(/PAL(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    
    const maxNumericPart = Math.max(...numericParts);
    const nextNumericPart = maxNumericPart + 1;
    
    // Format with leading zeros (5 digits)
    return `PAL${nextNumericPart.toString().padStart(5, '0')}`;
  }
}

export const storage = new MemStorage();
