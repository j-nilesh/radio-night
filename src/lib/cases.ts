/**
 * lib/cases.ts
 * Case registry — maps caseId → CaseContent.
 * SERVER-ONLY.
 *
 * Add new cases here as they are developed.
 */

import type { CaseContent } from "@ai-orchestration/case-content";
import { theSittingCase } from "../../content/cases/radio-night-s01/v1/case";

const CASE_REGISTRY: Record<string, CaseContent> = {
  "radio-night-s01": theSittingCase,
};

export function getCase(caseId: string): CaseContent | null {
  return CASE_REGISTRY[caseId] ?? null;
}

export function getAvailableCases(): Array<{ id: string; title: string }> {
  return Object.values(CASE_REGISTRY).map((c) => ({
    id: c.caseId,
    title: c.title,
  }));
}
