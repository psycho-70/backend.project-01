import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "../config/firebase.config.js";

const router = express.Router();

// Temporary: Setup a default admin if none exists
const setupAdmin = async () => {
    const adminRef = db.collection("admins").doc("main_admin");
    const doc = await adminRef.get();

    if (!doc.exists) {
        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || "12345678", 10);
        await adminRef.set({
            username: process.env.ADMIN_USERNAME || "adminfrk@gmail.com",
            password: hashedPassword,
            role: "super_admin",
            createdAt: new Date().toISOString()
        });
        console.log("Default admin created");
    }
};

setupAdmin();

// POST /api/auth/login
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        const adminRef = db.collection("admins").where("username", "==", username).limit(1);
        const snapshot = await adminRef.get();

        if (snapshot.empty) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const adminData = snapshot.docs[0].data();
        const isPasswordValid = await bcrypt.compare(password, adminData.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: snapshot.docs[0].id, username: adminData.username, role: adminData.role },
            process.env.JWT_SECRET || "your_jwt_secret",
            { expiresIn: "24h" }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            admin: {
                username: adminData.username,
                role: adminData.role
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Server error", details: error.message });
    }
});

// Middleware to verify token
export const verifyToken = (req, res, next) => {
    const token = req.headers["authorization"]?.split(" ")[1];

    if (!token) {
        return res.status(403).json({ error: "No token provided" });
    }

    jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret", (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        req.adminId = decoded.id;
        req.adminRole = decoded.role;
        next();
    });
};

export default router;
