import express from "express";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatGroq } from "@langchain/groq";
import { db } from "../config/firebase.config.js";
import {
    CHATBOT_MODEL,
    createPortfolioAgent,
    GROQ_API_KEY,
    isChatbotConfigured,
    messageToText,
} from "./chatbot/agent.js";

const router = express.Router();

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY = 8;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 25;
const REQUEST_TIMEOUT_MS = Number(process.env.CHATBOT_TIMEOUT_MS) || 20_000;
const DEBUG = process.env.CHATBOT_DEBUG === "true";
const hits = new Map();

const withTimeout = async (promise, ms) => {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(
                    () => reject(Object.assign(new Error("Chatbot request timed out"), { code: "chatbot_timeout" })),
                    ms
                );
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
};

// Maps the underlying failure to a safe, actionable payload for the client.
const classifyError = (error) => {
    const raw = String(error?.message || error || "");
    const text = `${error?.code ?? ""} ${error?.status ?? ""} ${raw}`;

    if (error?.code === "chatbot_timeout" || /timed out|timeout/i.test(text)) {
        return { status: 504, code: "timeout", error: "The assistant took too long to answer. Please try again." };
    }
    if (/429|rate_limit|rate limit|tokens per minute|quota/i.test(text)) {
        return {
            status: 429,
            code: "rate_limit",
            error: "The assistant is handling a lot of requests right now. Please try again in a few seconds.",
        };
    }
    if (/model_not_found|does not exist or you do not have access|model .* not found/i.test(text)) {
        return {
            status: 502,
            code: "model_not_found",
            error: "The configured Groq model is not available. Check the GROQ_MODEL environment variable (no spaces or line breaks).",
        };
    }
    if (/401|403|invalid api key|invalid_api_key|unauthorized|forbidden/i.test(text)) {
        return {
            status: 502,
            code: "groq_auth",
            error: "The chatbot's model API key was rejected. Update GROQ_API_KEY in the backend environment.",
        };
    }
    if (/tool_use_failed|tool call validation|failed_generation|did not match schema|invalid tool/i.test(text)) {
        return {
            status: 502,
            code: "tool_call_invalid",
            error: "The assistant had trouble selecting portfolio data. Please rephrase, or ask about one topic at a time.",
        };
    }
    if (/firebase|firestore|permission_denied|permission denied|unavailable|credentials|service account/i.test(text)) {
        return {
            status: 502,
            code: "database",
            error: "The portfolio database is temporarily unavailable. Please try again shortly.",
        };
    }
    if (/enotfound|econnreset|econnrefused|fetch failed|network|socket/i.test(text)) {
        return {
            status: 502,
            code: "provider_unreachable",
            error: "The assistant could not reach its model provider. Please try again in a moment.",
        };
    }
    return { status: 502, code: "assistant_error", error: "The assistant is temporarily unavailable. Please try again in a moment." };
};

const sanitize = (value) =>
    String(value || "")
        .replace(/org_[A-Za-z0-9]+/g, "org_***")
        .replace(/gsk_[A-Za-z0-9]+/g, "gsk_***")
        .slice(0, 220);

const isRateLimited = (ip) => {
    const now = Date.now();
    const entries = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    entries.push(now);
    hits.set(ip, entries);
    if (hits.size > 500) {
        for (const [key, times] of hits) {
            if (!times.some((t) => now - t < RATE_LIMIT_WINDOW_MS)) hits.delete(key);
        }
    }
    return entries.length > RATE_LIMIT_MAX;
};

const normalizeHistory = (rawMessages, latest) => {
    const list = Array.isArray(rawMessages) ? rawMessages.slice(-MAX_HISTORY) : [];
    const history = [];

    for (const item of list) {
        const role = item?.role || (item?.sender === "ai" || item?.sender === "assistant" ? "assistant" : "user");
        const content = typeof item?.content === "string" ? item.content : item?.text;
        if (typeof content !== "string" || !content.trim()) continue;
        history.push(
            role === "assistant" ? new AIMessage(content.trim()) : new HumanMessage(content.trim())
        );
    }

    const last = history[history.length - 1];
    if (last instanceof HumanMessage && last.content.trim() === latest.trim()) {
        history.pop();
    }

    history.push(new HumanMessage(latest));
    return history;
};

