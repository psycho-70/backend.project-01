// Load .env first so route files can read process.env (Cloudinary, Firebase, etc.)
import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;

// CORS must come before the routes so every response (including errors)
// carries the Access-Control-Allow-Origin header.
// Extra origins can be added in Vercel via CORS_ORIGINS (comma-separated).
const allowedOrigins = [
  "http://localhost:3000",
  "https://informathiveworld-furqan-khans-projects.vercel.app",
  "https://furqankhattak.vercel.app",
  "https://www.furqankhattak.vercel.app",
  ...(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Body parsers (multipart/form-data for image uploads is handled by multer in the routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ───────────────────────── ROUTES ─────────────────────────
// Loaded dynamically so one failing module (missing dependency, bad runtime
// version, etc.) surfaces the real error instead of Vercel's opaque
// FUNCTION_INVOCATION_FAILED page.
const routeModules = [
  { label: "contacts", paths: ["/api/contacts", "/api/contact"], load: () => import("./routes/contactRoute.js") },
  { label: "chat", paths: ["/api/chat"], load: () => import("./routes/chatRoute.js") },
  { label: "chatbot", paths: ["/api/chatbot"], load: () => import("./routes/chatbotRoute.js") },
  { label: "auth", paths: ["/api/auth"], load: () => import("./routes/authRoute.js") },
  { label: "admin", paths: ["/api/admin"], load: () => import("./routes/adminRoute.js") },
];

let startupError = null;
const loadedRoutes = [];

const routesReady = (async () => {
  for (const route of routeModules) {
    try {
      const { default: router } = await route.load();
      for (const path of route.paths) app.use(path, router);
      loadedRoutes.push(route.label);
    } catch (error) {
      startupError = {
        module: route.label,
        code: error?.code || null,
        message: error?.message || String(error),
      };
      console.error(`Failed to load route module "${route.label}":`, error);
    }
  }

  // Error handling middleware (keep this AFTER the routes)
  app.use((err, req, res, next) => {
    console.error(err.stack || err);
    res.status(err.status || 500).json({ error: err.message || "Something broke!" });
  });
})();

// API requests wait for the async registration and, on failure, report the
// exact module and error with CORS headers intact.
app.use("/api", async (req, res, next) => {
  await routesReady.catch(() => {});
  if (startupError) {
    res.set("Cache-Control", "no-store");
    return res.status(503).json({ ok: false, startupError, loadedRoutes, node: process.version });
  }
  next();
});

// Health check endpoint
app.get("/", async (req, res) => {
  await routesReady.catch(() => {});
  if (startupError) {
    return res.status(500).json({ ok: false, startupError, loadedRoutes, node: process.version });
  }
  res.send("Portfolio Backend is running");
});

// For local development
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel
export default app;