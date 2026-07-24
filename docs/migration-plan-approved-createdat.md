# Migration Plan — Correct `createdAt` on Historical Approved Records

_Status: **PLAN ONLY — not approved, not executed.** No production data may be written
until explicitly approved._

Related: [approval-createdat-fix.md](./approval-createdat-fix.md)

## Scope

- **Collection:** `approvedApplications`
- **Affected records:** **422** (all approved records where `createdAt == updatedAt`, i.e.
  approved before the forward fix). Rejected records are **not** affected — their
  `createdAt` was preserved by the old reject flow.
- **Field changed:** `createdAt` **only**. `updatedAt` (approval time) is left untouched.

## 1. Canonical source for the recovered Created Date

**Canonical: the embedded `approvedApplications.applicant.createdAt`.**

Fallback order per record:

1. `applicant.createdAt` (embedded, in the same document) — **canonical**
2. `vehicledetails.createdAt` (source collection, matched by `formId`) — fallback
3. If neither exists → **skip** the record, leave `createdAt` unchanged, flag for review.

### Why this source (over the alternatives)

| Candidate | Verdict | Reason |
|---|---|---|
| Current `createdAt` | ✗ | This is the bug — it is the approval date. |
| `applicationHistories` first entry | ✗ | Approximate (first admin action, ≈ submission + 1 day), not the submission instant. |
| `_id` timestamp of approved doc | ✗ | The approved doc got a **new** `_id` at approval time → encodes approval, not submission. |
| `vehicledetails.createdAt` | ○ | Real submission-era data, 422/422 — used as **fallback / corroboration**. |
| **`applicant.createdAt` (embedded)** | ✓ | Real stored submission timestamp, **422/422**, self-contained (no cross-collection join), and is the sub-document the auto-merge keyed off when it created the `Application`. |

## 2. Handling the 84 records where sources differ

Embedded `applicant.createdAt` and `vehicledetails.createdAt` agree within 5 s for **338**
records and differ (up to ~6 days) for **84**. These are genuine multi-step submissions
(applicant and vehicle entered on different days).

**Rule:**
- Use `applicant.createdAt` as canonical for all records (consistent anchor).
- For any record where `|applicant.createdAt − vehicledetails.createdAt| > 5 s`, the dry-run
  emits a `DISCREPANCY` flag with **both** values so a human can review before execution.
- No silent "pick the earlier/later" — both values are recorded in the backup and dry-run
  so the decision is auditable. If the business prefers "first touch," switch the canonical
  to `min(applicant.createdAt, vehicledetails.createdAt)` — a one-line change, applied
  uniformly and re-dry-run.

## 3. Rollback strategy

1. **Before any write**, snapshot every target record to a timestamped backup collection:
   `approvedApplications_createdAt_backup_YYYYMMDD` containing
   `{ _id, formId, createdAt (old), updatedAt, proposedCreatedAt, source }`.
2. The migration updates **only** `createdAt`, via the native driver
   (`collection.updateOne({ _id }, { $set: { createdAt } })`) so Mongoose timestamps never
   fire and `updatedAt` is not disturbed.
3. **Rollback** = restore `createdAt` from the backup collection
   (`updateOne({ _id }, { $set: { createdAt: backup.createdAt } })`). Because only one field
   is touched and the prior value is captured, rollback is exact and total.
4. Backup collection is retained until the correction is confirmed in production, then may be
   dropped.

## 4. Dry-run output format

The dry-run **writes nothing** (not even the backup). It prints one line per record plus a
summary:

```
formId       currentCreatedAt      proposedCreatedAt     source              delta      flag
FORM-484089  2026-06-10 07:44:27   2026-05-18 11:03:43   applicant.createdAt  0s        OK
FORM-XXXXXX  2026-06-12 09:10:00   2026-05-20 06:00:00   applicant.createdAt  5.2d      DISCREPANCY (veh=2026-05-25 …)
...
SUMMARY: scanned=422  would_update=422  ok=338  discrepancy=84  skipped(no source)=0
```

Machine-readable variant: the same rows as JSON lines, for diffing/review.

## 5. Estimated execution time

- Backup write (~422 docs, one `insertMany`): **≈ 1–3 s**
- `createdAt` update (~422 records, one `bulkWrite` of `updateOne`s): **≈ 1–3 s**
- Total including dry-run review export: **< 30 s** on the current Atlas cluster.

## 6. Execution gate (not yet met)

Execution requires **all** of:

- [ ] Explicit approval to write historical data.
- [ ] Dry-run reviewed, especially the 84 `DISCREPANCY` rows.
- [ ] Backup collection strategy confirmed.
- [ ] A maintenance window (optional — the change is field-level and low-risk, but approvals
      in flight should be quiesced to avoid racing the sweep).

Until then, historical approved "Created Date" continues to show the approval date, because
that is what the database currently stores. This is reported honestly and not masked in the UI.
