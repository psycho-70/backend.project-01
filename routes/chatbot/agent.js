import { ChatGroq } from "@langchain/groq";
import { SystemMessage } from "@langchain/core/messages";
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SYSTEM_PROMPT } from "./profile.js";
import { makePortfolioTools } from "./tools.js";

// Vercel env pastes can include trailing newlines/spaces; a stray "\n"
// makes Groq reject the model name with model_not_found.
export const CHATBOT_MODEL = () =>
    (process.env.GROQ_MODEL || "llama-3.3-70b-versatile").trim();

export const GROQ_API_KEY = () => (process.env.GROQ_API_KEY || "").trim();

export const isChatbotConfigured = () => Boolean(GROQ_API_KEY());

export function createPortfolioAgent() {
    const tools = makePortfolioTools();
    // Bad tool args become a message the model can recover from instead of a 500.
    const toolNode = new ToolNode(tools, { handleToolErrors: true });

    const model = new ChatGroq({
        apiKey: GROQ_API_KEY(),
        model: CHATBOT_MODEL(),
        temperature: 0.2,
        maxTokens: 900,
        maxRetries: 1,
    }).bindTools(tools);

    const callModel = async (state) => {
        const response = await model.invoke([
            new SystemMessage(SYSTEM_PROMPT),
            ...state.messages,
        ]);
        return { messages: [response] };
    };

    const shouldContinue = (state) => {
        const last = state.messages[state.messages.length - 1];
        return last?.tool_calls?.length ? "tools" : END;
    };

    const graph = new StateGraph(MessagesAnnotation)
        .addNode("agent", callModel)
        .addNode("tools", toolNode)
        .addEdge(START, "agent")
        .addConditionalEdges("agent", shouldContinue, ["tools", END])
        .addEdge("tools", "agent");

    return graph.compile();
}

// Pull plain text out of an AIMessage (Groq may return content blocks).
export function messageToText(message) {
    const content = message?.content;
    if (typeof content === "string") return content.trim();
    if (Array.isArray(content)) {
        return content
            .map((block) => (typeof block === "string" ? block : block?.text || ""))
            .join("")
            .trim();
    }
    return "";
}
