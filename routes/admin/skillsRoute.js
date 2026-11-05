import express from "express";
import { db } from "../../config/firebase.config.js";
import { verifyToken } from "../authRoute.js";
import { defaultSkills } from "./defaults.js";
import { docsToList, now, seedCollection, sortByOrder } from "./_shared.js";

const router = express.Router();

// GET /api/admin/skills — Admin list (seeds defaults if empty)
router.get("/skills", verifyToken, async (req, res) => {
    try {
        const snapshot = await db.collection("skills").get();
        if (snapshot.empty) {
            const seeded = await seedCollection("skills", defaultSkills, (s, idx) => ({
                level: Number(s.level) || 0,
                order: idx + 1,
            }));
            return res.status(200).json(seeded);
        }
        res.status(200).json(sortByOrder(docsToList(snapshot)));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/public/skills — Public, no auth
router.get("/public/skills", async (req, res) => {
    try {
        const snapshot = await db.collection("skills").get();
        if (snapshot.empty) {
            return res.status(200).json(defaultSkills.map((s, idx) => ({ ...s, order: idx + 1 })));
        }
        res.status(200).json(sortByOrder(docsToList(snapshot)));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/skills — Add a skill (auth required)
router.post("/skills", verifyToken, async (req, res) => {
    try {
        const { name, category, level, icon, order } = req.body;
        if (!name || !category) {
            return res.status(400).json({ error: "name and category are required" });
        }
        const docRef = db.collection("skills").doc();
        const data = {
            name: String(name).trim(),
            category: String(category).trim(),
            level: Math.max(0, Math.min(100, Number(level) || 0)),
            icon: icon || "⚡",
            order: Number(order) || Date.now(),
            createdAt: now(),
        };
        await docRef.set(data);
        res.status(201).json({ id: docRef.id, ...data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/admin/skills/:id — Update a skill
router.patch("/skills/:id", verifyToken, async (req, res) => {
    try {
        const updates = { ...req.body };
        if (updates.level !== undefined) {
            updates.level = Math.max(0, Math.min(100, Number(updates.level) || 0));
        }
        if (updates.order !== undefined) {
            updates.order = Number(updates.order) || 0;
        }
        if (updates.name) updates.name = String(updates.name).trim();
        if (updates.category) updates.category = String(updates.category).trim();

        const ref = db.collection("skills").doc(req.params.id);
        const snap = await ref.get();
        if (!snap.exists) {
            return res.status(404).json({ error: "Skill not found" });
        }
        await ref.update({ ...updates, updatedAt: now() });
        res.status(200).json({ message: "Skill updated successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/admin/skills/:id
router.delete("/skills/:id", verifyToken, async (req, res) => {
    try {
        const ref = db.collection("skills").doc(req.params.id);
        const snap = await ref.get();
        if (!snap.exists) {
            return res.status(404).json({ error: "Skill not found" });
        }
        await ref.delete();
        res.status(200).json({ message: "Skill deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
