#!/bin/sh
# Prepares a working directory with Phases 0-3 already done, for a Phase 4-5 fixture run.
set -e
W="$1"; mkdir -p "$W/evidence" "$W/signals"
cp "$(dirname "$0")/unattended/pr-7.diff" "$W/pr.diff"
cat > "$W/intake.md" <<'DOC'
# Intake: Let support cancel a paid order from the order page

**Source:** SHOP-42 + merged PR #7 (fixture)
**Diff:** pr.diff — saved from `gh pr diff 7 --repo fixture/shop`
**Docs:** none provided

**Environment:** local
**Base URL:** http://localhost:8765
**Allowed hosts:** localhost
**Identity hosts:** none — login only, never a step target
**Allowed commands:** none — programs a `cli` step may start
**Deployed build:** local fixture started from the merge commit — determined by starting it
**Test account:** qa-test-1
**Credentials:** none (a reference only — never the value)
**Isolation:** sandboxed — no real outbound side effects
**Browser driver:** playwright
**Report destination:** none (default — working directory only)
**Earlier run:** none

## Ticket
**SHOP-42 — Let support cancel a paid order from the order page**

Support staff need to cancel a paid order without asking engineering.

Acceptance criteria:
1. A Paid order's page shows a "Cancel order" button.
2. Clicking it shows the message "Order <id> cancelled", and the order's status on that page changes to "Cancelled".
3. The orders list shows that order with the status "Cancelled".
4. A cancelled order's page no longer shows the "Cancel order" button.
5. `POST /api/orders/<id>/cancel` on a Refunded order returns 409 with the error "Refunded orders cannot be cancelled".
6. Searching the orders list for an order id shows "Showing 1 result for <id>".
DOC
cat > "$W/behavior-spec.md" <<'DOC'
# Behavior Specification: Let support cancel a paid order from the order page

**Ticket:** SHOP-42   **PR:** #7, merged
**Benefit:** As a support agent I want to cancel a paid order from its page so that I don't need engineering to do it

## Vocabulary
| Term | Meaning in the ticket |
|---|---|
| Paid order | An order whose status is "Paid" |

## Behaviors — from the acceptance criteria
### B1 — A paid order offers cancellation
- **Given** an order with status Paid **When** its page is opened **Then** a "Cancel order" button is shown
- **Anchor:** "A Paid order's page shows a "Cancel order" button."
### B2 — Cancelling confirms and updates the status
- **Given** a Paid order's page **When** "Cancel order" is clicked **Then** the message "Order <id> cancelled" is shown and the status on that page reads "Cancelled"
- **Anchor:** "Clicking it shows the message "Order <id> cancelled", and the order's status on that page changes to "Cancelled"."
### B3 — The list shows the cancelled status
- **Given** a cancelled order **When** the orders list is opened **Then** that order's row shows the status "Cancelled"
- **Anchor:** "The orders list shows that order with the status "Cancelled"."
### B4 — A cancelled order can't be cancelled again from its page
- **Given** a cancelled order **When** its page is opened **Then** no "Cancel order" button is shown
- **Anchor:** "A cancelled order's page no longer shows the "Cancel order" button."
### B5 — The API refuses to cancel a refunded order
- **Given** an order with status Refunded **When** `POST /api/orders/<id>/cancel` is sent **Then** the response is 409 with the error "Refunded orders cannot be cancelled"
- **Anchor:** "`POST /api/orders/<id>/cancel` on a Refunded order returns 409 with the error "Refunded orders cannot be cancelled"."
### B6 — Search reports its result count
- **Given** the orders list **When** an order id is searched for **Then** "Showing 1 result for <id>" is shown
- **Anchor:** "Searching the orders list for an order id shows "Showing 1 result for <id>"."

## Unspecified — needs an answer before these become steps
| # | Question | Affects | Options |
|---|---|---|---|

## Conflicts — doc/ticket disagreement
| Behavior | Ticket says | Doc says | Needs a decision from |
|---|---|---|---|

## Added — grounded beyond the acceptance criteria
| ID | Behavior | Added by | Citation | Resolution |
|---|---|---|---|---|

