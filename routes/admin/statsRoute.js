import express from "express";
import { db } from "../../config/firebase.config.js";
import { verifyToken } from "../authRoute.js";
import { now } from "./_shared.js";

const router = express.Router();

router.get("/stats", verifyToken, async (req, res) => {
    try {
        const count = async (name) => (await db.collection(name).count().get()).data().count;
        const [projects, messages, skills, team, experience, services] = await Promise.all([
            count("projects"),
            count("contacts"),
            count("skills"),
            count("team"),
            count("experiences"),
            count("services"),
        ]);

        res.status(200).json({
            projects,
            messages,
            skills,
            team,
            experience,
            services,
            lastUpdated: now(),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
