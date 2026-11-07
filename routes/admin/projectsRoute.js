import express from "express";
import { db } from "../../config/firebase.config.js";
import { verifyToken } from "../authRoute.js";
import {
    docsToList,
    getProjectImageFiles,
    now,
    parseTechnologies,
    projectImageUpload,
    richTextToPlain,
    sanitizeRichText,
    sanitizeRichTextIfHtml,
    uploadImages,
} from "./_shared.js";

const router = express.Router();

// Public responses re-sanitize rich text so records saved before the editor
// existed can never return unsafe markup.
const toPublicProject = (doc) => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        description: sanitizeRichTextIfHtml(data.description),
        longDescription: sanitizeRichTextIfHtml(data.longDescription),
    };
};

// GET /api/admin/projects - Get all projects (Admin)
router.get("/projects", verifyToken, async (req, res) => {
    try {
        const snapshot = await db.collection("projects").get();
        res.status(200).json(docsToList(snapshot));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/public/projects - Get all projects for visitors
router.get("/public/projects", async (req, res) => {
    try {
        const snapshot = await db.collection("projects").get();
        res.status(200).json(snapshot.docs.map(toPublicProject));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/public/projects/:id - Get a single project for visitors
router.get("/public/projects/:id", async (req, res) => {
    try {
        const snap = await db.collection("projects").doc(req.params.id).get();
        if (!snap.exists) {
            return res.status(404).json({ error: "Project not found" });
        }
        res.status(200).json(toPublicProject(snap));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/projects - Add new project with multiple images
router.post("/projects", verifyToken, projectImageUpload, async (req, res) => {
    try {
        const { title, link, category, github, technologies } = req.body;
        const description = sanitizeRichText(req.body.description);
        const longDescription = sanitizeRichText(req.body.longDescription) || description;

        if (!title || !richTextToPlain(description)) {
            return res.status(400).json({ error: "title and description are required" });
        }

        const images = await uploadImages(getProjectImageFiles(req));

        const projectData = {
            title,
            description,
            longDescription,
            link: link || "",
            category: category || "",
            github: github || "",
            technologies: parseTechnologies(technologies),
            images,
            createdAt: now(),
        };

        const docRef = await db.collection("projects").add(projectData);
        res.status(201).json({ id: docRef.id, ...projectData });
    } catch (error) {
        console.error("Create project failed:", error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/admin/projects/:id - Update project (uploading new images replaces the old ones)
router.patch("/projects/:id", verifyToken, projectImageUpload, async (req, res) => {
    try {
        const updates = { ...req.body };
        if (updates.technologies !== undefined) {
            updates.technologies = parseTechnologies(updates.technologies);
        }
        if (updates.description !== undefined) {
            updates.description = sanitizeRichText(updates.description);
        }
        if (updates.longDescription !== undefined) {
            updates.longDescription = sanitizeRichText(updates.longDescription);
        }

        const uploadedImages = getProjectImageFiles(req);
        if (uploadedImages.length > 0) {
            updates.images = await uploadImages(uploadedImages);
        }

        const ref = db.collection("projects").doc(req.params.id);
        const snap = await ref.get();
        if (!snap.exists) {
            return res.status(404).json({ error: "Project not found" });
        }

        await ref.update({ ...updates, updatedAt: now() });
        res.status(200).json({ message: "Project updated successfully" });
    } catch (error) {
        console.error("Update project failed:", error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/admin/projects/:id - Delete project
router.delete("/projects/:id", verifyToken, async (req, res) => {
    try {
        await db.collection("projects").doc(req.params.id).delete();
        res.status(200).json({ message: "Project deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
