// Load .env first so route files can read process.env (Cloudinary, Firebase, etc.)
import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;

// Filled in by the async boot below. Importing firebase-admin dynamically
// means even a broken Firebase module leaves this function able to answer
// /api/health with the real error instead of Vercel's opaque crash page.
let firebaseReady = false;
let firebaseError = "Firebase module has not loaded yet";

app.disable("x-powered-by");

// ───────────────────────── CORS ─────────────────────────
// CORS runs before every route so success and error JSON both carry the
// header. Extra origins can be added in Vercel via CORS_ORIGINS
// (comma-separated). Trailing slashes are ignored on both sides.
const normalizeOrigin = (origin) => (origin || "").trim().replace(/\/+$/, "");

const allowedOrigins = new Set(
  [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://informathiveworld-furqan-khans-projects.vercel.app",
    "https://furqankhattak.vercel.app",
    "https://www.furqankhattak.vercel.app",
    ...(process.env.CORS_ORIGINS || "").split(","),
  ]
    .map(normalizeOrigin)
    .filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header (curl, server-to-server) are allowed.
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(normalizeOrigin(origin))) return callback(null, true);
      console.warn(`CORS blocked origin: ${origin}`);
      return callback(null, false);
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 204,
    maxAge: 86400,
  })
);

// Body parsers (multipart/form-data for image uploads is handled by multer in the routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ───────────────────────── HEALTH / DIAGNOSTICS ─────────────────────────
const loadedRoutes = [];
const routeFailures = [];

const envPresence = {
  FIREBASE_PROJECT_ID: Boolean(process.env.FIREBASE_PROJECT_ID),
  FIREBASE_CLIENT_EMAIL: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
  FIREBASE_PRIVATE_KEY: Boolean(process.env.FIREBASE_PRIVATE_KEY),
  JWT_SECRET: Boolean(process.env.JWT_SECRET),
  ADMIN_PASSWORD: Boolean(process.env.ADMIN_PASSWORD),
  GROQ_API_KEY: Boolean(process.env.GROQ_API_KEY),
  GROQ_MODEL: Boolean(process.env.GROQ_MODEL),
  CLOUDINARY_CLOUD_NAME: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
  CLOUDINARY_API_KEY: Boolean(process.env.CLOUDINARY_API_KEY),
  CLOUDINARY_API_SECRET: Boolean(process.env.CLOUDINARY_API_SECRET),
  CORS_ORIGINS: Boolean(process.env.CORS_ORIGINS),
};

// Public on purpose: reports only booleans and error messages, never secrets.
app.get("/api/health", async (req, res) => {
  await routesReady.catch(() => {});
  const ok = firebaseReady && routeFailures.length === 0;
  res.set("Cache-Control", "no-store");
  res.status(ok ? 200 : 503).json({
    ok,
    firebase: {
      ready: firebaseReady,
      error: firebaseError,
    },
    routes: {
      loaded: loadedRoutes,
      failed: routeFailures,
    },
    env: envPresence,
    origin: req.headers.origin || null,
    node: process.version,
    vercelEnv: process.env.VERCEL_ENV || null,
    timestamp: new Date().toISOString(),
  });
});

// ───────────────────────── ROUTES ─────────────────────────
// Loaded with dynamic imports so a single broken module (for example a
// dependency missing from the deployment) degrades to a descriptive 503
// instead of crashing the whole function including CORS preflight.
// Requests wait on this promise, so route order stays correct without
// relying on top-level await in the serverless build.
const routeModules = [
  { label: "contacts", paths: ["/api/contacts", "/api/contact"], load: () => import("./routes/contactRoute.js") },
  { label: "chat", paths: ["/api/chat"], load: () => import("./routes/chatRoute.js") },
  { label: "chatbot", paths: ["/api/chatbot"], load: () => import("./routes/chatbotRoute.js") },
  { label: "auth", paths: ["/api/auth"], load: () => import("./routes/authRoute.js") },
  { label: "admin", paths: ["/api/admin"], load: () => import("./routes/adminRoute.js") },
];

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Portfolio Backend is running");
});

const routesReady = (async () => {
  try {
    const firebase = await import("./config/firebase.config.js");
    firebaseReady = firebase.firebaseReady;
    firebaseError = firebase.getFirebaseError() || null;
  } catch (error) {
    firebaseError = `Firebase module failed to load: ${error?.message || error}`;
    routeFailures.push({ module: "firebase", error: firebaseError });
    console.error(firebaseError, error);
  }

  // Requests that need the database get an actionable message while Firebase is down.
  app.use("/api", (req, res, next) => {
    if (!firebaseReady) {
      res.set("Cache-Control", "no-store");
      return res.status(503).json({
        ok: false,
        code: "firebase_unavailable",
        error: firebaseError || "Firebase is not configured.",
      });
    }
    next();
  });

  for (const module of routeModules) {
    try {
      const { default: router } = await module.load();
      for (const path of module.paths) app.use(path, router);
      loadedRoutes.push(module.label);
    } catch (error) {
      const detail = { module: module.label, error: error?.message || String(error) };
      routeFailures.push(detail);
      console.error(`Failed to load route module "${module.label}":`, error);
    }
  }

  // If any route module failed to load, explain which one instead of a bare 404.
  app.use("/api", (req, res, next) => {
    if (routeFailures.length === 0) return next();
    res.status(503).json({
      ok: false,
      code: "api_routes_unavailable",
      error: "Some API routes failed to load.",
      failures: routeFailures,
    });
  });

  // Error handling middleware (keep this AFTER the routes)
  app.use((err, req, res, next) => {
    console.error(err.stack || err);
    res.status(err.status || 500).json({ error: err.message || "Something broke!" });
  });
})();

// Hold API requests until the async route registration has finished.
app.use("/api", (req, res, next) => {
  routesReady.then(() => next()).catch(next);
});

// For local development
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel
export default app;
