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
    
    // Send current active pallets to new client
    storage.getPallets("active").then(pallets => {
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
  // Get all pallets with their lots (optional status filter)
  app.get('/api/pallets', async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const pallets = await storage.getPallets(status);
      res.json(pallets);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch pallets' });
    }
  });

  // Generate a new pallet ID - specific route must come before parameterized routes
  app.get('/api/pallets/generate-id', async (req, res) => {
    try {
      const palletId = await storage.generatePalletId();
      res.json({ palletId });
    } catch (error) {
      res.status(500).json({ message: 'Failed to generate pallet ID' });
    }
  });
  
  // Get a pallet by its pallet ID (not internal ID) - specific route must come before parameterized routes
  app.get('/api/pallets/by-id/:palletId', async (req, res) => {
    try {
      const palletId = req.params.palletId;
      const pallet = await storage.getPalletByPalletId(palletId);
      
      if (!pallet) {
        return res.status(404).json({ message: 'Pallet not found' });
      }
      
      res.json(pallet);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch pallet' });
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
  
  // Archive a pallet
  app.post('/api/pallets/:id/archive', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const notes = req.body.notes as string | undefined;
      
      try {
        const archivedPallet = await storage.archivePallet(id, notes);
        
        if (!archivedPallet) {
          return res.status(404).json({ message: 'Pallet not found' });
        }
        
        const palletWithLots = await storage.getPallet(id);
        
        // Broadcast pallet update
        broadcast({
          type: 'palletUpdated',
          data: palletWithLots
        });
        
        res.json({ message: 'Pallet archived successfully', pallet: palletWithLots });
      } catch (error) {
        if (error instanceof Error) {
          return res.status(400).json({ message: error.message });
        }
        throw error;
      }
    } catch (error) {
      res.status(500).json({ message: 'Failed to archive pallet' });
    }
  });

  // Create a new lot for a pallet
  app.post('/api/lots', async (req, res) => {
    try {
      const validatedData = insertLotSchema.parse(req.body);
      const lot = await storage.createLot(validatedData);
      
      // Create transaction if needed
      if (req.body.transaction) {
        const transactionData = {
          ...req.body.transaction,
          lotId: lot.id // Use the newly created lot's ID
        };
        
        const validatedTransaction = insertTransactionSchema.parse(transactionData);
        await storage.createTransaction(validatedTransaction);
      }
      
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
      
      const palletId = updatedLot.palletId;
      
      // If quantity is 0 or less, delete the lot
      if (updatedLot.quantity <= 0) {
        const lotDeleted = await storage.deleteLot(id);
        console.log(`Lot ${id} deleted: ${lotDeleted}`);
        
        // Get updated pallet with lots after deletion
        const pallet = await storage.getPallet(palletId);
        
        // Broadcast lot deletion
        broadcast({
          type: 'lotDeleted',
          data: {
            lotId: id,
            pallet
          }
        });
      } else {
        // Get updated pallet with lots
        const pallet = await storage.getPallet(palletId);
        
        // Broadcast lot update
        broadcast({
          type: 'lotUpdated',
          data: {
            lot: updatedLot,
            pallet
          }
        });
      }
      
      res.json(updatedLot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error("Error updating lot:", error);
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

  // Get transaction history (most recent first)
  app.get('/api/transactions', async (req, res) => {
    try {
      // Get all transactions, ordered by creation date descending (newest first)
      const transactions = await storage.getTransactions();
      
      // For demonstrating transaction history immediately, 
      // if no transactions are found, create a sample transaction
      if (transactions.length === 0) {
        // Check if we have any lots to reference
        const pallets = await storage.getPallets();
        if (pallets.length > 0 && pallets[0].lots.length > 0) {
          const lot = pallets[0].lots[0];
          const sampleTransaction = await storage.createTransaction({
            lotId: lot.id,
            transactionType: "add",
            quantity: lot.quantity,
            notes: `Initial lot ${lot.lotNumber} (${lot.quantity} ${lot.unit}) added to pallet ${pallets[0].palletId}`,
          });
          transactions.push(sampleTransaction);
        }
      }
      
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
