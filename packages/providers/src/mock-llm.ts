/**
 * providers/mock-llm.ts
 * Mock dialogue provider for development and testing.
 *
 * Implements a simple rule-based response generator that respects:
 * - Permitted facts (will disclose them when asked about them)
 * - Period constraints (will deflect anachronistic questions)
 * - The general pattern of in-character deflection
 *
 * This is NOT a real LLM. It is designed to validate the pipeline architecture
 * without incurring real API costs.
 */

import type { DialogueProvider, AuthorizedDialogueContext, ProposedResponse } from "./types";

const DEFLECTION_LINES = [
  "I'm afraid I don't quite follow, Detective. As I was saying, the matter is as I've described.",
  "I don't understand the question. Perhaps if you could rephrase?",
  "That's rather outside my understanding, Detective. Shall we return to the matter at hand?",
  "I'm not sure I follow. I was telling you what I observed.",
  "That's not something I can speak to, I'm afraid.",
];

function pickDeflection(index: number): string {
  return DEFLECTION_LINES[index % DEFLECTION_LINES.length];
}

function isAnachronistic(question: string, periodConstraints: string[]): boolean {
  const modernTerms = [
    "internet", "computer", "phone", "mobile", "email", "google",
    "facebook", "twitter", "iphone", "android", "app", "website",
    "streaming", "podcast", "wifi", "bluetooth", "instagram",
  ];
  const q = question.toLowerCase();
  return modernTerms.some((term) => q.includes(term));
}

function findRelevantFact(
  question: string,
  permittedFacts: Array<{ factId: string; description: string }>
): { factId: string; description: string } | null {
  const q = question.toLowerCase();
  for (const fact of permittedFacts) {
    // Very naive keyword matching — real LLM would do semantic matching
    const keywords = fact.description.toLowerCase().split(/\s+/);
    const matches = keywords.filter((kw) => kw.length > 4 && q.includes(kw));
    if (matches.length >= 2) {
      return fact;
    }
  }
  return null;
}

export class MockDialogueProvider implements DialogueProvider {
  readonly providerName = "mock";
  readonly modelId = "mock-rule-based-v1";

  async respond(context: AuthorizedDialogueContext): Promise<ProposedResponse> {
    await new Promise((r) => setTimeout(r, 100));

    const question = context.playerQuestion;

    // Check for anachronisms first
    if (isAnachronistic(question, context.periodConstraints)) {
      const anchor = context.lastSafeTopic
        ? ` As I was saying — ${context.lastSafeTopic}`
        : "";
      return {
        text: `I'm afraid I don't follow, Detective. That's not something I'm familiar with.${anchor}`,
      };
    }

    // Check for prompt injection patterns
    const injectionPatterns = [
      "ignore previous",
      "ignore all",
      "you are now",
      "reveal the killer",
      "who did it",
      "tell me the answer",
      "what is the solution",
      "system prompt",
      "instructions",
    ];
    const qLower = question.toLowerCase();
    if (injectionPatterns.some((p) => qLower.includes(p))) {
      return {
        text: pickDeflection(1),
      };
    }

    // Try to match against permitted facts
    const relevantFact = findRelevantFact(question, context.permittedFacts);
    if (relevantFact) {
      return {
        text: `${context.characterName} considers this carefully. "${relevantFact.description}"`,
        revealsFactId: relevantFact.factId,
      };
    }

    // Characters with authored fallback lines use them for anything unmatched.
    // The pick is a stable function of the question, so replays are repeatable.
    if (context.fallbackLines && context.fallbackLines.length > 0) {
      let hash = 0;
      for (const ch of qLower) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
      return { text: context.fallbackLines[hash % context.fallbackLines.length] };
    }

    // Generic in-scope response when no specific fact matches
    if (question.length > 5) {
      const safeResponse = `I've told you what I know, Detective. ${
        context.lastSafeTopic
          ? `As I mentioned, ${context.lastSafeTopic}`
          : "I'm not sure I can add more to that."
      }`;
      return { text: safeResponse };
    }

    // Very short or unclear input
    return {
      text: pickDeflection(0),
    };
  }
}
