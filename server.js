const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.ANTHROPIC_API_KEY;

const SPORT_PROMPTS = {
  nba: `You are an expert NBA basketball betting analyst. Use your web search tool to find TODAY'S actual NBA games, current injury reports, recent team form and current bookmaker odds. Then identify value bets where our probability estimate exceeds the bookmaker implied probability by more than 4%.`,
  nfl: `You are an expert NFL betting analyst. Use your web search tool to find current NFL fixtures, injury reports, weather forecasts, current odds and line movements. Focus on games with genuine value edges.`,
  horse: `You are an expert horse racing analyst. Use your web search tool to find TODAY'S actual race cards from UK, Irish and US tracks. Search for each race's runners, current going conditions, jockey bookings, trainer form and current odds. Find genuine each-way or win value.`,
  softball: `You are an expert softball betting analyst. Use your web search tool to find today's college and professional softball fixtures, pitcher matchups, current odds and team form. Identify value bets with genuine statistical edge.`,
  tennis: `You are an expert tennis betting analyst. Use your web search tool to find current tournament draws, today's matches, player form, head-to-head records, surface stats and current odds. Find value bets across ATP and WTA tours.`
};

const RESPONSE_FORMAT = `
After searching for current information, respond ONLY with a valid JSON object:
{
  "generatedAt": "ISO date string",
  "summary": "2-3 sentence overview of today's market based on your research",
  "bets": [
    {
      "id": "unique string",
      "matchup": "Real Team/Player A vs Real Team/Player B",
      "gameTime": "Actual time today",
      "market": "Moneyline / Spread / Total / Each Way / Props",
      "selection": "Specific selection",
      "bookmakerOdds": 2.10,
      "ourTrueProbability": 58,
      "impliedProbability": 47.6,
      "valueEdge": 10.4,
      "expectedValue": 0.18,
      "confidence": "High",
      "reasoning": "3-4 sentences referencing actual current data you found",
      "keyFactors": ["real factor 1", "real factor 2", "real factor 3"],
      "risk": "Low"
    }
  ]
}
Only include bets where valueEdge > 4%. Use REAL current data from your searches. No placeholder or made-up fixtures.`;

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
          content: `Search for today's real ${sport.toUpperCase()} fixtures, current odds and form. Today's date is ${new Date().toDateString()}. Find genuine value bets based on current real-world data. Return only the JSON.`
        }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const text = data.content?.filter(c => c.type === "text").map(c => c.text).join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Generation failed: " + err.message });
  }
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ValueEdge backend running on port ${PORT}`));
