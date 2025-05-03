import type { Express } from "express";
import { Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket as WS } from "ws";
import { storage } from "./storage";
import { 
  insertPalletSchema, 
  insertLotSchema, 
  insertTransactionSchema,
  InsertPallet,
  InsertLot,
  unitSchema,
  Unit,
  User,
  InsertUser
} from "@shared/schema";
import { z } from "zod";
import { setupAuth } from "./auth";
import { authenticateToken, authorizeRoles, optionalAuthenticate } from "./middleware/auth";

// Global declaration for our client sync times Map
declare global {
  var clientSyncTimes: Map<string, number>;
}

// Using the WebSocket from 'ws' package, which is a bit different from browser's WebSocket
type ServerWebSocket = WS;

type WSMessage = {
  type: string;
  data: any;
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // User management endpoints
  // Get all users - admin only
  app.get('/api/users', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Remove password field from response
      const sanitizedUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      res.json(sanitizedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });
  
  // Get single user by ID - admin only
  app.get('/api/users/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUserById(id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Remove password field from response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });
  
  // Update user - admin only (or self update for limited fields)
  app.patch('/api/users/:id', authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userData = req.body;
      const currentUser = (req as any).user;
      
      // Only admins can update other users or change roles
      if (id !== currentUser.userId && currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions to update this user' });
      }
      
      // Only admins can change roles
      if (userData.role && currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Only administrators can change user roles' });
      }
      
      // Don't allow password updates via this endpoint
      if (userData.password) {
        delete userData.password;
      }
      
      const user = await storage.updateUser(id, userData);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Remove password field from response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });
  
  // Change password endpoint
  app.post('/api/users/:id/change-password', authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { currentPassword, newPassword } = req.body;
      const currentUser = (req as any).user;
      
      // Only allow users to change their own password, or admins to change anyone's
      if (id !== currentUser.userId && currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions to change this user\'s password' });
      }
      
      // Require current password for non-admin users changing their own password
      if (id === currentUser.userId && currentUser.role !== 'admin') {
        if (!currentPassword) {
          return res.status(400).json({ error: 'Current password is required' });
        }
        
        const user = await storage.getUserById(id);
        
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        // Verify current password (reuse the function from auth.ts)
        const { verifyPassword } = require('./auth');
        const isPasswordValid = await verifyPassword(currentPassword, user.password);
        
        if (!isPasswordValid) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }
      }
      
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }
      
      // Hash the new password
      const { hashPassword } = require('./auth');
      const hashedPassword = await hashPassword(newPassword);
      
      // Update the user's password
      const user = await storage.updateUser(id, { password: hashedPassword });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });
  
  // Delete user - admin only
  app.delete('/api/users/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUser = (req as any).user;
      
      // Prevent deleting self
      if (id === currentUser.userId) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }
      
      const success = await storage.deleteUser(id);
      
      if (!success) {
        return res.status(404).json({ error: 'User not found or could not be deleted' });
      }
      
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });
  
  // Store intervals for cleanup when server shuts down
  const intervals: NodeJS.Timeout[] = [];
  const httpServer = createServer(app);

  // Create WebSocket server with security options
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    // Additional security options
    clientTracking: true, // Track connected clients
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      // Below options specified as default values
      concurrencyLimit: 10, // Limits zlib concurrency for perf
      threshold: 1024 // Size in bytes below which messages are not compressed
    },
    maxPayload: 50 * 1024 * 1024, // 50MB max payload size
  });
  
  // Client information type
  type ClientInfo = {
    socket: ServerWebSocket;
    id: string;
    ipAddress: string;
    connectedAt: Date;
    userAgent: string;
  };
  
  // Track clients with their information
  const clients: Map<ServerWebSocket, ClientInfo> = new Map();
  
  // Generate a unique client ID
  const generateClientId = () => {
    return Math.random().toString(36).substring(2, 10);
  };
  
  // Broadcast to all clients with improved error handling and logging
  const broadcast = (message: WSMessage) => {
    console.log(`Broadcasting message type: ${message.type} to ${wss.clients.size} clients`);
    
    let successCount = 0;
    let failCount = 0;
    
    wss.clients.forEach((client) => {
      try {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify(message));
          successCount++;
        } else {
          console.log(`Client not ready (state: ${client.readyState}), skipping broadcast`);
          failCount++;
        }
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        failCount++;
      }
    });
    
    console.log(`Broadcast complete - success: ${successCount}, failed: ${failCount}`);
  };
  
  // Get connected client details for admin purposes
  const getConnectedClientDetails = () => {
    const connectedClients = Array.from(clients.values())
      .filter(info => info.socket.readyState === 1) // WebSocket.OPEN
      .map(info => ({
        id: info.id,
        ipAddress: info.ipAddress,
        connectedAt: info.connectedAt,
        userAgent: info.userAgent,
        connectedFor: Math.round((Date.now() - info.connectedAt.getTime()) / 1000) + ' seconds'
      }));
      
    return connectedClients;
  };

  // Set up periodic full data sync for all clients
  const syncInterval = setInterval(() => {
    // Track this interval for cleanup
    intervals.push(syncInterval);
    // Only proceed if there are connected clients
    if (wss.clients.size > 0) {
      console.log('Running scheduled data sync for all clients');
      
      storage.getPallets("active").then(pallets => {
        // Broadcast full data refresh to all clients
        broadcast({
          type: 'fullSync',
          data: { 
            pallets,
            connectedUsers: wss.clients.size,
            timestamp: new Date().toISOString()
          }
        });
        
        console.log(`Scheduled sync completed with ${pallets.length} pallets`);
      }).catch(err => {
        console.error('Failed to perform scheduled data sync:', err);
      });
    }
  }, 60000); // Sync every 60 seconds
  
  // WebSocket connection
  wss.on('connection', (ws, req) => {
    // Basic security check for origin
    const origin = req.headers.origin || '';
    
    // In production, you would restrict this to specific origins
    if (process.env.NODE_ENV === 'production' && 
        process.env.ALLOWED_ORIGIN && 
        origin && 
        !origin.startsWith(process.env.ALLOWED_ORIGIN)) {
      console.warn(`Rejected WebSocket connection from unauthorized origin: ${origin}`);
      ws.close(1008, 'Origin not allowed');
      return;
    }
    
    // Extract client information
    const ipAddress = req.headers['x-forwarded-for'] || 
                      req.socket.remoteAddress || 
                      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Connection rate limiting (example)
    const clientIp = typeof ipAddress === 'string' ? ipAddress : ipAddress[0];
    
    // Create a unique client ID with more entropy
    const generateSecureClientId = () => {
      const randomPart = Math.random().toString(36).substring(2, 10);
      const timestamp = Date.now().toString(36);
      return `${timestamp}${randomPart}`;
    };
    
    // Store client information with the more secure ID
    const clientInfo: ClientInfo = {
      socket: ws,
      id: generateSecureClientId(),
      ipAddress: clientIp,
      connectedAt: new Date(),
      userAgent
    };
    
    clients.set(ws, clientInfo);
    
    console.log(`Client connected: ${clientInfo.id} from ${clientInfo.ipAddress}`);
    
    // Set a ping interval to keep the connection alive and detect stale connections
    const pingInterval = setInterval(() => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.ping();
      }
    }, 30000); // 30 seconds
    
    // Track the interval for cleanup
    intervals.push(pingInterval);
    
    // Send current active pallets to new client
    storage.getPallets("active").then(pallets => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify({
          type: 'init',
          data: { 
            pallets,
            connectedUsers: wss.clients.size,
            clientId: clientInfo.id
          }
        }));
      }
    }).catch(err => {
      console.error("Failed to send initial data:", err);
    });

    // Broadcast connected users count
    broadcast({
      type: 'userCount',
      data: wss.clients.size
    });

    // Enhanced message handling with validation
    ws.on('message', (message) => {
      try {
        // Basic message size validation
        if (message.toString().length > 100000) { // 100KB limit for message size
          console.warn(`Rejected large message from client ${clientInfo.id}: ${message.toString().length} bytes`);
          return;
        }
        
        const data = JSON.parse(message.toString());
        
        // Validate message structure
        if (!data || typeof data !== 'object' || !data.type) {
          console.warn(`Invalid message format from client ${clientInfo.id}`);
          return;
        }
        
        // Handle message types with validation
        switch (data.type) {
          case 'getConnectedClients':
            // This is an admin command, in production you would add authorization checks
            ws.send(JSON.stringify({
              type: 'connectedClients',
              data: getConnectedClientDetails()
            }));
            break;
            
          case 'ping':
            // Simple ping-pong for connection testing
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
           
          case 'requestSync':
            // Use module-level variable for throttling instead of 'this'
            // which can be undefined in certain contexts
            if (!global.clientSyncTimes) {
              global.clientSyncTimes = new Map<string, number>();
            }
            
            const MIN_CLIENT_SYNC_INTERVAL = 2000; // 2 seconds minimum between syncs
            const now = Date.now();
            const lastSyncTime = global.clientSyncTimes.get(clientInfo.id) || 0;
            
            // Check if we should throttle this sync request
            if (now - lastSyncTime < MIN_CLIENT_SYNC_INTERVAL) {
              // Silent throttle - just acknowledge without full sync to reduce load
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({
                  type: 'syncAcknowledged',
                  data: { message: 'Request received, will sync soon' }
                }));
              }
              return;
            }
            
            // Update the last sync time for this client
            global.clientSyncTimes.set(clientInfo.id, now);
            
            // Client is requesting a full data sync
            console.log(`Client ${clientInfo.id} requested data sync`);
            
            // Send full data refresh to the client
            storage.getPallets("active").then(pallets => {
              if (ws.readyState === 1) { // WebSocket.OPEN
                console.log(`Sending data sync to client ${clientInfo.id} with ${pallets.length} pallets`);
                ws.send(JSON.stringify({
                  type: 'fullSync', // Changed from 'init' to 'fullSync' for consistency
                  data: { 
                    pallets,
                    connectedUsers: wss.clients.size,
                    clientId: clientInfo.id
                  }
                }));
              }
            }).catch(err => {
              console.error(`Failed to send sync data to client ${clientInfo.id}:`, err);
              // Send error notification to client
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({
                  type: 'notification',
                  data: {
                    title: 'Sync Failed',
                    description: 'Could not synchronize data from server. Please try again.'
                  }
                }));
              }
            });
            break;
            
          default:
            console.warn(`Unknown message type from client ${clientInfo.id}: ${data.type}`);
        }
      } catch (error) {
        console.error(`Error processing message from ${clientInfo.id}:`, error);
      }
    });
    
    // Enhanced error handling
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientInfo.id}:`, error);
    });
    
    // Enhanced ping/pong handling
    ws.on('pong', () => {
      // Update last active timestamp if needed
      const client = clients.get(ws);
      if (client) {
        // You could update a lastActive timestamp here if needed
      }
    });

    // Handle client disconnect with proper cleanup
    ws.on('close', (code, reason) => {
      // Clear the ping interval to prevent memory leaks
      clearInterval(pingInterval);
      
      const clientInfo = clients.get(ws);
      if (clientInfo) {
        console.log(`Client disconnected: ${clientInfo.id} Code: ${code} Reason: ${reason || 'No reason provided'}`);
        clients.delete(ws);
      } else {
        console.log(`Client disconnected Code: ${code} Reason: ${reason || 'No reason provided'}`);
      }
      
      // Update connected user count
      broadcast({
        type: 'userCount',
        data: wss.clients.size
      });
    });
  });

  // API Routes
  // Data Import Endpoint for CSV uploads - requires manager or admin role
  app.post('/api/import', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
    try {
      const { data, importType } = req.body;
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ 
          message: 'Invalid data format. Expected array of records.'
        });
      }
      
      if (!importType || !['pallets', 'lots', 'existing_inventory'].includes(importType)) {
        return res.status(400).json({ 
          message: 'Invalid import type. Expected one of: pallets, lots, existing_inventory'
        });
      }
      
      // Processing results
      const results = {
        insertedCount: 0,
        errorCount: 0,
        message: '',
        details: [] as string[]
      };
      
      // Handle import based on type
      if (importType === 'pallets') {
        // Import just pallets
        for (const row of data) {
          try {
            // Validate required fields
            if (!row.rmNumber || !row.location) {
              results.errorCount++;
              results.details.push(`Row missing required fields (rmNumber, location): ${JSON.stringify(row)}`);
              continue;
            }
            
            // Generate new pallet ID
            const palletId = await storage.generatePalletId();
            
            // Create pallet
            const palletData: InsertPallet = {
              palletId: palletId,
              rmNumber: row.rmNumber,
              location: row.location,
              status: 'active'
            };
            
            await storage.createPallet(palletData);
            results.insertedCount++;
          } catch (error) {
            results.errorCount++;
            if (error instanceof Error) {
              results.details.push(`Error processing row: ${error.message}`);
            } else {
              results.details.push(`Unknown error processing row`);
            }
          }
        }
      } else if (importType === 'lots') {
        // Import lots for existing pallets
        for (const row of data) {
          try {
            // Validate required fields
            if (!row.palletId || !row.lotNumber || !row.quantity || !row.unit || !row.expirationDate) {
              results.errorCount++;
              results.details.push(`Row missing required fields: ${JSON.stringify(row)}`);
              continue;
            }
            
            // Find the referenced pallet
            const pallet = await storage.getPalletByPalletId(row.palletId);
            if (!pallet) {
              results.errorCount++;
              results.details.push(`Pallet with ID ${row.palletId} not found`);
              continue;
            }
            
            // Validate unit
            const unitResult = unitSchema.safeParse(row.unit);
            if (!unitResult.success) {
              results.errorCount++;
              results.details.push(`Invalid unit: ${row.unit}. Must be one of: KGS, LBS`);
              continue;
            }
            
            // Create lot
            const lotData: InsertLot = {
              palletId: pallet.id,
              lotNumber: row.lotNumber,
              quantity: parseFloat(row.quantity),
              unit: unitResult.data as Unit,
              expirationDate: row.expirationDate
            };
            
            await storage.createLot(lotData);
            results.insertedCount++;
          } catch (error) {
            results.errorCount++;
            if (error instanceof Error) {
              results.details.push(`Error processing row: ${error.message}`);
            } else {
              results.details.push(`Unknown error processing row`);
            }
          }
        }
      } else if (importType === 'existing_inventory') {
        // Handle creating both pallets and lots in one go for existing inventory
        // Group rows by RM number and location to create pallets first
        const groupedByRmAndLocation: Record<string, any[]> = {};
        
        for (const row of data) {
          // Validate required fields for both pallet and lot
          if (!row.rmNumber || !row.location || !row.lotNumber || 
              !row.quantity || !row.unit || !row.expirationDate) {
            results.errorCount++;
            results.details.push(`Row missing required fields: ${JSON.stringify(row)}`);
            continue;
          }
          
          const key = `${row.rmNumber}-${row.location}`;
          if (!groupedByRmAndLocation[key]) {
            groupedByRmAndLocation[key] = [];
          }
          groupedByRmAndLocation[key].push(row);
        }
        
        // Process each group to create a pallet and its lots
        for (const [key, rows] of Object.entries(groupedByRmAndLocation)) {
          try {
            // All rows in this group have the same RM number and location
            const firstRow = rows[0];
            
            // Generate new pallet ID
            const palletId = await storage.generatePalletId();
            
            // Create pallet
            const palletData: InsertPallet = {
              palletId: palletId,
              rmNumber: firstRow.rmNumber,
              location: firstRow.location,
              status: 'active'
            };
            
            const pallet = await storage.createPallet(palletData);
            
            // Add lots to the pallet
            for (const row of rows) {
              try {
                // Validate unit
                const unitResult = unitSchema.safeParse(row.unit);
                if (!unitResult.success) {
                  results.errorCount++;
                  results.details.push(`Invalid unit for lot ${row.lotNumber}: ${row.unit}. Must be one of: KGS, LBS`);
                  continue;
                }
                
                // Create lot
                const lotData: InsertLot = {
                  palletId: pallet.id,
                  lotNumber: row.lotNumber,
                  quantity: parseFloat(row.quantity),
                  unit: unitResult.data as Unit,
                  expirationDate: row.expirationDate
                };
                
                await storage.createLot(lotData);
                results.insertedCount++;
              } catch (error) {
                results.errorCount++;
                if (error instanceof Error) {
                  results.details.push(`Error creating lot for pallet ${palletId}: ${error.message}`);
                } else {
                  results.details.push(`Unknown error creating lot for pallet ${palletId}`);
                }
              }
            }
            
            // Count the created pallet
            results.insertedCount++;
          } catch (error) {
            results.errorCount++;
            if (error instanceof Error) {
              results.details.push(`Error creating pallet group ${key}: ${error.message}`);
            } else {
              results.details.push(`Unknown error creating pallet group ${key}`);
            }
          }
        }
      }
      
      // Set result message
      if (results.errorCount === 0) {
        results.message = `Successfully imported ${results.insertedCount} records.`;
      } else if (results.insertedCount === 0) {
        results.message = `Import failed. All ${results.errorCount} records had errors.`;
      } else {
        results.message = `Imported ${results.insertedCount} records with ${results.errorCount} errors.`;
      }
      
      // After import, broadcast update to all clients
      storage.getPallets("active").then(pallets => {
        broadcast({
          type: 'fullSync',
          data: { 
            pallets,
            connectedUsers: wss.clients.size,
            timestamp: new Date().toISOString()
          }
        });
      }).catch(err => {
        console.error('Failed to broadcast after import:', err);
      });
      
      res.json(results);
    } catch (error) {
      console.error('Import error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'An unknown error occurred during import',
        errorCount: req.body?.data?.length || 0,
        insertedCount: 0
      });
    }
  });
  
  // Get connected clients info (admin endpoint)
  app.get('/api/connected-clients', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
      res.json(getConnectedClientDetails());
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch connected clients' });
    }
  });
  
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
      
      // Check if there are older lots with the same RM number for FIFO checking
      const olderLots = await storage.findOlderLotsWithSameRM(pallet.rmNumber, palletId);
      
      // Return the pallet with any older lots that should be used first (FIFO)
      res.json({
        ...pallet,
        fifoCheck: {
          hasOlderLots: olderLots.length > 0,
          olderLots
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch pallet' });
    }
  });
  
  // Get older lots with same RM number (for FIFO checking)
  app.get('/api/pallets/older-lots/:rmNumber', async (req, res) => {
    try {
      const rmNumber = req.params.rmNumber;
      const excludePalletId = req.query.excludePalletId as string | undefined;
      
      const olderLots = await storage.findOlderLotsWithSameRM(rmNumber, excludePalletId);
      
      res.json({
        hasOlderLots: olderLots.length > 0,
        olderLots
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to check for older lots' });
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

  // Create a new pallet with support for multiple lots - requires operator+ role
  // For development, use optionalAuthenticate to allow testing without authentication
  app.post('/api/pallets', process.env.NODE_ENV === 'production' ? 
    [authenticateToken, authorizeRoles('admin', 'manager', 'operator')] : 
    optionalAuthenticate, 
    async (req, res) => {
    try {
      const validatedData = insertPalletSchema.parse(req.body);
      const pallet = await storage.createPallet(validatedData);
      
      // Process initial lots - could be a single lot or an array of lots
      if (req.body.initialLot || (req.body.initialLots && Array.isArray(req.body.initialLots))) {
        // Support for both legacy single lot and new multi-lot format
        const lotsToCreate = req.body.initialLots || (req.body.initialLot ? [req.body.initialLot] : []);
        
        for (const lotData of lotsToCreate) {
          if (lotData && lotData.lotNumber && lotData.quantity) {
            const lotWithPalletId = {
              ...lotData,
              palletId: pallet.id
            };
            
            const validatedLot = insertLotSchema.parse(lotWithPalletId);
            await storage.createLot(validatedLot);
          }
        }
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
      console.error('Error creating pallet:', error);
      res.status(500).json({ message: 'Failed to create pallet', error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Update a pallet
  app.patch('/api/pallets/:id', authenticateToken, authorizeRoles('admin', 'manager', 'operator'), async (req, res) => {
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
  app.post('/api/pallets/:id/archive', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
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
  
  // Delete a pallet
  app.delete('/api/pallets/:id', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`DELETE request for pallet ID: ${id}`);
      
      // First get the pallet to store reference before deletion
      const palletToDelete = await storage.getPallet(id);
      if (!palletToDelete) {
        console.log(`Pallet with ID ${id} not found for deletion`);
        return res.status(404).json({ message: 'Pallet not found' });
      }
      
      console.log(`Attempting to delete pallet: ${palletToDelete.palletId}`);
      
      try {
        const success = await storage.deletePallet(id);
        
        if (success) {
          console.log(`Successfully deleted pallet: ${palletToDelete.palletId}`);
          // Broadcast pallet deletion
          broadcast({
            type: 'palletDeleted',
            data: { id, palletId: palletToDelete.palletId }
          });
          
          return res.json({ message: 'Pallet deleted successfully', palletId: palletToDelete.palletId });
        } else {
          console.log(`Failed to delete pallet with ID: ${id}`);
          return res.status(404).json({ message: 'Pallet not found' });
        }
      } catch (deleteError) {
        console.error(`Error in deletePallet: ${deleteError instanceof Error ? deleteError.message : 'Unknown error'}`);
        if (deleteError instanceof Error) {
          return res.status(400).json({ message: deleteError.message });
        }
        throw deleteError;
      }
    } catch (error) {
      console.error(`Unhandled error in DELETE /api/pallets/:id: ${error instanceof Error ? error.message : 'Unknown error'}`);
      res.status(500).json({ message: 'Failed to delete pallet', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Create new lots for a pallet - supports single lot or multiple lots
  app.post('/api/lots', authenticateToken, authorizeRoles('admin', 'manager', 'operator'), async (req, res) => {
    try {
      // Handle both single lot and multiple lots scenarios
      if (Array.isArray(req.body)) {
        // Multiple lots - process each one
        const createdLots = [];
        
        for (const lotData of req.body) {
          // Validate each lot
          const validatedData = insertLotSchema.parse(lotData);
          const lot = await storage.createLot(validatedData);
          createdLots.push(lot);
          
          // Create transaction if needed for this lot
          if (lotData.transaction) {
            const transactionData = {
              ...lotData.transaction,
              lotId: lot.id // Use the newly created lot's ID
            };
            
            const validatedTransaction = insertTransactionSchema.parse(transactionData);
            await storage.createTransaction(validatedTransaction);
          }
        }
        
        // Get updated pallet with lots using the pallet ID from the first lot
        if (createdLots.length > 0) {
          const pallet = await storage.getPallet(createdLots[0].palletId);
          
          // Broadcast that multiple lots were created
          broadcast({
            type: 'multipleLotCreated',
            data: {
              lots: createdLots,
              pallet
            }
          });
          
          // Also broadcast a full data sync
          storage.getPallets().then(allPallets => {
            broadcast({
              type: 'fullSync',
              data: {
                timestamp: new Date().toISOString(),
                pallets: allPallets
              }
            });
          });
          
          res.status(201).json(createdLots);
        } else {
          throw new Error("No valid lots were provided");
        }
      } else {
        // Single lot (legacy format)
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
        
        // Broadcast lot creation with specific event
        broadcast({
          type: 'lotCreated',
          data: {
            lot,
            pallet
          }
        });
        
        // Also broadcast a full data sync
        storage.getPallets().then(allPallets => {
          broadcast({
            type: 'fullSync',
            data: {
              timestamp: new Date().toISOString(),
              pallets: allPallets
            }
          });
        });
        
        res.status(201).json(lot);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating lot(s):', error);
      res.status(500).json({ message: 'Failed to create lot(s)', error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Update a lot (e.g. when picking)
  app.patch('/api/lots/:id', authenticateToken, authorizeRoles('admin', 'manager', 'operator'), async (req, res) => {
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
      
      // If quantity is 0 or less, we'll mark it as zero but not delete it
      // due to foreign key constraints with transactions
      if (updatedLot.quantity <= 0) {
        console.log(`Lot ${id} has zero quantity.`);
        
        // Get updated pallet with lots 
        const pallet = await storage.getPallet(palletId);
        
        // Broadcast lot update with zero quantity
        broadcast({
          type: 'lotUpdated',
          data: {
            lot: updatedLot,
            pallet
          }
        });
        
        // Add a toast notification about empty lot
        broadcast({
          type: 'notification',
          data: {
            title: 'Lot Empty',
            description: `Lot ${updatedLot.lotNumber} is now empty.`
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
      
      // Also broadcast a full data sync to ensure all clients have the latest data
      storage.getPallets().then(allPallets => {
        broadcast({
          type: 'fullSync',
          data: {
            timestamp: new Date().toISOString(),
            pallets: allPallets
          }
        });
      });
      
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
  app.delete('/api/lots/:id', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
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
  app.get('/api/transactions', authenticateToken, async (req, res) => {
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
  app.post('/api/transactions', authenticateToken, authorizeRoles('admin', 'manager', 'operator'), async (req, res) => {
    try {
      const validatedData = insertTransactionSchema.parse(req.body);
      const transaction = await storage.createTransaction(validatedData);
      
      // Broadcast transaction created
      broadcast({
        type: 'transactionCreated',
        data: transaction
      });
      
      // Also broadcast a full data sync to ensure all clients have the latest data
      storage.getPallets().then(allPallets => {
        broadcast({
          type: 'fullSync',
          data: {
            timestamp: new Date().toISOString(),
            pallets: allPallets
          }
        });
      });
      
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create transaction' });
    }
  });
  
  // Delete a transaction
  app.delete('/api/transactions/:id', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const deleted = await storage.deleteTransaction(id);
      
      if (deleted) {
        // Broadcast transaction deletion
        broadcast({
          type: 'transactionDeleted',
          data: { id }
        });
        
        res.status(204).send();
      } else {
        res.status(404).json({ message: 'Transaction not found' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete transaction' });
    }
  });

  // Setup cleanup for intervals and WebSocket connections
  httpServer.on('close', () => {
    console.log('HTTP server closing, cleaning up resources...');
    
    // Clear all intervals
    intervals.forEach(interval => {
      clearInterval(interval);
    });
    
    // Close all WebSocket connections
    wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.close(1000, 'Server shutting down');
      }
    });
    
    console.log('All resources cleaned up');
  });

  return httpServer;
}
