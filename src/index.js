import express from "express";
import cors from "cors";
import contactRoutes from "./routes/contactRoute.js";
import { config } from "dotenv";

config(); // Load .env variables

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/contacts", contactRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Portfolio Backend is running");
});

// Error handling middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://vercel.com/furqan-khans-projects/backend.project-01'
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true
}));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});