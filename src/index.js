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
    'https://informativeworld-furqan-khans-projects.vercel.app/',
    'https://backend-project-01-two.vercel.app/'
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true
}));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});