
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

// Configure according to your hosting provider's execution limit.
const REQUEST_TIMEOUT_MS =
    Number(process.env.CHATBOT_TIMEOUT_MS) || 20_000;

const DEBUG = process.env.CHATBOT_DEBUG === "true";
const hits = new Map();

/* ---------------- TIMEOUT HANDLER ---------------- */

const withTimeout = async (promise, ms) => {
    let timer;

    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    reject(
                        Object.assign(
                            new Error("Chatbot request timed out"),
                            { code: "chatbot_timeout" }
                        )
                    );
                }, ms);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
};

/* ---------------- ERROR INFORMATION ---------------- */

const getErrorInfo = (error) => {
    const response = error?.response;
    const nested =
        error?.cause ||
        error?.error ||
        response?.data?.error ||
        response?.data;

    return {
        message: String(
            error?.message ||
            nested?.message ||
            nested?.error?.message ||
            nested ||
            error ||
            "Unknown error"
        ),
        code: error?.code || nested?.code || "",
        status: Number(
            error?.status ??
            error?.statusCode ??
            response?.status ??
            nested?.status ??
            0
        ) || undefined,
        type: error?.type || nested?.type || "",
    };
};

/* ---------------- ERROR CLASSIFICATION ---------------- */

const classifyError = (error) => {
    const info = getErrorInfo(error);

    const text = `${info.code} ${info.status || ""} ${info.type} ${info.message}`
        .toLowerCase();

    if (
        error?.code === "chatbot_timeout" ||
        /timed out|timeout|deadline exceeded/.test(text)
    ) {
        return {
            status: 504,
            code: "timeout",
            error: "The assistant took too long to answer. Please try again.",
        };
    }

    if (/429|rate_limit|rate limit|tokens per minute|quota/.test(text)) {
        return {
            status: 429,
            code: "rate_limit",
            error: "AI rate limit reached. Please try again shortly.",
        };
    }

    if (
        /model_not_found|model.*(not found|unavailable)|does not exist or you do not have access/.test(text)
    ) {
        return {
            status: 502,
            code: "model_not_found",
            error: "The configured Groq model is unavailable. Check GROQ_MODEL.",
        };
    }

    if (
        /401|403|invalid api key|invalid_api_key|unauthorized|forbidden/.test(text)
    ) {
        return {
            status: 502,
            code: "groq_auth",
            error: "Groq rejected the API credentials. Check GROQ_API_KEY in production.",
        };
    }

    if (
        /tool_use_failed|tool call validation|failed_generation|did not match schema|invalid tool/.test(text)
    ) {
        return {
            status: 502,
            code: "tool_call_invalid",
            error: "The assistant could not complete a tool call. Please rephrase your question.",
        };
    }

    if (
        /firebase|firestore|permission_denied|permission denied|service account|credential/.test(text)
    ) {
        return {
            status: 502,
            code: "database",
            error: "The portfolio database could not be reached. Check Firebase credentials and permissions.",
        };
    }

    if (
        /enotfound|econnreset|econnrefused|fetch failed|network|socket|dns/.test(text)
    ) {
        return {
            status: 502,
            code: "provider_unreachable",
            error: "The backend could not reach the AI provider. Check outbound network access.",
        };
    }

    if ([500, 502, 503, 504].includes(info.status)) {
        return {
            status: 502,
            code: "provider_error",
            error: "The AI provider or an upstream service returned an error.",
        };
    }

    return {
        status: 502,
        code: "assistant_error",
        error: "The assistant is temporarily unavailable. Please try again.",
    };
};

/* ---------------- SANITIZE LOGS ---------------- */

const sanitize = (value) =>
    String(value || "")
        .replace(/org_[A-Za-z0-9]+/g, "org_***")
        .replace(/gsk_[A-Za-z0-9]+/g, "gsk_***")
        .slice(0, 220);

/* ---------------- RATE LIMITING ---------------- */

const isRateLimited = (ip) => {
    const now = Date.now();

    const entries = (hits.get(ip) || []).filter(
        (time) => now - time < RATE_LIMIT_WINDOW_MS
    );

    entries.push(now);
    hits.set(ip, entries);

    if (hits.size > 500) {
        for (const [key, times] of hits) {
            if (!times.some((time) => now - time < RATE_LIMIT_WINDOW_MS)) {
                hits.delete(key);
            }
        }
    }

    return entries.length > RATE_LIMIT_MAX;
};

/* ---------------- CHAT HISTORY ---------------- */

