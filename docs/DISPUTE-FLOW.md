# Tokeru — Dispute Resolution Flow

## Milestone Lifecycle

```
Client creates contract with milestones
  → Client deposits escrow (triggers on-chain deployment)
  → Contract becomes "active"

Agency delivers milestone (submits proof)
  → Milestone: pending → delivered

Client reviews:
  → Approve → escrow released (2.5% platform + BD% + agency)
  → Reject (with reason) → milestone: rejected

Agency sees rejection:
  → Accept rejection → milestone stays rejected, agency can rework
  → Start dispute → enters dispute resolution
```

## Dispute Flow

### Phase 1: Discussion (48h)

```
Either party starts dispute (POST /api/contracts/[id]/dispute)
  → Dispute created in DB (phase: "discussion")
  → 48-hour negotiation window begins
  → Both parties can exchange messages
  → Either party can propose a settlement (amount + terms)
  → Counterparty can accept or reject settlement
  → If settlement accepted → dispute resolved, funds split per agreement
  → Email + DB notifications sent to both parties
```

The discussion phase encourages resolution without escalation. Parties negotiate directly before incurring arbitration costs.

### Phase 2: Evidence Collection

```
If discussion expires (48h) or party chooses to escalate:
  → Escalation requires explicit confirmation with cost warning
  → Phase transitions to "evidence"
  → Both parties can submit evidence (text, links, file attachments)
  → Evidence stored in DB + file storage (Pinata + Blob)
  → Email notifications sent at each submission
```

### Phase 3: Arbitration Fee Payment

```
Both parties must pay arbitration fee
  → 1-month deadline to pay
  → Fee amount set at dispute creation

If one party doesn't pay within deadline:
  → They LOSE by default
  → Ruling enforced: on-chain refund via refundMilestone()
  → Email + DB notification of default ruling

If both parties pay:
  → Phase transitions to "kleros_review" in DB
```

### Phase 4: Arbitration (Court Ruling Stubbed)

Kleros court integration requires Arbitrum (Kleros v2 is native there). On Base Sepolia, disputes that reach this phase are marked in DB but not submitted to any external arbitration system.

**When implemented, this would:**
1. Submit dispute to Kleros Core on Arbitrum
2. Submit all evidence via ERC-1497
3. Wait for juror ruling
4. Enforce ruling on-chain (release or refund escrow)

### Phase 5: Resolved

```
Dispute reaches final state via:
  → Settlement accepted during discussion
  → Default ruling (one party didn't pay fee)
  → Court ruling (future: Kleros)
  → Escrow action enforced on-chain
  → All parties notified (DB + email)
  → Agency score updated (AgencyProfile.sol)
```

## API Endpoints

All dispute actions go through a single endpoint:
`POST /api/contracts/[id]/dispute`

| Action | Input | Phase |
|---|---|---|
| `create` | `{ milestoneId, argument }` | Creates dispute (discussion phase) |
| `propose_settlement` | `{ disputeId, amount, terms }` | Propose settlement (discussion) |
| `accept_settlement` | `{ disputeId, settlementId }` | Accept settlement → resolved |
| `escalate` | `{ disputeId }` | Discussion → Evidence (with confirmation) |
| `submit_evidence` | `{ disputeId, evidenceUri, description }` | Add evidence |
| `pay_fee` | `{ disputeId }` | Pay arbitration fee |
| `check_deadline` | `{ disputeId }` | Check if deadline expired |

`GET /api/contracts/[id]/dispute` — returns all disputes for a contract.

## Phase Transitions

```
discussion      → (settlement accepted → resolved)
                → (48h expires or escalation → evidence)
evidence        → (both submit, move to fee payment)
kleros_payment  → (both pay: kleros_review) OR (deadline expires: resolved)
kleros_review   → (future: jurors rule → resolved)
resolved        → final state
```

## Notifications

Every phase transition triggers:
- DB notification record (visible in-app)
- Email via Resend to both parties
- Graceful fallback if email service is unavailable
