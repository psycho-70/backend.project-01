import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "../../config/firebase.config.js";
import {
    defaultExperiences,
    defaultServices,
    defaultSkills,
    defaultTeamMembers,
} from "../admin/defaults.js";
import { PORTFOLIO_PROFILE } from "./profile.js";

const norm = (v) => String(v ?? "").toLowerCase();

// Project descriptions are stored as rich-text HTML; the model should only see words.
const plain = (v) =>
    String(v ?? "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();

const truncate = (value, max) => {
    const text = String(value ?? "");
    return text.length > max ? `${text.slice(0, max)}…` : text;
};

const tokenize = (q) => norm(q).split(/\s+/).filter(Boolean);

const matchesQuery = (item, query, fields) => {
    if (!query?.trim()) return true;
    const haystack = fields.map((field) => norm(plain(item?.[field]))).join(" ");
    return tokenize(query).every((token) => haystack.includes(token));
};

const orderOf = (item, fallback) => {
    const n = Number(item?.order);
    return Number.isFinite(n) ? n : fallback;
};

const sortItems = (items) =>
    [...items].sort((a, b) => orderOf(a, Number.MAX_SAFE_INTEGER) - orderOf(b, Number.MAX_SAFE_INTEGER));

// Tools read Firestore directly — no HTTP round-trip back into this same server.
const readCollection = async (name) => {
    const snapshot = await db.collection(name).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const loadProjects = async () => sortItems(await readCollection("projects"));
const loadSkills = async () => {
    const skills = await readCollection("skills");
    return skills.length ? sortItems(skills) : defaultSkills;
};
const loadExperience = async () => {
    const experience = await readCollection("experiences");
    return experience.length ? sortItems(experience) : defaultExperiences;
};
const loadServices = async () => {
    const services = await readCollection("services");
    return services.length ? sortItems(services) : defaultServices;
};
const loadTeam = async () => {
    const team = await readCollection("team");
    return team.length ? sortItems(team) : defaultTeamMembers;
};

const safe = (handler) => async (input) => {
    try {
        return await handler(input);
    } catch (error) {
        console.error("Chatbot tool failed:", error?.message || error);
        return JSON.stringify({
            error: "The portfolio database could not be read. Ask the user to try again shortly.",
        });
    }
};

export function makePortfolioTools() {
    return [
        tool(
            safe(async ({ query }) => {
                const projects = await loadProjects();
                const filtered = projects.filter(
                    (p) =>
                        matchesQuery(p, query, ["title", "description", "longDescription", "category"]) ||
                        (query && (p.technologies || []).some((t) => norm(t).includes(norm(query))))
                );

                const list = (filtered.length ? filtered : projects).slice(0, 8).map((p) => ({
                    id: p.id,
                    title: p.title,
                    category: p.category || "",
                    technologies: (p.technologies || []).slice(0, 8),
                    description: truncate(plain(p.description), 240),
                    link: p.link || "",
                    github: p.github || "",
                }));

                return JSON.stringify({
                    totalInDatabase: projects.length,
                    count: list.length,
                    projects: list,
                    note:
                        filtered.length === 0 && query
                            ? "No exact matches; showing all projects."
                            : undefined,
                });
            }),
            {
                name: "search_projects",
                description:
                    "Search Furqan's portfolio projects stored in the database by keyword (title, technology, category, description). Returns the project list with technologies and links. Use get_project_details for a full description of one project.",
                schema: z.object({
                    query: z
                        .string()
                        .nullish()
                        .describe("Optional keyword, e.g. 'weather', 'next.js', 'AI'. Leave empty to list every project."),
                }),
            }
        ),
        tool(
            safe(async ({ project }) => {
                const projects = await loadProjects();
                if (!project) {
                    return JSON.stringify({
                        found: false,
                        message: "No project name was provided.",
                        availableTitles: projects.map((p) => p.title),
                    });
                }
                const q = norm(project);
                const tokens = tokenize(project);

                const scored = projects
                    .map((p) => {
                        const title = norm(p.title);
                        let score = 0;
                        if (title === q) score = 100;
                        else if (title.includes(q) || q.includes(title)) score = 60;
                        else {
                            const hay = `${norm(p.title)} ${norm(plain(p.description))} ${norm(
                                plain(p.longDescription)
                            )} ${norm((p.technologies || []).join(" "))}`;
                            score = tokens.reduce((sum, t) => (hay.includes(t) ? sum + 10 : sum), 0);
                        }
                        return { p, score };
                    })
                    .filter((entry) => entry.score > 0)
                    .sort((a, b) => b.score - a.score);

                if (scored.length === 0) {
                    return JSON.stringify({
                        found: false,
                        message: `No project matching "${project}" was found.`,
                        availableTitles: projects.map((p) => p.title),
                    });
                }

                const best = scored[0].p;
                return JSON.stringify({
                    found: true,
                    project: {
                        title: best.title,
                        category: best.category || "",
                        description: plain(best.description),
                        longDescription: truncate(plain(best.longDescription || best.description), 1200),
                        technologies: best.technologies || [],
                        link: best.link || "",
                        github: best.github || "",
                        images: (best.images || []).slice(0, 3),
                    },
                    otherMatches: scored.slice(1, 4).map(({ p }) => p.title),
                });
            }),
            {
                name: "get_project_details",
                description:
                    "Get the full details (long description, technologies, live/GitHub links) of one specific project by its title or a close keyword.",
                schema: z.object({
                    project: z.string().nullish().describe("Project title or a distinctive keyword, e.g. 'WeatherApp'."),
                }),
            }
        ),
        tool(
            safe(async ({ category }) => {
                const skills = await loadSkills();
                const filtered = skills.filter((s) => matchesQuery(s, category, ["category", "name"]));

                const grouped = filtered.reduce((acc, s) => {
                    const key = s.category || "General";
                    acc[key] = acc[key] || [];
                    acc[key].push(`${s.name}${Number.isFinite(Number(s.level)) ? ` (${s.level}%)` : ""}`);
                    return acc;
                }, {});

                return JSON.stringify({ total: filtered.length, categories: grouped });
            }),
            {
                name: "get_skills",
                description:
                    "List Furqan's technical skills stored in the database, grouped by category (Frontend, Backend, AI, Tools, etc.). Optionally filter by category or skill name.",
                schema: z.object({
                    category: z
                        .string()
                        .nullish()
                        .describe("Optional filter such as 'Frontend', 'AI', or 'React'."),
                }),
            }
        ),
        tool(
            safe(async ({ company }) => {
                const experience = await loadExperience();
                const list = experience
                    .filter((e) => matchesQuery(e, company, ["company", "position", "type", "technologies"]))
                    .map((e) => ({
                        company: e.company,
                        position: e.position,
                        location: e.location || "",
                        type: e.type || "",
                        duration: e.duration || "",
                        status: e.status || "",
                        technologies: e.technologies || [],
                        achievements: (e.achievements || []).slice(0, 4),
                        projects: e.projects || [],
                    }));

                return JSON.stringify({ count: list.length, experience: list });
            }),
            {
                name: "get_experience",
                description:
                    "Get Furqan's work experience from the database, including companies, roles, dates, technologies, and achievements. Optionally filter by company or role.",
                schema: z.object({
                    company: z
                        .string()
                        .nullish()
                        .describe("Optional company or role filter, e.g. 'Precise Tech'."),
                }),
            }
        ),
        tool(
            safe(async ({ query }) => {
                const services = await loadServices();
                const list = services
                    .filter((s) => matchesQuery(s, query, ["title", "category", "description"]))
                    .map((s) => ({
                        title: s.title,
                        category: s.category || "",
                        description: s.description || "",
                        features: (s.features || []).slice(0, 4),
                        deliveryTime: s.deliveryTime || "",
                        projectsCompleted: s.projects || 0,
                        rating: s.rating || null,
                    }));

                return JSON.stringify({ count: list.length, services: list });
            }),
            {
                name: "get_services",
                description:
                    "List the services Furqan offers (web development, UI/UX, backend, AI/chatbots, automation, SEO). Optionally filter by keyword.",
                schema: z.object({
                    query: z.string().nullish().describe("Optional service keyword, e.g. 'AI' or 'frontend'."),
                }),
            }
        ),
        tool(
            safe(async () => {
                const team = await loadTeam();
                return JSON.stringify({
                    count: team.length,
                    team: team.map((m) => ({
                        name: m.name,
                        position: m.position,
                        expertise: truncate(m.expertise, 300),
                        skills: m.skills || [],
                        status: m.status || "",
                        experience: m.experience || "",
                    })),
                });
            }),
            {
                name: "get_team",
                description: "List the team members Furqan collaborates with, including roles and expertise.",
                schema: z.object({}),
            }
        ),
        tool(
            safe(async () => JSON.stringify(PORTFOLIO_PROFILE)),
            {
                name: "get_contact_info",
                description:
                    "Get Furqan's contact details, location, education, awards, and current role. Use this when someone asks how to contact or hire him.",
                schema: z.object({}),
            }
        ),
    ];
}
