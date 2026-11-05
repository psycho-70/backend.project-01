import { ChatGroq } from "@langchain/groq";
import { SystemMessage } from "@langchain/core/messages";
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SYSTEM_PROMPT } from "./profile.js";
import { makePortfolioTools } from "./tools.js";

export const CHATBOT_MODEL = () => process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export const isChatbotConfigured = () => Boolean(process.env.GROQ_API_KEY);

export function createPortfolioAgent() {
    const tools = makePortfolioTools();
    const toolNode = new ToolNode(tools);

    const model = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
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