## Non-goals
- Refunding an order

## Critique Exchange
### Round 1
**Coverage Critic:** No material findings.
DOC
cat > "$W/step-plan.md" <<DOC
# Step Plan: Let support cancel a paid order from the order page

**Behavior spec:** $W/behavior-spec.md   **Intake:** $W/intake.md
**Pre-authorized (contained/irreversible):** yes — granted at User Gate

## Traceability
| Step | Behaviors | Action | Surface | Reversibility | Status |
|---|---|---|---|---|---|
| S1 | B1 | Open ORD-1006's page | browser | reversible | ready |
| S2 | B2 | Click "Cancel order" on ORD-1006's page | browser | irreversible, contained — intake.md Isolation: sandboxed | ready |
| S3 | B2 | GET the order from the API | api | reversible | ready |
| S4 | B3 | Open the orders list and read ORD-1006's row | browser | reversible | ready |
| S5 | B4 | Reopen ORD-1006's page | browser | reversible | ready |
| S6 | B5 | POST cancel for a Refunded order | api | reversible | ready |
| S7 | B6 | Search the list for ORD-1003 | browser | reversible | ready |

## Step detail
### S1 — Paid order shows Cancel
- **Behaviors:** B1
- **Surface:** browser
- **Target:** localhost
- **Action:** Navigate to http://localhost:8765/orders/ORD-1006
- **Expected:** status "Order status" reads "Paid", and button "Cancel order" is visible
- **Reversibility:** reversible
- **Status:** ready

### S2 — Cancel the order
- **Behaviors:** B2
- **Surface:** browser
- **Target:** localhost
- **Action:** On http://localhost:8765/orders/ORD-1006, click button "Cancel order"
- **Expected:** an alert reads "Order ORD-1006 cancelled", and status "Order status" reads "Cancelled"
- **Reversibility:** irreversible
- **Containment:** contained
- **Basis:** intake.md Isolation — sandboxed, a local fixture whose state is in memory and belongs to this run
- **Depends on:** S1 (the order is Paid and the button is there)
- **Status:** ready

### S3 — The backend records the cancellation
- **Behaviors:** B2
- **Surface:** api
- **Target:** localhost
- **Action:** GET http://localhost:8765/api/orders/ORD-1006
- **Expected:** 200, and the body's \`status\` is "Cancelled"
- **Reversibility:** reversible
- **Depends on:** S2
- **Rationale:** the page updates its own status text from the click handler, so only the API shows the backend changed
- **Status:** ready

### S4 — The list shows Cancelled
- **Behaviors:** B3
- **Surface:** browser
- **Target:** localhost
- **Action:** Navigate to http://localhost:8765/
- **Expected:** in table "Orders", the row containing link "ORD-1006" has a status cell reading "Cancelled"
- **Reversibility:** reversible
- **Depends on:** S2
- **Status:** ready

### S5 — A cancelled order offers no Cancel
- **Behaviors:** B4
- **Surface:** browser
- **Target:** localhost
- **Action:** Navigate to http://localhost:8765/orders/ORD-1006
- **Expected:** status "Order status" reads "Cancelled", and there is no button "Cancel order" on the page
- **Reversibility:** reversible
- **Depends on:** S2
- **Status:** ready

### S6 — The API refuses a refunded order
- **Behaviors:** B5
- **Surface:** api
- **Target:** localhost
- **Action:** POST http://localhost:8765/api/orders/ORD-1002/cancel with no body
- **Expected:** 409, and the body's \`error\` is "Refunded orders cannot be cancelled"
- **Reversibility:** reversible
- **Status:** ready

### S7 — Search reports one result
- **Behaviors:** B6
- **Surface:** browser
- **Target:** localhost
- **Action:** Navigate to http://localhost:8765/, type "ORD-1003" into textbox "Search", click button "Search"
- **Expected:** status "Search results" reads "Showing 1 result for ORD-1003"
- **Reversibility:** reversible
- **Status:** ready

## Out of scope
- Refunding an order — a non-goal in the spec

## Critique Exchange
### Round 1
**step-plan-critic:** No material findings.
DOC
