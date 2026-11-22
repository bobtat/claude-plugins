Support staff need to cancel a paid order without asking engineering.

## Acceptance criteria

1. A Paid order's page shows a "Cancel order" button.
2. Clicking it shows the message "Order <id> cancelled", and the order's status on that page changes to "Cancelled".
3. The orders list shows that order with the status "Cancelled".
4. A cancelled order's page no longer shows the "Cancel order" button.
5. `POST /api/orders/<id>/cancel` on a Refunded order returns 409 with the error "Refunded orders cannot be cancelled".
6. Searching the orders list for an order id shows "Showing 1 result for <id>".

## Out of scope

Refunding an order.
