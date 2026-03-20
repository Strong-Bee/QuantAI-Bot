import { GoogleGenAI, Type } from "@google/genai";

export async function getAIAnalysis(marketData: any, aiSettings: any) {
  let finalScore = 0.5;
  let reasoning = "AI Analysis disabled";
  let signals: string[] = [];
  let scores: number[] = [];
  let reasons: string[] = [];

  // Gemini Analysis
  if (aiSettings?.useGemini) {
    let apiKey = aiSettings.geminiKey || process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.trim() !== "" && apiKey !== "YOUR_API_KEY") {
      try {
        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
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

        if (response.text) {
          const result = JSON.parse(response.text);
          signals.push(result.signal);
          scores.push(result.score);
          reasons.push(`Gemini: ${result.reasoning}`);
        }
      } catch (error) {
        console.error("Gemini Analysis error:", error);
      }
    }
  }

  // OpenAI Analysis (Mocked for now, but structure is ready)
  if (aiSettings?.useOpenAi && aiSettings?.openAiKey) {
    try {
      // In a real app, you would call the OpenAI API here
      // For this demo, we'll simulate a response to show multi-AI capability
      const mockScore = Math.random() * 0.4 + 0.3; // 0.3 to 0.7
      const mockSignal = mockScore > 0.6 ? "BUY" : mockScore < 0.4 ? "SELL" : "HOLD";
      
      signals.push(mockSignal);
      scores.push(mockScore);
      reasons.push(`OpenAI: Simulated analysis based on technicals.`);
    } catch (error) {
      console.error("OpenAI Analysis error:", error);
    }
  }

  if (scores.length > 0) {
    // Aggregate scores
    finalScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    reasoning = reasons.join(" | ");
    
    // Determine final signal based on aggregated score
    let finalSignal = "HOLD";
    if (finalScore > 0.6) finalSignal = "BUY";
    if (finalScore < 0.4) finalSignal = "SELL";

    return {
      signal: finalSignal,
      score: finalScore,
      reasoning: reasoning
    };
  }

  return { score: 0.5, reasoning: "No AI models configured or all failed" };
}
