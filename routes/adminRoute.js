import express from "express";
import { db } from "../config/firebase.config.js";
import { verifyToken } from "./authRoute.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Multer configuration for local image storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = "uploads/";
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// GET /api/admin/projects - Get all projects (Admin)
router.get("/projects", verifyToken, async (req, res) => {
    try {
        const snapshot = await db.collection("projects").get();
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/projects - Add new project with multiple images
router.post("/projects", verifyToken, upload.array("images", 10), async (req, res) => {
    try {
        const { title, description, link, category, github, longDescription, technologies } = req.body;
        const imageFiles = req.files ? req.files.map(file => file.filename) : [];

        const projectData = {
            title,
            description,
            longDescription: longDescription || description,
            link,
            category,
            github,
            technologies: technologies ? JSON.parse(technologies) : [],
            images: imageFiles, // Array of filenames
            createdAt: new Date().toISOString()
        };

        const docRef = await db.collection("projects").add(projectData);
        res.status(201).json({ id: docRef.id, ...projectData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update project with optional multiple images
router.patch("/projects/:id", verifyToken, upload.array("images", 10), async (req, res) => {
    try {
        const updates = { ...req.body };
        if (updates.technologies) updates.technologies = JSON.parse(updates.technologies);

        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => file.filename);
            // If the user wants to REPLACE all images, we just use newImages.
            // If they want to APPEND, we'd need current data first.
            // For simplicity, we'll replace or handle according to a flag.
            updates.images = newImages;
        }

        await db.collection("projects").doc(req.params.id).update(updates);
        res.status(200).json({ message: "Project updated successfully" });
    } catch (error) {
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

// Default seed data for Skills
const defaultSkills = [
    { name: 'HTML5', category: 'Frontend', level: 95, icon: '🌐' },
    { name: 'CSS3', category: 'Frontend', level: 90, icon: '🎨' },
    { name: 'Tailwind CSS', category: 'Frontend', level: 88, icon: '💨' },
    { name: 'JavaScript', category: 'Frontend', level: 87, icon: '⚡' },
    { name: 'TypeScript', category: 'Frontend', level: 80, icon: '📘' },
    { name: 'React.js', category: 'Frontend', level: 90, icon: '⚛️' },
    { name: 'Next.js', category: 'Frontend', level: 85, icon: '🔺' },
    { name: 'Redux', category: 'Frontend', level: 78, icon: '🔄' },
    { name: 'Node.js', category: 'Full Stack & Backend', level: 82, icon: '🟢' },
    { name: 'Express.js', category: 'Full Stack & Backend', level: 80, icon: '🚂' },
    { name: 'REST APIs', category: 'Full Stack & Backend', level: 85, icon: '🔗' },
    { name: 'MongoDB', category: 'Full Stack & Backend', level: 78, icon: '🍃' },
    { name: 'PostgreSQL', category: 'Full Stack & Backend', level: 72, icon: '🐘' },
    { name: 'JWT Auth', category: 'Full Stack & Backend', level: 78, icon: '🔐' },
    { name: 'Python', category: 'Python & Flask', level: 85, icon: '🐍' },
    { name: 'Flask', category: 'Python & Flask', level: 82, icon: '🧪' },
    { name: 'SQLAlchemy', category: 'Python & Flask', level: 72, icon: '🗄️' },
    { name: 'LLM APIs', category: 'Generative AI', level: 85, icon: '🧠' },
    { name: 'AI Chatbots', category: 'Generative AI', level: 85, icon: '🤖' },
    { name: 'LangChain', category: 'Generative AI', level: 78, icon: '⛓️' },
    { name: 'RAG', category: 'Generative AI', level: 82, icon: '📚' },
    { name: 'AI Agents', category: 'AI Automation', level: 75, icon: '🕹️' },
    { name: 'Workflows', category: 'AI Automation', level: 80, icon: '🔁' },
    { name: 'Git', category: 'Tools & Design', level: 85, icon: '🌿' },
    { name: 'GitHub', category: 'Tools & Design', level: 88, icon: '🐙' },
    { name: 'UI/UX Design', category: 'Tools & Design', level: 85, icon: '🎯' },
];

// Default seed data for Experiences
const defaultExperiences = [
    {
        company: 'Precise Tech',
        location: 'Canada',
        position: 'Web Developer',
        type: 'Remote',
        duration: '08/2024 - Present',
        status: 'current',
        companyType: 'Tech Company',
        from: '#a855f7',
        to: '#ec4899',
        technologies: ['JavaScript', 'TypeScript', 'Jira', 'TFS', 'ERP Solutions'],
        achievements: [
            'Work remotely as a web developer, focusing on enterprise resource planning (ERP) solutions',
            'Contributed to specialized websites like Nature Clam and Sowa Tooling',
            'Collaborate with cross-functional teams to design and implement features',
            'Participate in code reviews and agile development processes',
        ],
        projects: ['Nature Clam', 'Sowa Tooling'],
        skills: ['Enterprise Solutions', 'Remote Collaboration', 'Agile Development'],
    },
    {
        company: 'Khushal Institute',
        location: 'Karak',
        position: 'Web Development Instructor & Computer Education Teacher',
        type: 'On-site',
        duration: '01/2024 - 06/2024',
        status: 'completed',
        companyType: 'Educational Institute',
        from: '#8b5cf6',
        to: '#6366f1',
        technologies: ['HTML', 'CSS', 'JavaScript', 'Web Frameworks', 'Office Automation'],
        achievements: [
            'Instructed and mentored students in web development fundamentals',
            'Taught courses on office automation, networking, and basic computer skills',
            'Developed and updated educational materials including course outlines and textbooks',
            'Created dynamic and effective learning experiences for students',
        ],
        projects: ['Course Development', 'Educational Materials', 'Student Mentoring'],
        skills: ['Teaching', 'Curriculum Development', 'Student Mentoring'],
    },
    {
        company: 'Uzair Technology',
        location: 'Kohat',
        position: 'Intern (React.js and Web Development)',
        type: 'Internship',
        duration: '06/2023 - 12/2023',
        status: 'completed',
        companyType: 'Technology Company',
        from: '#d946ef',
        to: '#f43f5e',
        technologies: ['React.js', 'JavaScript', 'HTML', 'CSS', 'Tailwind CSS'],
        achievements: [
            'Completed comprehensive internship focused on React.js and modern web development',
            'Built several web applications including Weather App, Profile App, and To-Do List App',
            'Gained hands-on experience in responsive and interactive UI development',
            'Worked extensively with React and Tailwind CSS for modern web solutions',
        ],
        projects: ['Weather App', 'Profile App', 'To-Do List App', 'FCP App'],
        skills: ['React Development', 'Responsive Design', 'Interactive UIs'],
    },
];

// Default seed data for Services
const defaultServices = [
    {
        title: 'UI/UX Design',
        icon: '🎨',
        category: 'Design',
        description:
            'Creating intuitive and visually stunning user interfaces that provide exceptional user experiences. From wireframes to final designs, I craft digital experiences that captivate and engage.',
        features: [
            'User Research & Analysis',
            'Wireframing & Prototyping',
            'Visual Design Systems',
            'Responsive Design',
            'Usability Testing',
            'Brand Integration',
        ],
        projects: 45,
        rating: 4.9,
        deliveryTime: '5-7 days',
        from: '#ec4899',
        to: '#f43f5e',
    },
    {
        title: 'Frontend Development',
        icon: '💻',
        category: 'Development',
        description:
            'Building responsive, interactive, and high-performance web applications using modern technologies. I turn designs into pixel-perfect, functional interfaces.',
        features: [
            'React & Next.js Development',
            'Responsive Web Design',
            'JavaScript & TypeScript',
            'State Management',
            'API Integration',
            'Performance Optimization',
        ],
        projects: 62,
        rating: 4.8,
        deliveryTime: '7-10 days',
        from: '#3b82f6',
        to: '#06b6d4',
    },
    {
        title: 'Backend Development',
        icon: '⚙️',
        category: 'Development',
        description:
            'Developing robust server-side applications, APIs, and database systems with Node.js and Python Flask, built with security, scalability, and performance in mind.',
        features: [
            'RESTful API Development',
            'Node.js & Flask Back Ends',
            'Authentication & Security',
            'Cloud Integration',
            'Performance Optimization',
            'Microservices Architecture',
        ],
        projects: 38,
        rating: 4.9,
        deliveryTime: '10-14 days',
        from: '#10b981',
        to: '#14b8a6',
    },
    {
        title: 'Generative AI & Chatbots',
        icon: '✨',
        category: 'AI',
        description:
            'Adding real intelligence to your product: LLM-powered chatbots, RAG systems that answer from your own documents, and smart features that make apps feel effortless.',
        features: [
            'RAG Chatbots on Your Data',
            'LLM API Integration',
            'Prompt Engineering',
            'Vector Database Setup',
            'AI Feature Prototyping',
            'Evaluation & Tuning',
        ],
        projects: 18,
        rating: 4.9,
        deliveryTime: '10-14 days',
        from: '#a855f7',
        to: '#ec4899',
    },
    {
        title: 'AI Automation',
        icon: '🤖',
        category: 'AI',
        description:
            'Removing repetitive work with automated workflows and AI agents that connect your tools, process data, and run in the background so your team can focus on what matters.',
        features: [
            'Workflow Automation',
            'AI Agents & Assistants',
            'Webhook & API Pipelines',
            'Document Processing',
            'Email & CRM Automation',
            'Monitoring & Alerts',
        ],
        projects: 15,
        rating: 4.8,
        deliveryTime: '7-12 days',
        from: '#6366f1',
        to: '#8b5cf6',
    },
    {
        title: 'SEO Optimization',
        icon: '🚀',
        category: 'Marketing',
        description:
            'Boosting your online visibility and search rankings through comprehensive SEO strategies, technical optimizations, and content enhancement.',
        features: [
            'Technical SEO Audit',
            'Keyword Research & Strategy',
            'On-page Optimization',
            'Content Strategy',
            'Link Building',
            'Performance Tracking',
        ],
        projects: 29,
        rating: 4.7,
        deliveryTime: '14-21 days',
        from: '#f59e0b',
        to: '#f97316',
    },
];

// --- Experience Management ---

router.get("/experience", async (req, res) => {
    try {
        const snapshot = await db.collection("experiences").get();
        if (snapshot.empty) {
            const batch = db.batch();
            const seeded = defaultExperiences.map((e, idx) => {
                const docRef = db.collection("experiences").doc();
                const data = { ...e, order: idx + 1, createdAt: new Date().toISOString() };
                batch.set(docRef, data);
                return { id: docRef.id, ...data };
            });
            await batch.commit();
            return res.status(200).json(seeded);
        }
        const experiences = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(experiences);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post("/experience", verifyToken, async (req, res) => {
    try {
        const { company, location, position, type, duration, status, companyType, technologies, achievements, projects, skills, from, to } = req.body;
        const parseArr = (v) => Array.isArray(v) ? v : (typeof v === "string" ? v.split(",").map(s => s.trim()).filter(Boolean) : []);

        const data = {
            company: company || "",
            location: location || "",
            position: position || "",
            type: type || "Remote",
            duration: duration || "",
            status: status || "completed",
            companyType: companyType || "Tech Company",
            from: from || "#a855f7",
            to: to || "#ec4899",
            technologies: parseArr(technologies),
            achievements: parseArr(achievements),
            projects: parseArr(projects),
            skills: parseArr(skills),
            createdAt: new Date().toISOString()
        };

        const docRef = await db.collection("experiences").add(data);
        res.status(201).json({ id: docRef.id, ...data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch("/experience/:id", verifyToken, async (req, res) => {
    try {
        const parseArr = (v) => Array.isArray(v) ? v : (typeof v === "string" ? v.split(",").map(s => s.trim()).filter(Boolean) : []);
        const updates = { ...req.body };
        if (updates.technologies) updates.technologies = parseArr(updates.technologies);
        if (updates.achievements) updates.achievements = parseArr(updates.achievements);
        if (updates.projects) updates.projects = parseArr(updates.projects);
        if (updates.skills) updates.skills = parseArr(updates.skills);

        await db.collection("experiences").doc(req.params.id).update(updates);
        res.status(200).json({ message: "Experience updated successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete("/experience/:id", verifyToken, async (req, res) => {
    try {
        await db.collection("experiences").doc(req.params.id).delete();
        res.status(200).json({ message: "Experience deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get("/public/experience", async (req, res) => {
    try {
        const snapshot = await db.collection("experiences").get();
        if (snapshot.empty) {
            return res.status(200).json(defaultExperiences);
        }
        const experiences = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(experiences);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Services Management ---

router.get("/services", async (req, res) => {
    try {
        const snapshot = await db.collection("services").get();
        if (snapshot.empty) {
            const batch = db.batch();
            const seeded = defaultServices.map((s) => {
                const docRef = db.collection("services").doc();
                const data = { ...s, createdAt: new Date().toISOString() };
                batch.set(docRef, data);
                return { id: docRef.id, ...data };
            });
            await batch.commit();
            return res.status(200).json(seeded);
        }
        const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post("/services", verifyToken, async (req, res) => {
    try {
        const { title, icon, category, description, features, projects, rating, deliveryTime, from, to } = req.body;
        const parseArr = (v) => Array.isArray(v) ? v : (typeof v === "string" ? v.split(",").map(s => s.trim()).filter(Boolean) : []);

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
            createdAt: new Date().toISOString()
        };

        const docRef = await db.collection("services").add(data);
        res.status(201).json({ id: docRef.id, ...data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch("/services/:id", verifyToken, async (req, res) => {
    try {
        const parseArr = (v) => Array.isArray(v) ? v : (typeof v === "string" ? v.split(",").map(s => s.trim()).filter(Boolean) : []);
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

router.get("/public/services", async (req, res) => {
    try {
        const snapshot = await db.collection("services").get();
        if (snapshot.empty) {
            return res.status(200).json(defaultServices);
        }
        const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// (Skills handled above)
// ───────────────────────── SKILLS ─────────────────────────

router.get("/skills", verifyToken, async (req, res) => {
    try {
        const snapshot = await db.collection("skills").orderBy("order", "asc").get();
        if (snapshot.empty) {
            const batch = db.batch();
            const seeded = defaultSkills.map((s, idx) => {
                const docRef = db.collection("skills").doc();
                const data = {
                    ...s,
                    level: Number(s.level) || 0,
                    order: idx + 1,
                    createdAt: new Date().toISOString(),
                };
                batch.set(docRef, data);
                return { id: docRef.id, ...data };
            });
            await batch.commit();
            return res.status(200).json(seeded);
        }
        const skills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(skills);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/public/skills — Public, no auth
router.get("/public/skills", async (req, res) => {
    try {
        const snapshot = await db.collection("skills").orderBy("order", "asc").get();
        if (snapshot.empty) {
            return res.status(200).json(
                defaultSkills.map((s, idx) => ({ ...s, order: idx + 1 }))
            );
        }
        const skills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(skills);
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
            createdAt: new Date().toISOString(),
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
        await ref.update({ ...updates, updatedAt: new Date().toISOString() });
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
router.post("/skills", async (req, res) => {
    try {
        const docRef = await db.collection("skills").add(req.body);
        res.status(201).json({ id: docRef.id, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete("/skills/:id", verifyToken, async (req, res) => {
    try {
        await db.collection("skills").doc(req.params.id).delete();
        res.status(200).json({ message: "Skill deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Dashboard Statistics ---
router.get("/stats", verifyToken, async (req, res) => {
    try {
        const projectsCount = (await db.collection("projects").count().get()).data().count;
        const messagesCount = (await db.collection("contacts").count().get()).data().count;
        const skillsCount = (await db.collection("skills").count().get()).data().count;
        const teamCount = (await db.collection("team").count().get()).data().count;
        const experienceCount = (await db.collection("experiences").count().get()).data().count;
        const servicesCount = (await db.collection("services").count().get()).data().count;

        res.status(200).json({
            projects: projectsCount,
            messages: messagesCount,
            skills: skillsCount,
            team: teamCount,
            experience: experienceCount,
            services: servicesCount,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Public Routes (No verification needed) ---

// GET /api/admin/public/projects - Get all projects for visitors
// We put this in adminRoute but prefixed it to distinguish
router.get("/public/projects", async (req, res) => {
    try {
        const snapshot = await db.collection("projects").get();
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Default initial team members
const defaultTeamMembers = [
    {
        name: 'M.Asim',
        position: 'Visual Designer',
        image: '/team/asim.jpg',
        expertise: 'Expert in Adobe Photoshop, Illustrator, and UI/UX design principles.',
        skills: ['Photoshop', 'Illustrator', 'UI/UX', 'Design Systems'],
        status: 'Available',
        projects: 12,
        experience: '3+ years',
    },
    {
        name: 'Hussain Khan',
        position: 'Software Engineer',
        image: '/team/hussain.enc',
        expertise: 'Proficient in JavaScript, React, Node.js, and cloud computing.',
        skills: ['JavaScript', 'React', 'Node.js', 'Cloud Computing'],
        status: 'Busy',
        projects: 18,
        experience: '5+ years',
    },
    {
        name: 'Nasir Khan',
        position: 'Project Manager',
        image: '/team/nasir.enc',
        expertise: 'Skilled in project management, Agile methodologies, and team leadership.',
        skills: ['Project Management', 'Agile', 'Leadership', 'Strategy'],
        status: 'Available',
        projects: 25,
        experience: '7+ years',
    },
    {
        name: 'Salman Khan',
        position: 'Database Administrator',
        image: '/team/salman.jpg',
        expertise: 'Experienced in SQL, NoSQL databases, and database performance optimization.',
        skills: ['SQL', 'NoSQL', 'Performance', 'Security'],
        status: 'Available',
        projects: 15,
        experience: '4+ years',
    },
    {
        name: 'Aftab Khan',
        position: 'UX Designer',
        image: '/team/aftab.jpg',
        expertise: 'Specialized in user research, wireframing, prototyping, and usability testing.',
        skills: ['User Research', 'Wireframing', 'Prototyping', 'Testing'],
        status: 'Busy',
        projects: 14,
        experience: '4+ years',
    },
];

// --- Team Management ---

// GET /api/admin/team - Get all team members (Admin)
router.get("/team", verifyToken, async (req, res) => {
    try {
        const snapshot = await db.collection("team").get();
        if (snapshot.empty) {
            const batch = db.batch();
            const seeded = defaultTeamMembers.map((m) => {
                const docRef = db.collection("team").doc();
                const data = { ...m, createdAt: new Date().toISOString() };
                batch.set(docRef, data);
                return { id: docRef.id, ...data };
            });
            await batch.commit();
            return res.status(200).json(seeded);
        }
        const team = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(team);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/team - Add new team member
router.post("/team", verifyToken, upload.single("image"), async (req, res) => {
    try {
        const { name, position, expertise, skills, status, projects, experience } = req.body;
        const imageFile = req.file ? req.file.filename : (req.body.image || "");

        let parsedSkills = [];
        if (skills) {
            try {
                parsedSkills = typeof skills === "string" ? JSON.parse(skills) : skills;
            } catch {
                parsedSkills = String(skills).split(",").map(s => s.trim()).filter(Boolean);
            }
        }

        const memberData = {
            name: name || "",
            position: position || "",
            expertise: expertise || "",
            skills: parsedSkills,
            status: status === "Busy" ? "Busy" : "Available",
            projects: Number(projects) || 0,
            experience: experience || "1+ years",
            image: imageFile,
            createdAt: new Date().toISOString()
        };

        const docRef = await db.collection("team").add(memberData);
        res.status(201).json({ id: docRef.id, ...memberData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/admin/team/:id - Update team member
router.patch("/team/:id", verifyToken, upload.single("image"), async (req, res) => {
    try {
        const updates = { ...req.body };
        if (updates.skills) {
            try {
                updates.skills = typeof updates.skills === "string" ? JSON.parse(updates.skills) : updates.skills;
            } catch {
                updates.skills = String(updates.skills).split(",").map(s => s.trim()).filter(Boolean);
            }
        }
        if (updates.projects !== undefined) {
            updates.projects = Number(updates.projects) || 0;
        }
        if (req.file) {
            updates.image = req.file.filename;
        }

        await db.collection("team").doc(req.params.id).update(updates);
        res.status(200).json({ message: "Team member updated successfully" });
    } catch (error) {
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

// GET /api/admin/public/team - Get all team members for visitors
router.get("/public/team", async (req, res) => {
    try {
        const snapshot = await db.collection("team").get();
        if (snapshot.empty) {
            return res.status(200).json(defaultTeamMembers);
        }
        const team = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(team);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ───────────────────────── EXPERIENCE ─────────────────────────

// helper: map DB doc → API shape with a stable `icon` name
const ICON_NAMES = ['Code', 'GraduationCap', 'Briefcase', 'Building2', 'Rocket'];
const withIcon = (doc, idx) => ({
  ...doc,
  icon: doc.icon || ICON_NAMES[idx % ICON_NAMES.length],
});

// GET /api/admin/experience — Admin list (seeds defaults if empty)
router.get("/experience", verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection("experiences").orderBy("order", "asc").get();
    if (snapshot.empty) {
      const batch = db.batch();
      const seeded = defaultExperiences.map((e, idx) => {
        const docRef = db.collection("experiences").doc();
        const data = {
          ...e,
          icon: ICON_NAMES[idx % ICON_NAMES.length],
          order: idx + 1,
          createdAt: new Date().toISOString(),
        };
        batch.set(docRef, data);
        return { id: docRef.id, ...data };
      });
      await batch.commit();
      return res.status(200).json(seeded);
    }
    const experiences = snapshot.docs.map((doc, idx) =>
      withIcon({ id: doc.id, ...doc.data() }, idx)
    );
    res.status(200).json(experiences);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/public/experience — Public list (no auth)
router.get("/public/experience", async (req, res) => {
  try {
    const snapshot = await db.collection("experiences").orderBy("order", "asc").get();
    if (snapshot.empty) {
      // Seed on first public read too, so the public page and admin page agree
      const batch = db.batch();
      const seeded = defaultExperiences.map((e, idx) => {
        const docRef = db.collection("experiences").doc();
        const data = {
          ...e,
          icon: ICON_NAMES[idx % ICON_NAMES.length],
          order: idx + 1,
          createdAt: new Date().toISOString(),
        };
        batch.set(docRef, data);
        return { id: docRef.id, ...data };
      });
      await batch.commit();
      return res.status(200).json(seeded);
    }
    const experiences = snapshot.docs.map((doc, idx) =>
      withIcon({ id: doc.id, ...doc.data() }, idx)
    );
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

    const parseArr = (v) =>
      Array.isArray(v)
        ? v
        : typeof v === "string"
        ? v.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    // Put new entries at the end
    const last = await db.collection("experiences").orderBy("order", "desc").limit(1).get();
    const nextOrder = last.empty ? 1 : (Number(last.docs[0].data().order) || 0) + 1;

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
      createdAt: new Date().toISOString(),
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
    const parseArr = (v) =>
      Array.isArray(v)
        ? v
        : typeof v === "string"
        ? v.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

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
    await ref.update({ ...updates, updatedAt: new Date().toISOString() });
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
