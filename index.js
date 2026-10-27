import express from "express";
import cors from "cors";
import contactRoutes from "./routes/contactRoute.js";
import authRoutes from "./routes/authRoute.js";
import adminRoutes from "./routes/adminRoute.js";
import { config } from "dotenv";
import chatRoutes from "./routes/chatRoute.js";
config(); // Load .env variables

const app = express();
const PORT = process.env.PORT || 5000;

// Proper CORS configuration at the top
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://informathiveworld-furqan-khans-projects.vercel.app',
    'https://furqankhattak.vercel.app',
    'https://backendproject11-fsquxsgki-furqan-khans-projects.vercel.app', // Add your actual backend URL
    'https://backendproject-01.vercel.app' // Add this if needed

  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true
}));

// Middleware
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/contacts", contactRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Portfolio Backend is running");
});

// Error handling middleware
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).send('Something broke!');
// });

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel
export default app;