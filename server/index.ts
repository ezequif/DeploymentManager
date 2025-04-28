import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

const app = express();

// Add CORS protection
app.use(cors({
  // In production, restrict this to your actual domain
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.ALLOWED_ORIGIN || true) // Allow specific origin in production if set, otherwise dynamic
    : true, // Allow any origin in development
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Allow cookies if we add auth later
  maxAge: 86400 // Cache preflight requests for 1 day
}));

// Apply rate limiting to all requests
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window (avg ~13 requests/minute)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again after 15 minutes',
  // Skip rate limiting in development
  skip: (req) => process.env.NODE_ENV === 'development'
});

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// More aggressive limiting for authentication-related endpoints 
// (when we implement them later)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts, please try again after an hour',
  skip: (req) => process.env.NODE_ENV === 'development'
});

// These routes aren't implemented yet but will be protected when added
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);

// Add Helmet for enhanced security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Needed for Vite in development
      connectSrc: ["'self'", "ws:", "wss:"], // Allow WebSocket connections
      imgSrc: ["'self'", "data:", "blob:"], // Allow data URIs for barcode images
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
      fontSrc: ["'self'", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"], // Prevent clickjacking
      objectSrc: ["'none'"], // Prevent object-based injections
      baseUri: ["'self'"], // Restrict base tag URIs
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding in iframes (for TC70 compatibility)
  crossOriginOpenerPolicy: { policy: "same-origin" }, // Prevent cross-origin window opener access
  crossOriginResourcePolicy: { policy: "same-site" }, // Restrict cross-origin resource sharing
  referrerPolicy: { policy: "no-referrer-when-downgrade" }, // Control referrer information
  xssFilter: true, // Enable XSS protection
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  },
  noSniff: true, // Prevent MIME type sniffing
  dnsPrefetchControl: { allow: false }, // Control DNS prefetching
  permittedCrossDomainPolicies: { permittedPolicies: "none" } // Restrict Adobe Flash and PDF client usage
}));

// Configure JSON middleware with size limits
app.use(express.json({
  limit: '1mb', // Limit JSON body size to 1MB
  verify: (req: Request, res: Response, buf: Buffer) => {
    try {
      // Try to parse the JSON to ensure it's valid
      // This happens before express's built-in JSON parser
      JSON.parse(buf.toString());
    } catch (e) {
      res.status(400).json({ message: 'Invalid JSON in request body' });
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: false,
  limit: '1mb' // Limit form submission size to 1MB
}));

// Add basic parameter sanitization middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // URL Parameter validation for common patterns
  const idPattern = /^\d+$/; // Only digits for IDs
  const palletIdPattern = /^PAL\d{5}$/; // Match PAL00001 format
  
  // Check and sanitize numeric IDs in params
  Object.keys(req.params).forEach(param => {
    if (param.includes('id') && !idPattern.test(req.params[param]) && 
        // Special case for palletId which follows a different pattern
        !(param === 'palletId' && palletIdPattern.test(req.params[param]))) {
      res.status(400).json({ message: `Invalid parameter format for ${param}` });
      return; // Stop processing
    }
  });
  
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
