import express from "express";
import { db } from "../../config/firebase.config.js";
import { verifyToken } from "../authRoute.js";
import { defaultExperiences, ICON_NAMES } from "./defaults.js";
import { docsToList, maxOrder, now, parseArr, seedCollection, sortByOrder } from "./_shared.js";

const router = express.Router();

const withIcon = (doc, idx) => ({
    ...doc,
    icon: doc.icon || ICON_NAMES[idx % ICON_NAMES.length],
});

const seedExperiences = () =>
    seedCollection("experiences", defaultExperiences, (e, idx) => ({
        icon: ICON_NAMES[idx % ICON_NAMES.length],
        order: idx + 1,
    }));

// GET /api/admin/experience — Admin list (seeds defaults if empty)
router.get("/experience", verifyToken, async (req, res) => {
    try {
        const snapshot = await db.collection("experiences").get();
        if (snapshot.empty) {
            return res.status(200).json(await seedExperiences());
        }
        const experiences = sortByOrder(docsToList(snapshot)).map(withIcon);
        res.status(200).json(experiences);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/public/experience — Public list (no auth)
router.get("/public/experience", async (req, res) => {
    try {
        const snapshot = await db.collection("experiences").get();
        if (snapshot.empty) {
            // Seed on first public read too, so the public page and admin page agree
            return res.status(200).json(await seedExperiences());
        }
        const experiences = sortByOrder(docsToList(snapshot)).map(withIcon);
        res.status(200).json(experiences);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/experience — Add (auth required)
router.post("/experience", verifyToken, async (req, res) => {
    try {
        const {
            company, location, position, type, duration, status,
            companyType, technologies, achievements, projects, skills,
            from, to, icon,
        } = req.body;

        if (!company || !position) {
            return res.status(400).json({ error: "company and position are required" });
        }

        // Put new entries at the end
        const existing = await db.collection("experiences").get();
        const nextOrder = maxOrder(docsToList(existing)) + 1;

        const data = {
            company: String(company).trim(),
            location: location || "",
            position: String(position).trim(),
            type: type || "Remote",
            duration: duration || "",
            status: status === "current" ? "current" : "completed",
            companyType: companyType || "Tech Company",
            from: from || "#a855f7",
            to: to || "#ec4899",
            icon: icon || ICON_NAMES[nextOrder % ICON_NAMES.length],
            technologies: parseArr(technologies),
            achievements: parseArr(achievements),
            projects: parseArr(projects),
            skills: parseArr(skills),
            order: nextOrder,
            createdAt: now(),
        };

        const docRef = await db.collection("experiences").add(data);
        res.status(201).json({ id: docRef.id, ...data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/admin/experience/:id — Update (auth required)
router.patch("/experience/:id", verifyToken, async (req, res) => {
    try {
        const updates = { ...req.body };
        if (updates.technologies) updates.technologies = parseArr(updates.technologies);
        if (updates.achievements) updates.achievements = parseArr(updates.achievements);
        if (updates.projects) updates.projects = parseArr(updates.projects);
        if (updates.skills) updates.skills = parseArr(updates.skills);
        if (updates.order !== undefined) updates.order = Number(updates.order) || 0;

        const ref = db.collection("experiences").doc(req.params.id);
        const snap = await ref.get();
        if (!snap.exists) {
            return res.status(404).json({ error: "Experience not found" });
        }
        await ref.update({ ...updates, updatedAt: now() });
        res.status(200).json({ message: "Experience updated successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/admin/experience/:id — Delete (auth required)
router.delete("/experience/:id", verifyToken, async (req, res) => {
    try {
        const ref = db.collection("experiences").doc(req.params.id);
        const snap = await ref.get();
        if (!snap.exists) {
            return res.status(404).json({ error: "Experience not found" });
        }
        await ref.delete();
        res.status(200).json({ message: "Experience deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
