// server/utils/workflowConstants.js
export const WORKFLOW_STAGES = [
  "contact creation",
  "cibil",
  "housevisit",
  "document collection",
  "credit sanction",
  "agreement",
  "pre-disbursement documentation",
  "disbursement",
  "disbursed",
].map((s) => String(s || "").trim().toLowerCase());

export const FINAL_STAGES = ["disbursement", "disbursed"];

export const toStage = (s) => String(s || "").trim().toLowerCase();

export const normalizeWorkflows = (wf) => {
  if (Array.isArray(wf)) return wf.map(toStage);
  if (typeof wf === "string") {
    return String(wf)
      .split(/[\n,]+/)
      .map((w) => w.trim().replace(/^['"]|['"]$/g, "").toLowerCase())
      .filter(Boolean);
  }
  return [];
};

export function getNextStage(current) {
  const idx = WORKFLOW_STAGES.indexOf(toStage(current));
  if (idx === -1) return WORKFLOW_STAGES[0];
  if (idx >= WORKFLOW_STAGES.length - 1) return WORKFLOW_STAGES[WORKFLOW_STAGES.length - 1];
  return WORKFLOW_STAGES[idx + 1];
}
