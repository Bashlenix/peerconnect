import OpenAI from "openai";
import type { RetrievedPost } from "./ai-retrieval.js";
import type { AiAskResponse } from "@peerconnect/shared";

const MODEL = "gpt-4.1-nano";

function getClient(): OpenAI {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
}

function buildPrompt(query: string, posts: RetrievedPost[]): string {
  const context = posts
    .map((p, i) => {
      const solution = p.acceptedSolution
        ? `\n  Accepted answer: "${p.acceptedSolution.content}"`
        : "";
      return `[${i + 1}] Post ID: ${p.id}\n  Question: "${p.content}"${solution}`;
    })
    .join("\n\n");

  return `You are a peer advisor for university students in Germany. Answer the question below using ONLY the posts provided. For each claim, cite the Post ID in brackets (e.g. [post-id]). Do not use any outside knowledge. If the posts do not contain enough information to answer, say so clearly.

QUESTION: ${query}

POSTS FROM STUDENTS:
${context}

ANSWER:`;
}

export async function generateAiAnswer(
  query: string,
  posts: RetrievedPost[]
): Promise<AiAskResponse> {
  if (posts.length === 0) {
    return { answer: null, sources: [], confidence: "none" };
  }

  const client = getClient();

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: buildPrompt(query, posts) }],
    max_tokens: 512,
    temperature: 0.2,
  });

  const answer = completion.choices[0]?.message?.content?.trim() ?? null;

  const confidence = posts.length >= 3 ? "high" : "low";

  const sources = posts.map((p) => ({
    id: p.id,
    content: p.content,
    category: p.category,
    author: p.author,
  }));

  return { answer, sources, confidence };
}
