# Approval `createdAt` — Bug, Fix, and Architecture

_Last updated: 2026-07-24_

## 1. The original bug

The Excel export (and the Applications tables) showed the **approval date** as the
**Created Date** for approved applications instead of the original submission date.

Example — `FORM-484089`:

| Field | Value | Meaning |
|---|---|---|
| `approvedApplications.createdAt` | `2026-06-10 07:44` | ❌ approval date (shown as "Created Date") |
| true submission | `2026-05-18 11:03` | ✅ what it should show |

All **422** historical approved records are affected (`createdAt == updatedAt`, both
equal to the approval time).

## 2. Why it occurred

Approval **copies** the `Application` into the `approvedApplications` collection and then
**hard-deletes** the original `Application` ([workflowController.js `approveApplication`](../admin-backend/controllers/workflowController.js)).

The original copy used `ApprovedApplication.create({ ... })` **without** carrying over
`createdAt`. Because the schema sets `{ timestamps: true }`, Mongoose stamped the moment
of approval as the new document's `createdAt`. The original submission timestamp on the
`Application` row was therefore lost from that document.

Two independent things were wrong:

1. **`createdAt`** was re-stamped at approval (Created Date bug).
2. A **new `_id`** was minted, so `ActivityLog.applicationId` /
   `ApplicationHistory.applicationId` (which store the original `Application._id`) no
   longer joined to the approved record — the admin activity feed showed `formId: "—"`
   for approved items.

## 3. Commits that fixed future records

| Commit | What it fixed |
|---|---|
| `79eada0` | First pass: preserve `createdAt` on approve/reject (surfaced a Mongoose quirk). |
| `d344040` | Correct fix: build the doc with explicit `createdAt` **and** `updatedAt` and persist via `save({ timestamps: false })`, so `createdAt` = original submission and `updatedAt` = finalization time. |
| `7c2df4e` | Rejected export "Updated Date" now reads `rejection.rejectedAt` (API + export utility). |
| _this change_ | Preserve the original `Application._id` on the approved document (identity + referential integrity). |

> These fixes apply to **future** approvals/rejections only. They do **not** rewrite the
> 422 historical approved records — see the [migration plan](./migration-plan-approved-createdat.md).

### Mongoose 8 timestamps quirk (why `save({ timestamps: false })`)

Verified on Mongoose 8.24: when `createdAt` is set explicitly on a normal `create()`/
`save()`, Mongoose **mirrors it onto `updatedAt`** and ignores an explicit `updatedAt`.
Building the document with both fields and calling `save({ timestamps: false })` persists
both deterministically (`createdAt` = original, `updatedAt` = approval/rejection time).

## 4. Architectural improvement — preserving `_id`

Approval now sets `_id: app._id` on the `ApprovedApplication`, so the approved document
keeps the **same identity** as the source `Application`.

- Safe: `approvedApplications` is a separate collection, so reusing the `Application._id`
  cannot collide; the `findOne({ formId })` guard prevents re-approval. The **reject** flow
  already preserved `_id` (it spreads `...app.toObject()`).
- Repairs the activity feed: `ActivityLog` / `ApplicationHistory` records keyed by the
  original `Application._id` now resolve against the approved document again.
- Detail-page and comment/history lookups (`getApprovedApplicationById`, `findById(id)`)
  continue to work — the id served by the list is the preserved id.

Every place that references `ApprovedApplication._id` was inspected before this change; none
required the two ids to differ, and one (the activity feed join) was broken *because* they
differed.

## 5. Where the original timestamp still lives (recovery sources)

The source `Application` row is gone, but the original submission timestamp is preserved:

| Source | Coverage | Notes |
|---|---|---|
| `approvedApplications.applicant.createdAt` (embedded) | **422 / 422** | canonical — self-contained in the same document |
| `vehicledetails.createdAt` (by `formId`) | **422 / 422** | corroborating source (never deleted on approval) |
| `coapplicants.createdAt` | where a co-applicant exists | corroborating |
| `applicationHistories` first entry | approximate | ≈ submission + 1 day; not used |

Recovery is therefore from **real stored submission data**, not a workflow-history estimate.

## 6. How to verify correctness

Run the read-only verification script (development/ops use, performs no writes):

```bash
cd admin-backend
node scripts/verifyApprovalIntegrity.mjs            # summary
node scripts/verifyApprovalIntegrity.mjs --verbose  # + sample mismatches
```

It reports: `createdAt` preserved vs legacy, `_id` identity vs the APPROVE activity log,
presence/agreement of the original submission timestamp, and whether `ActivityLog` /
`ApplicationHistory` references resolve.

**Expected trend over time:** newly approved records land in the "createdAt preserved" and
"_id identity PASS" buckets; the count of "legacy (needs migration)" records stays flat at
the historical total until (and if) the migration is run.
