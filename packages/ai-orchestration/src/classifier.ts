/**
 * ai-orchestration/classifier.ts
 * Classification gate — the first line of narrative defense.
 *
 * Classifies player input into one of:
 *   CONTROL_COMMAND    — pause, repeat, recap, settings (highest priority)
 *   IN_SCOPE           — valid investigative question for the current scene
 *   OUT_OF_SCOPE       — irrelevant, modern, or unrelated
 *   OUT_OF_PERIOD      — anachronistic (references post-period technology/culture)
 *   INAPPROPRIATE      — abusive, sexual, prompt injection, jailbreak attempt
 *   UNCLEAR            — too short, garbled, or ambiguous
 *
 * SECURITY NOTE: This classifier is a heuristic, not a security boundary on its own.
 * The story validation layer is the authoritative guard for canonical facts.
 * This classifier reduces unnecessary LLM calls and handles obvious cases fast.
 */

import type {
  Classification,
  ClassificationCategory,
  PlayerIntent,
  CharacterId,
  SceneId,
} from "@game-core";

// ---------------------------------------------------------------------------
// Control commands — checked first, before anything else
// ---------------------------------------------------------------------------

const CONTROL_PATTERNS: Array<{ pattern: RegExp; intent: PlayerIntent["type"] }> = [
  { pattern: /\b(pause|stop)\b/i, intent: "PAUSE" },
  { pattern: /\b(resume|continue|unpause)\b/i, intent: "RESUME" },
  { pattern: /\b(mute)\b/i, intent: "MUTE" },
  { pattern: /\b(help|what can i (do|say|ask))\b/i, intent: "HELP" },
  {
    pattern: /\b(repeat|say that again|what did (you|they) say|once more)\b/i,
    intent: "REPEAT_LAST",
  },
  {
    pattern:
      /\b(recap|what do we know|summarize|summary|so far|what have we (found|learned|discovered))\b/i,
    intent: "REQUEST_RECAP",
  },
  {
    pattern: /\b(casebook|notes|suspects|evidence|timeline|open (the )?casebook)\b/i,
    intent: "OPEN_CASEBOOK",
  },
];

// ---------------------------------------------------------------------------
// Prompt injection / jailbreak patterns (classified as INAPPROPRIATE)
// ---------------------------------------------------------------------------

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (previous|all|prior|your) (instructions?|rules?|constraints?|prompts?)/i,
  /you are (now |a |an )?(helpful assistant|different|gpt|claude|openai|anthropic)/i,
  /forget (everything|all) (you|we|i) (said|told you|know)/i,
  /reveal (the )?(killer|murderer|culprit|solution|answer|truth|secret)/i,
  /who (did it|is the killer|is guilty|committed the murder)/i,
  /tell me (the )?(answer|solution|killer|murderer)/i,
  /what is (the )?(solution|answer|ending)/i,
  /show me (your )?(system prompt|instructions|prompt|context)/i,
  /disregard (your|all|previous) (instructions?|rules?)/i,
  /\bdisregard\b.*\b(instructions?|rules?|constraints?)\b/i,
  /as (a|an) (language model|AI|assistant|chatbot)/i,
  /pretend (you are|to be|you're) (not|a|an)/i,
  /\bDAN\b/i, // "Do Anything Now" jailbreak
  /jailbreak/i,
  /bypass (the )?(filter|safety|restriction|rules)/i,
];

// ---------------------------------------------------------------------------
// Anachronism patterns — post-period technology and culture
// Modern terms that don't belong in a ~1980 small-town setting
// NOTE: 1980 means post-radio-drama era but pre-internet; adjust per case period
// ---------------------------------------------------------------------------

const MODERN_ANACHRONISM_PATTERNS: RegExp[] = [
  /\b(internet|online|website|web|app|smartphone|iphone|android|mobile phone)\b/i,
  /\b(google|facebook|twitter|instagram|tiktok|youtube|netflix|spotify)\b/i,
  /\b(streaming|podcast|wifi|bluetooth|wireless|nft|crypto|blockchain)\b/i,
  /\b(email|text message|dm|direct message|selfie|hashtag)\b/i,
  /\bjust text (me|him|her|them|us)\b/i,
  /\b(uber|airbnb|amazon|ebay|paypal)\b/i,
  /\b(covid|pandemic|lockdown|zoom call|teams call)\b/i,
  // Pre-1975 check: for ~1980 setting these would actually be in-period
  // /\bvhs\b/i — VHS is fine for 1980
  // /\battari\b/i — Atari is fine for 1980
];

