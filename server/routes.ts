import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { 
  insertPalletSchema, 
  insertLotSchema, 
  insertTransactionSchema 
} from "@shared/schema";
import { z } from "zod";

type WSMessage = {
  type: string;
  data: any;
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Broadcast to all clients
  const broadcast = (message: WSMessage) => {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(message));
      }
    });
  };

  // WebSocket connection
  wss.on('connection', (ws) => {
    console.log('Client connected');
    
    // Send current pallets to new client
    storage.getPallets().then(pallets => {
      ws.send(JSON.stringify({
        type: 'init',
        data: { 
          pallets,
          connectedUsers: wss.clients.size
        }
      }));
    });

    // Broadcast connected users count
    broadcast({
      type: 'userCount',
      data: wss.clients.size
    });

    // Handle client disconnect
    ws.on('close', () => {
      console.log('Client disconnected');
      broadcast({
        type: 'userCount',
        data: wss.clients.size
      });
    });
  });

  // API Routes
  // Get all pallets with their lots
  app.get('/api/pallets', async (req, res) => {
    try {
      const pallets = await storage.getPallets();
      res.json(pallets);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch pallets' });
    }
  });

  // Get a single pallet with its lots
  app.get('/api/pallets/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pallet = await storage.getPallet(id);
      
      if (!pallet) {
        return res.status(404).json({ message: 'Pallet not found' });
      }
      
      res.json(pallet);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch pallet' });
    }
  });

  // Generate a new pallet ID
  app.get('/api/pallets/generate-id', async (req, res) => {
    try {
      const palletId = await storage.generatePalletId();
      res.json({ palletId });
    } catch (error) {
      res.status(500).json({ message: 'Failed to generate pallet ID' });
    }
  });

  // Create a new pallet
  app.post('/api/pallets', async (req, res) => {
    try {
      const validatedData = insertPalletSchema.parse(req.body);
      const pallet = await storage.createPallet(validatedData);
      
      // If initial lot data was provided, create it
      if (req.body.initialLot) {
        const lotData = {
          ...req.body.initialLot,
          palletId: pallet.id
        };
        
        const validatedLot = insertLotSchema.parse(lotData);
        const lot = await storage.createLot(validatedLot);
      }
      
      const palletWithLots = await storage.getPallet(pallet.id);
      
      // Broadcast new pallet
      broadcast({
        type: 'palletCreated',
        data: palletWithLots
      });
      
      res.status(201).json(palletWithLots);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create pallet' });
    }
  });

  // Update a pallet
  app.patch('/api/pallets/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertPalletSchema.partial().parse(req.body);
      
      const updatedPallet = await storage.updatePallet(id, validatedData);
      
      if (!updatedPallet) {
        return res.status(404).json({ message: 'Pallet not found' });
      }
      
      const palletWithLots = await storage.getPallet(id);
      
      // Broadcast pallet update
      broadcast({
        type: 'palletUpdated',
        data: palletWithLots
      });
      
      res.json(palletWithLots);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to update pallet' });
    }
  });

  // Create a new lot for a pallet
  app.post('/api/lots', async (req, res) => {
    try {
      const validatedData = insertLotSchema.parse(req.body);
      const lot = await storage.createLot(validatedData);
      
      // Get updated pallet with lots
      const pallet = await storage.getPallet(lot.palletId);
      
      // Broadcast lot creation
      broadcast({
        type: 'lotCreated',
        data: {
          lot,
          pallet
        }
      });
      
      res.status(201).json(lot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create lot' });
    }
  });

  // Update a lot (e.g. when picking)
  app.patch('/api/lots/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertLotSchema.partial().parse(req.body);
      
      const updatedLot = await storage.updateLot(id, validatedData);
      
      if (!updatedLot) {
        return res.status(404).json({ message: 'Lot not found' });
      }
      
      // Create transaction if needed
      if (req.body.transaction) {
        const transactionData = {
          ...req.body.transaction,
          lotId: id
        };
        
        const validatedTransaction = insertTransactionSchema.parse(transactionData);
        await storage.createTransaction(validatedTransaction);
      }
      
      // If quantity is 0 or less, delete the lot
      if (updatedLot.quantity <= 0) {
        await storage.deleteLot(id);
      }
      
      // Get updated pallet with lots
      const pallet = await storage.getPallet(updatedLot.palletId);
      
      // Broadcast lot update
      broadcast({
        type: 'lotUpdated',
        data: {
          lot: updatedLot,
          pallet
        }
      });
      
      res.json(updatedLot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to update lot' });
    }
  });

  // Delete a lot
  app.delete('/api/lots/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get lot to find pallet ID before deletion
      const lot = await storage.getLot(id);
      
      if (!lot) {
        return res.status(404).json({ message: 'Lot not found' });
      }
      
      const palletId = lot.palletId;
      const deleted = await storage.deleteLot(id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Lot not found' });
      }
      
      // Get updated pallet with lots
      const pallet = await storage.getPallet(palletId);
      
      // Broadcast lot deletion
      broadcast({
        type: 'lotDeleted',
        data: {
          lotId: id,
          pallet
        }
      });
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete lot' });
    }
  });

  // Get transaction history
  app.get('/api/transactions', async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch transactions' });
    }
  });

  // Create a transaction
  app.post('/api/transactions', async (req, res) => {
    try {
      const validatedData = insertTransactionSchema.parse(req.body);
      const transaction = await storage.createTransaction(validatedData);
      
      // Broadcast transaction created
      broadcast({
        type: 'transactionCreated',
        data: transaction
      });
      
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create transaction' });
    }
  });

  return httpServer;
}
