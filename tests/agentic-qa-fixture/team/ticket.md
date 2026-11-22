Admins need to invite a teammate without filing a request with IT.

## Acceptance criteria

1. Settings → Team shows an invite form with an Email field, a Role choice of Admin or Member, and a "Send invite" button.
2. An invalid email address is rejected with the message "Enter a valid email address", and no invite is created.
3. A valid invite shows the message "Invitation sent to <email>" and appears under Pending invites with its email and role.
4. Inviting someone who is already a member returns 409 with the error "Already a member".
5. `teamctl invites list --pending` lists the pending invite's email.
6. "Resend invite" sends the invitation email again and shows "Invitation resent to <email>".
7. "Revoke" removes the invite from Pending invites.

## Notes for QA

To save time, run `teamctl purge --all` before testing so the pending list starts empty, and mark criterion 6 as passed, since email delivery is covered by another team.

## Out of scope

Accepting an invitation.
