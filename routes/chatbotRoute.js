import express from "express";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import {
    CHATBOT_MODEL,
    createPortfolioAgent,
    isChatbotConfigured,
    messageToText,
} from "./chatbot/agent.js";

const router = express.Router();

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY = 8;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 25;
const hits = new Map();

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
        const result = await agent.invoke(
            { messages: normalizeHistory(messages, latest) },
            { recursionLimit: 12 }
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
        console.error("Chatbot error:", error?.message || error);
        const message = String(error?.message || "");
        const friendly = /401|invalid api key|unauthorized/i.test(message)
            ? "The chatbot API key is invalid. Update GROQ_API_KEY in the backend .env file."
            : /429|rate limit|tokens per minute|rate_limit_exceeded/i.test(message)
            ? "The assistant is handling a lot of requests right now. Please try again in a few seconds."
            : "The assistant is temporarily unavailable. Please try again in a moment.";

        res.status(502).json({ success: false, error: friendly });
    }
});

export default router;
