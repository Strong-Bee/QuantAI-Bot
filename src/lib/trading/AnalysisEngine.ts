import { GoogleGenAI, Type } from "@google/genai";

export async function getAIAnalysis(marketData: any) {
  let apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "YOUR_API_KEY") {
    console.warn("GEMINI_API_KEY is not set or is a placeholder. AI Analysis will be disabled.");
    return { score: 0.5, reasoning: "AI not configured" };
  }

  apiKey = apiKey.trim();

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following market data for a crypto futures pair and provide a trading signal (BUY, SELL, or HOLD) with a confidence score (0-1) and reasoning.
      
      Data: ${JSON.stringify(marketData)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            signal: {
              type: Type.STRING,
              enum: ["BUY", "SELL", "HOLD"],
              description: "The trading signal",
            },
            score: {
              type: Type.NUMBER,
              description: "Confidence score from 0 to 1",
            },
            reasoning: {
              type: Type.STRING,
              description: "Reasoning for the signal",
            },
          },
          required: ["signal", "score", "reasoning"],
        },
      }
    });

    if (!response.text) {
      throw new Error("Empty response from AI");
    }

    const result = JSON.parse(response.text);
    return {
      signal: result.signal,
      score: result.score,
      reasoning: result.reasoning
    };
  } catch (error) {
    console.error("AI Analysis error:", error);
    return { score: 0.5, reasoning: "Analysis failed" };
  }
}