// GET /api/chatbot - status
router.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        configured: isChatbotConfigured(),
        model: CHATBOT_MODEL(),
        message: isChatbotConfigured()
            ? "Portfolio chatbot is ready."
            : "Chatbot is not configured. Add GROQ_API_KEY to the backend .env file.",
    });
});

// POST /api/chatbot - agentic chat
router.post("/", async (req, res) => {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
    if (isRateLimited(ip)) {
        return res.status(429).json({
            success: false,
            error: "Too many messages. Please wait a minute and try again.",
        });
    }

    if (!isChatbotConfigured()) {
        return res.status(503).json({
            success: false,
            error: "Chatbot is not configured yet. Add GROQ_API_KEY to the backend .env file.",
        });
    }

    const body = req.body || {};
    const rawInput = body.currentInput ?? body.message;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const fallbackInput = [...messages].reverse().find((m) => (m?.role || m?.sender) !== "assistant")?.content
        ?? [...messages].reverse().find((m) => m?.sender === "user")?.text;

    const latest = typeof rawInput === "string" && rawInput.trim() ? rawInput.trim() : String(fallbackInput || "").trim();

    if (!latest) {
        return res.status(400).json({ success: false, error: "Please send a message." });
    }
    if (latest.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({
            success: false,
            error: `Message is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`,
        });
    }

    try {
        const agent = createPortfolioAgent();
        const result = await withTimeout(
            agent.invoke({ messages: normalizeHistory(messages, latest) }, { recursionLimit: 12 }),
            REQUEST_TIMEOUT_MS
        );

        const finalMessage = [...result.messages]
            .reverse()
            .find((m) => m?.type === "ai" && messageToText(m));
        const responseText = messageToText(finalMessage);

        if (!responseText) {
            return res.status(502).json({
                success: false,
                error: "The assistant could not produce a reply. Please try rephrasing your question.",
            });
        }

        const toolsUsed = [
            ...new Set(
                result.messages
                    .filter((m) => m?.type === "tool")
                    .map((m) => m?.name)
                    .filter(Boolean)
            ),
        ];

        res.status(200).json({
            success: true,
            response: responseText,
            model: CHATBOT_MODEL(),
            toolsUsed,
        });
    } catch (error) {
        console.error("Chatbot error:", error?.code || "", error?.message || error);
        const { status, code, error: friendly } = classifyError(error);
        res.status(status).json({
            success: false,
            code,
            error: friendly,
            ...(DEBUG ? { detail: sanitize(error?.message || error) } : {}),
        });
    }
});

// GET /api/chatbot/diagnose - checks the two things that break in production:
// Firestore access and the Groq key/model. Returns codes only, never secrets.
router.get("/diagnose", async (req, res) => {
    const started = Date.now();
    const report = {
        success: true,
        configured: isChatbotConfigured(),
        model: CHATBOT_MODEL(),
        node: process.version,
        firestore: { ok: false },
        groq: { ok: false },
    };

    try {
        const snapshot = await withTimeout(db.collection("projects").limit(1).get(), 8000);
        report.firestore = { ok: true, sampledDocuments: snapshot.size };
    } catch (error) {
        report.success = false;
        report.firestore = {
            ok: false,
            code: classifyError(error).code,
            message: sanitize(error?.message || error),
        };
    }

    if (report.configured) {
        try {
            const probe = new ChatGroq({
                apiKey: GROQ_API_KEY(),
                model: CHATBOT_MODEL(),
                temperature: 0,
                maxTokens: 5,
            });
            await withTimeout(probe.invoke([new HumanMessage("ping")]), 10000);
            report.groq = { ok: true };
        } catch (error) {
            report.success = false;
            report.groq = {
                ok: false,
                code: classifyError(error).code,
                message: sanitize(error?.message || error),
            };
        }
    } else {
        report.success = false;
        report.groq = { ok: false, code: "not_configured", message: "GROQ_API_KEY is missing." };
    }

    report.elapsedMs = Date.now() - started;
    res.status(report.success ? 200 : 503).json(report);
});

export default router;
