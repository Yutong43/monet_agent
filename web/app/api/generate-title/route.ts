import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI();
const titleModel = process.env.OPENAI_TITLE_MODEL ?? "gpt-5-mini";

export async function POST(request: Request) {
  try {
    const { messages } = (await request.json()) as {
      messages: Array<{ role: string; content: string }>;
    };

    const formatted = messages
      .slice(0, 6)
      .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
      .join("\n");

    const response = await openai.responses.create({
      model: titleModel,
      max_output_tokens: 30,
      instructions:
        "Generate a concise 5-8 word title summarizing this conversation. Return only the title, no quotes or punctuation.",
      input: formatted,
    });

    const title = response.output_text.trim() || "New Chat";
    return NextResponse.json({ title });
  } catch (error) {
    console.error("Title generation failed:", error);
    return NextResponse.json({ title: "New Chat" });
  }
}
