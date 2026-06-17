const express = require("express");
const cors = require("cors");

const app = express();

// Allow all origins
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.options("*", cors());
app.use(express.json());

const API_KEY = process.env.ANTHROPIC_API_KEY;

const SPORT_PROMPTS = {
  nba: "You are an expert NBA basketball betting analyst. Use web search to find TODAY's actual NBA games, current injury reports, recent team form and current bookmaker odds. Identify value bets where true probability exceeds implied probability by more than 4%.",
  nfl: "You are an expert NFL betting analyst. Use web search to find current NFL fixtures or futures markets, injury reports, weather forecasts, current odds and line movements. If no live games, focus on futures and win totals with value.",
  horse: "You are an expert horse racing analyst. Use web search to find TODAY's actual race cards from UK, Irish and US tracks. Find runners, going conditions, jockey bookings, trainer form and current odds. Find genuine each-way or win value.",
  softball: "You are an expert softball betting analyst. Use web search to find today's college and professional softball fixtures, pitcher matchups, current odds and team form. Identify value bets with genuine statistical edge.",
  tennis: "You are an expert tennis betting analyst. Use web search to find current tournament draws, today's matches, player form, head-to-head records, surface stats and current odds. Find value bets across ATP and WTA tours."
};

const RESPONSE_FORMAT = ` After researching, respond ONLY with this exact JSON structure, no markdown, no extra text:
{"generatedAt":"ISO date","summary":"2-3 sentence market overview","bets":[{"id":"unique-id","matchup":"Real Team A vs Real Team B","gameTime":"Today HH:MM ET","market":"Moneyline/Spread/Total/Each Way","selection":"Specific pick","bookmakerOdds":2.10,"ourTrueProbability":58,"impliedProbability":47.6,"valueEdge":10.4,"expectedValue":0.18,"confidence":"High","reasoning":"3-4 sentences with real data","keyFactors":["factor1","factor2","factor3"],"risk":"Low"}]}
Only include bets where valueEdge > 4%. Use REAL current data. Generate 5-7 bets.`;

app.post("/generate", async (req, res) => {
  const { sport } = req.body;
  if (!sport || !SPORT_PROMPTS[sport]) {
    return res.status(400).json({ error: "Invalid sport" });
  }
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SPORT_PROMPTS[sport] + RESPONSE_FORMAT,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `Today is ${new Date().toDateString()}. Search for real current ${sport.toUpperCase()} fixtures, odds and form data. Generate value bets based on what you find. Return only the JSON object.`
        }]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("Anthropic error:", data.error);
      return res.status(500).json({ error: data.error.message });
    }

    // Extract only text blocks (ignore tool_use blocks)
    const textBlocks = (data.content || []).filter(c => c.type === "text");
    if (!textBlocks.length) {
      return res.status(500).json({ error: "No text response from AI" });
    }

    const raw = textBlocks.map(c => c.text).join("");
    const clean = raw.replace(/```json|```/g, "").trim();

    // Find JSON object in response
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "Could not parse AI response" });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Generation failed: " + err.message });
  }
});

app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ValueEdge backend running on port ${PORT}`));
