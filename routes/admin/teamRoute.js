import express from "express";
import { db } from "../../config/firebase.config.js";
import { verifyToken } from "../authRoute.js";
import { defaultTeamMembers } from "./defaults.js";
import {
    docsToList,
    now,
    parseJsonOrCsv,
    seedCollection,
    teamImageUpload,
    uploadToCloudinary,
} from "./_shared.js";

const router = express.Router();

// GET /api/admin/team - Get all team members (Admin)
router.get("/team", verifyToken, async (req, res) => {
    try {
        const snapshot = await db.collection("team").get();
        if (snapshot.empty) {
            return res.status(200).json(await seedCollection("team", defaultTeamMembers));
        }
        res.status(200).json(docsToList(snapshot));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/public/team - Get all team members for visitors
router.get("/public/team", async (req, res) => {
    try {
        const snapshot = await db.collection("team").get();
        if (snapshot.empty) {
            return res.status(200).json(defaultTeamMembers);
        }
        res.status(200).json(docsToList(snapshot));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/team - Add new team member
router.post("/team", verifyToken, teamImageUpload, async (req, res) => {
    try {
        const { name, position, expertise, skills, status, projects, experience } = req.body;
        const image = req.file ? await uploadToCloudinary(req.file) : (req.body.image || "");

        const memberData = {
            name: name || "",
            position: position || "",
            expertise: expertise || "",
            skills: parseJsonOrCsv(skills),
            status: status === "Busy" ? "Busy" : "Available",
            projects: Number(projects) || 0,
            experience: experience || "1+ years",
            image,
            createdAt: now(),
        };

        const docRef = await db.collection("team").add(memberData);
        res.status(201).json({ id: docRef.id, ...memberData });
    } catch (error) {
        console.error("Create team member failed:", error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/admin/team/:id - Update team member
router.patch("/team/:id", verifyToken, teamImageUpload, async (req, res) => {
    try {
        const updates = { ...req.body };
        if (updates.skills !== undefined) updates.skills = parseJsonOrCsv(updates.skills);
        if (updates.projects !== undefined) updates.projects = Number(updates.projects) || 0;
        if (req.file) {
            updates.image = await uploadToCloudinary(req.file);
        }

        await db.collection("team").doc(req.params.id).update(updates);
        res.status(200).json({ message: "Team member updated successfully" });
    } catch (error) {
        console.error("Update team member failed:", error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/admin/team/:id - Delete team member
router.delete("/team/:id", verifyToken, async (req, res) => {
    try {
        await db.collection("team").doc(req.params.id).delete();
        res.status(200).json({ message: "Team member deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
