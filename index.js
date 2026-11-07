// Load .env first so route files can read process.env (Cloudinary, Firebase, etc.)
import "dotenv/config";
import express from "express";
import cors from "cors";
import contactRoutes from "./routes/contactRoute.js";
import authRoutes from "./routes/authRoute.js";
import adminRoutes from "./routes/adminRoute.js";
import chatRoutes from "./routes/chatRoute.js";
import chatbotRoutes from "./routes/chatbotRoute.js";

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

// Routes
app.use("/api/contacts", contactRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Portfolio Backend is running");
});

// Error handling middleware (keep this AFTER the routes)
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  res.status(err.status || 500).json({ error: err.message || "Something broke!" });
});

// For local development
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel
export default app;