import express from "express";
import projectsRoutes from "./admin/projectsRoute.js";
import servicesRoutes from "./admin/servicesRoute.js";
import skillsRoutes from "./admin/skillsRoute.js";
import experienceRoutes from "./admin/experienceRoute.js";
import teamRoutes from "./admin/teamRoute.js";
import statsRoutes from "./admin/statsRoute.js";

const router = express.Router();

// Each module exports full paths relative to /api/admin, so public URLs
// (/api/admin/public/*) stay identical to the original single-route setup.
router.use(projectsRoutes);
router.use(servicesRoutes);
router.use(skillsRoutes);
router.use(experienceRoutes);
router.use(teamRoutes);
router.use(statsRoutes);

export default router;