const normalizeHistory = (rawMessages, latest) => {
    const list = Array.isArray(rawMessages)
        ? rawMessages.slice(-MAX_HISTORY)
        : [];

    const history = [];

    for (const item of list) {
        const role =
            item?.role ||
            (item?.sender === "ai" || item?.sender === "assistant"
                ? "assistant"
                : "user");

        const content =
            typeof item?.content === "string"
                ? item.content
                : item?.text;

        if (typeof content !== "string" || !content.trim()) {
            continue;
        }

        history.push(
            role === "assistant"
                ? new AIMessage(content.trim())
                : new HumanMessage(content.trim())
        );
    }

    const last = history[history.length - 1];

    if (
        last instanceof HumanMessage &&
        last.content.trim() === latest.trim()
    ) {
        history.pop();
    }

    history.push(new HumanMessage(latest));

    return history;
};

/* ---------------- CHATBOT STATUS ---------------- */

router.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        configured: isChatbotConfigured(),
        model: CHATBOT_MODEL(),
        message: isChatbotConfigured()
            ? "Portfolio chatbot is ready."
            : "Chatbot is not configured. Add GROQ_API_KEY.",
    });
});

/* ---------------- CHATBOT API ---------------- */

router.post("/", async (req, res) => {
    const ip =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.ip ||
        "unknown";

    if (isRateLimited(ip)) {
        return res.status(429).json({
            success: false,
            error: "Too many messages. Please wait a minute.",
        });
    }

    if (!isChatbotConfigured()) {
        return res.status(503).json({
            success: false,
            error: "Chatbot is not configured. Check GROQ_API_KEY.",
        });
    }

    const body = req.body || {};

    const rawInput = body.currentInput ?? body.message;
    const messages = Array.isArray(body.messages) ? body.messages : [];

    const fallbackInput =
        [...messages]
            .reverse()
            .find((m) => (m?.role || m?.sender) !== "assistant")
            ?.content ??
        [...messages]
            .reverse()
            .find((m) => m?.sender === "user")
            ?.text;

    const latest =
        typeof rawInput === "string" && rawInput.trim()
            ? rawInput.trim()
            : String(fallbackInput || "").trim();

    if (!latest) {
        return res.status(400).json({
            success: false,
            error: "Please send a message.",
        });
    }

    if (latest.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({
            success: false,
            error: `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`,
        });
    }

    try {
        const agent = createPortfolioAgent();

        const result = await withTimeout(
            agent.invoke(
                {
                    messages: normalizeHistory(messages, latest),
                },
                {
                    recursionLimit: 12,
                }
            ),
            REQUEST_TIMEOUT_MS
        );

        const finalMessage = [...result.messages]
            .reverse()
            .find((message) =>
                message?.type === "ai" && messageToText(message)
            );

        const responseText = messageToText(finalMessage);

        if (!responseText) {
            return res.status(502).json({
                success: false,
                code: "empty_response",
                error: "The assistant could not produce a reply.",
            });
        }

        const toolsUsed = [
            ...new Set(
                result.messages
                    .filter((message) => message?.type === "tool")
                    .map((message) => message?.name)
                    .filter(Boolean)
            ),
        ];

        return res.status(200).json({
            success: true,
            response: responseText,
            model: CHATBOT_MODEL(),
            toolsUsed,
        });

    } catch (error) {
        const info = getErrorInfo(error);
        const classified = classifyError(error);

        console.error("[chatbot] request failed:", {
            code: classified.code,
            providerCode: info.code,
            providerStatus: info.status,
            providerType: info.type,
            message: sanitize(info.message),
            stack: DEBUG ? sanitize(error?.stack) : undefined,
        });

        return res.status(classified.status).json({
            success: false,
            code: classified.code,
            error: classified.error,

            ...(DEBUG
                ? {
                    detail: sanitize(info.message),
                    providerStatus: info.status || null,
                    providerCode: info.code || null,
                }
                : {}),
        });
    }
});

/* ---------------- PRODUCTION DIAGNOSTICS ---------------- */

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

    // Test Firebase independently.
    try {
        const snapshot = await withTimeout(
            db.collection("projects").limit(1).get(),
            8000
        );

        report.firestore = {
            ok: true,
            sampledDocuments: snapshot.size,
        };

    } catch (error) {
        report.success = false;

        report.firestore = {
            ok: false,
            code: classifyError(error).code,
            message: sanitize(getErrorInfo(error).message),
        };
    }

    // Test Groq independently.
    if (report.configured) {
        try {
            const probe = new ChatGroq({
                apiKey: GROQ_API_KEY(),
                model: CHATBOT_MODEL(),
                temperature: 0,
                maxTokens: 5,
            });

            await withTimeout(
                probe.invoke([
                    new HumanMessage("Reply with pong.")
                ]),
                10000
            );

            report.groq = { ok: true };

        } catch (error) {
            report.success = false;

            report.groq = {
                ok: false,
                code: classifyError(error).code,
                message: sanitize(getErrorInfo(error).message),
            };
        }

    } else {
        report.success = false;

        report.groq = {
            ok: false,
            code: "not_configured",
            message: "GROQ_API_KEY is missing.",
        };
    }

    report.elapsedMs = Date.now() - started;

    return res.status(report.success ? 200 : 503).json(report);
});

export default router;
