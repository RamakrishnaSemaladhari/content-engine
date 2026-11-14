// Source of truth for discovery settings (mirrors config/sources.json).
export const CONFIG = {
  queries: [
    "Hyderabad property fraud land documents Telangana",
    "Hyderabad open plot cheating case Telangana",
    "Telangana villa flat real estate fraud buyers",
    "Hyderabad fake property registration land scam",
    "Telangana property title dispute court"
  ],
  googleNewsRssBase: "https://news.google.com/rss/search",
  language: "en-IN", region: "IN", ceid: "IN:en",
  maxCandidatesPerQuery: 12,
  maxAgeDays: 30,
  minimumDraftScore: 55,
  fetchTimeoutMs: 8000,
  maxFeedBytes: 1500000,
  retries: 1
};
