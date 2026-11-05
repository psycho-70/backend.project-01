import express from "express";
import { db } from "../../config/firebase.config.js";
import { verifyToken } from "../authRoute.js";
import { defaultServices } from "./defaults.js";
import { docsToList, now, parseArr, seedCollection } from "./_shared.js";

const router = express.Router();

router.get("/services", async (req, res) => {
    try {
        const snapshot = await db.collection("services").get();
        if (snapshot.empty) {
            return res.status(200).json(await seedCollection("services", defaultServices));
        }
        res.status(200).json(docsToList(snapshot));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get("/public/services", async (req, res) => {
    try {
        const snapshot = await db.collection("services").get();
        if (snapshot.empty) {
            return res.status(200).json(defaultServices);
        }
        res.status(200).json(docsToList(snapshot));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post("/services", verifyToken, async (req, res) => {
    try {
        const { title, icon, category, description, features, projects, rating, deliveryTime, from, to } = req.body;

        const data = {
            title: title || "",
            icon: icon || "⚡",
            category: category || "Development",
            description: description || "",
            features: parseArr(features),
            projects: Number(projects) || 0,
            rating: Number(rating) || 5.0,
            deliveryTime: deliveryTime || "7-10 days",
            from: from || "#a855f7",
            to: to || "#ec4899",
            createdAt: now(),
        };

        const docRef = await db.collection("services").add(data);
        res.status(201).json({ id: docRef.id, ...data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch("/services/:id", verifyToken, async (req, res) => {
    try {
        const updates = { ...req.body };
        if (updates.features) updates.features = parseArr(updates.features);
        if (updates.projects !== undefined) updates.projects = Number(updates.projects) || 0;
        if (updates.rating !== undefined) updates.rating = Number(updates.rating) || 5.0;

        await db.collection("services").doc(req.params.id).update(updates);
        res.status(200).json({ message: "Service updated successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete("/services/:id", verifyToken, async (req, res) => {
    try {
        await db.collection("services").doc(req.params.id).delete();
        res.status(200).json({ message: "Service deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