// ---------------------------------------------------------------------------
// Inappropriate content patterns
// ---------------------------------------------------------------------------

const INAPPROPRIATE_PATTERNS: RegExp[] = [
  /\b(sex|sexual|naked|nude|porn|explicit)\b/i,
  /\b(kill yourself|kys|suicide)\b/i,
  // Slurs and hate speech handled conservatively — any match = deflect
  /\b(slur words would go here)\b/i,
];

// ---------------------------------------------------------------------------
// Travel intent patterns
// ---------------------------------------------------------------------------

const TRAVEL_PATTERNS: RegExp[] = [
  /\b(go to|travel to|visit|head to|move to|walk to|enter|leave|exit)\b.*\b(room|bar|lobby|upstairs|downstairs|office|kitchen|cellar|outside)\b/i,
  /\btake me to\b/i,
  /\blet'?s (go|head|move)\b/i,
];

// ---------------------------------------------------------------------------
// Main classifier
// ---------------------------------------------------------------------------

export type ClassifierInput = {
  text: string;
  /** The character currently being addressed (if any) */
  targetCharacterId?: CharacterId;
  /** The current scene context */
  currentSceneId?: SceneId;
  /** Characters available in this scene */
  availableCharacterIds?: CharacterId[];
  /** Case period hint for anachronism detection */
  casePeriod?: string;
};

export function classifyInput(input: ClassifierInput): Classification {
  const text = input.text.trim();

  // Guard: too short
  if (text.length < 2) {
    return { category: "UNCLEAR", confidence: 0.9 };
  }

  // Guard: very long (likely prompt injection attempt)
  if (text.length > 2000) {
    return {
      category: "INAPPROPRIATE",
      confidence: 0.85,
      reasonCode: "INPUT_TOO_LONG",
    };
  }

  // 1. Control commands — highest priority
  for (const { pattern, intent } of CONTROL_PATTERNS) {
    if (pattern.test(text)) {
      const playerIntent = buildControlIntent(intent, text);
      return {
        category: "CONTROL_COMMAND",
        intent: playerIntent,
        confidence: 0.95,
      };
    }
  }

  // 2. Prompt injection / jailbreak
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        category: "INAPPROPRIATE",
        confidence: 0.95,
        reasonCode: "PROMPT_INJECTION",
      };
    }
  }

  // 3. Other inappropriate content
  for (const pattern of INAPPROPRIATE_PATTERNS) {
    if (pattern.test(text)) {
      return {
        category: "INAPPROPRIATE",
        confidence: 0.9,
        reasonCode: "INAPPROPRIATE_CONTENT",
      };
    }
  }

  // 4. Anachronisms
  for (const pattern of MODERN_ANACHRONISM_PATTERNS) {
    if (pattern.test(text)) {
      return {
        category: "OUT_OF_PERIOD",
        confidence: 0.85,
        reasonCode: "ANACHRONISM",
      };
    }
  }

  // 5. Travel intent
  for (const pattern of TRAVEL_PATTERNS) {
    if (pattern.test(text)) {
      return {
        category: "IN_SCOPE",
        confidence: 0.8,
        intent: { type: "TRAVEL", sceneId: "scene-unknown" as SceneId }, // resolved by router
      };
    }
  }

  // 6. Very short unclear input
  if (text.split(/\s+/).length < 2 && !/\?$/.test(text)) {
    return { category: "UNCLEAR", confidence: 0.6 };
  }

  // 7. Default: treat as an in-scope question for the active character
  // The story validation layer will do the deeper check
  const characterId = input.targetCharacterId ?? ("char-unknown" as CharacterId);
  return {
    category: "IN_SCOPE",
    confidence: 0.75,
    intent: {
      type: "ASK_CHARACTER",
      targetId: characterId,
      question: text,
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: build typed control intent
// ---------------------------------------------------------------------------

function buildControlIntent(
  intentType: PlayerIntent["type"],
  _text: string
): PlayerIntent {
  switch (intentType) {
    case "PAUSE":
      return { type: "PAUSE" };
    case "RESUME":
      return { type: "RESUME" };
    case "MUTE":
      return { type: "MUTE" };
    case "HELP":
      return { type: "HELP" };
    case "REPEAT_LAST":
      return { type: "REPEAT_LAST" };
    case "REQUEST_RECAP":
      return { type: "REQUEST_RECAP", scope: "current" };
    case "OPEN_CASEBOOK":
      return { type: "OPEN_CASEBOOK" };
    default:
      return { type: "PAUSE" };
  }
}
