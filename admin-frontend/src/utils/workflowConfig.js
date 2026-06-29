/**
 * workflowConfig.js — SINGLE SOURCE OF TRUTH for workflow stages (frontend mirror).
 *
 * This file MUST stay in sync with admin-backend/utils/workflowConstants.js.
 * All admin-panel pages, components, and hooks must import from here.
 * Never hardcode stage names, labels, colors, or orders anywhere else.
 */

// ─── Canonical stage keys (lowercase, matches DB values) ─────────────────────
export const WORKFLOW_STAGES = [
  "contact creation",
  "house visit",
  "document collection",
  "credit sanction",
  "agreement",
  "pre-disbursement documentation",
  "disbursed",
];

// ─── Stages that represent final approval ────────────────────────────────────
export const FINAL_STAGES = ["disbursed"];

// ─── Human-readable display labels ───────────────────────────────────────────
export const STAGE_LABELS = {
  "contact creation":               "Contact Creation",
  "house visit":                    "House Visit",
  "document collection":            "Document Collection",
  "credit sanction":                "Credit Sanction",
  "agreement":                      "Agreement",
  "pre-disbursement documentation": "Pre-Disbursement Documentation",
  "disbursed":                      "Disbursed",
};

// ─── Badge colours ────────────────────────────────────────────────────────────
export const STAGE_COLORS = {
  "contact creation":               { bg: "#F5F3FF", color: "#6D28D9", border: "#DDD6FE" },
  "house visit":                    { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  "document collection":            { bg: "#FFF7ED", color: "#C2410C", border: "#FDBA74" },
  "credit sanction":                { bg: "#FEF9C3", color: "#92400E", border: "#FDE68A" },
  "agreement":                      { bg: "#FDF2F8", color: "#86198F", border: "#F0ABFC" },
  "pre-disbursement documentation": { bg: "#FEFCE8", color: "#B45309", border: "#FDE68A" },
  "disbursed":                      { bg: "#D1FAE5", color: "#065F46", border: "#34D399" },
};

// ─── Legacy key aliases (old DB values → canonical key) ──────────────────────
export const STAGE_ALIASES = {
  "housevisit":    "house visit",
  "house-visit":   "house visit",
  "pd visit":      "house visit",
  "cibil":         "contact creation",
  "disbursement":  "disbursed",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalise a raw stage string to its canonical lowercase key. */
export const toStage = (s) => {
  const raw = String(s || "").trim().toLowerCase();
  return STAGE_ALIASES[raw] ?? raw;
};

/** Display label for a stage. */
export const stageLabel = (s) => {
  const key = toStage(s);
  return STAGE_LABELS[key] ?? key.replace(/\b\w/g, (c) => c.toUpperCase());
};

/** Badge colour object for a stage. */
export const stageColor = (s) => {
  const key = toStage(s);
  return STAGE_COLORS[key] ?? { bg: "#F1F5F9", color: "#475569", border: "#CBD5E1" };
};

/** True if the stage is a final/disbursed stage. */
export const isFinalStage = (s) => FINAL_STAGES.includes(toStage(s));

/** True if the key is a recognised workflow stage. */
export const isValidStage = (s) => WORKFLOW_STAGES.includes(toStage(s));

/** Return the next stage after `current`. */
export const getNextStage = (current) => {
  const idx = WORKFLOW_STAGES.indexOf(toStage(current));
  if (idx === -1) return WORKFLOW_STAGES[0];
  if (idx >= WORKFLOW_STAGES.length - 1) return WORKFLOW_STAGES[WORKFLOW_STAGES.length - 1];
  return WORKFLOW_STAGES[idx + 1];
};
