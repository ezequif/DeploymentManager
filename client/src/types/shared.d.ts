declare module '@shared/schema' {
  import { z } from 'zod';

  export const unitSchema: z.ZodEnum<["KGS", "LBS"]>;
  export type Unit = z.infer<typeof unitSchema>;

  export const transactionTypeSchema: z.ZodEnum<["pick", "add", "return", "edit"]>;
  export type TransactionType = z.infer<typeof transactionTypeSchema>;

  export type Pallet = {
    id: number;
    palletId: string;
    rmNumber: string;
    location: string;
    createdAt: Date;
  };

  export type Lot = {
    id: number;
    palletId: number;
    lotNumber: string;
    quantity: number;
    unit: Unit;
    expirationDate: string;
    createdAt: Date;
  };

  export type Transaction = {
    id: number;
    lotId: number;
    quantity: number;
    type: TransactionType;
    destination?: string;
    notes?: string;
    createdAt: Date;
  };

  export type PalletWithLots = Pallet & {
    lots: Lot[];
  };

  export const insertPalletSchema: z.ZodObject<any>;
  export type InsertPallet = z.infer<typeof insertPalletSchema>;

  export const insertLotSchema: z.ZodObject<any>;
  export type InsertLot = z.infer<typeof insertLotSchema>;

  export const insertTransactionSchema: z.ZodObject<any>;
  export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
}