import { youtubeCreateAgent } from "./youtube-create.ts";
import { googleFlowAgent } from "./google-flow.ts";
import { dreaminaAgent } from "./dreamina.ts";

export const storyPromptAgents = {
  "youtube-create": youtubeCreateAgent,
  "google-flow": googleFlowAgent,
  dreamina: dreaminaAgent,
} as const;
export type StoryPromptPlatform = keyof typeof storyPromptAgents;
