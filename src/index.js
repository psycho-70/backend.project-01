import express from "express";
import cors from "cors";
import contactRoutes from "./routes/contactRoute.js";
import { config } from "dotenv";

config(); // Load .env variables

const app = express();
const PORT = process.env.PORT || 5000;

// Proper CORS configuration at the top
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://informativeworld-furqan-khans-projects.vercel.app' // Remove trailing slash
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true
}));

// Middleware
app.use(express.json());

// Routes
app.use("/api/contacts", contactRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Portfolio Backend is running");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel
export default app;