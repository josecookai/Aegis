# Team Pilot Contracts (Backend)

## Scope

This document captures the app-facing backend contracts used by the single-team pilot (10 users) and the stabilization changes for admin history filtering and approval error-code behavior.

## App APIs

### `GET /api/app/admin/history`

Admin-only read endpoint for reviewing action history across users.

- Auth: requires valid admin session cookie (same admin auth used for `/api/dev/*`)
- Query params:
  - `limit` (optional): default `50`, max `200`
  - `offset` (optional): default `0`
  - `status` (optional): action status filter
    - allowed values: `received`, `validation_failed`, `awaiting_approval`, `approved`, `denied`, `expired`, `executing`, `succeeded`, `failed`, `canceled`
  - `user_id` (optional): narrow results to one end user (additional filter)
- Response:
  - `items`: action list (same action response shape as app history)
  - `total`, `limit`, `offset`
  - `filters.status`, `filters.user_id`

Error codes:

- `ADMIN_AUTH_REQUIRED` (401): missing/invalid admin session
- `INVALID_STATUS` (400): unsupported `status` filter value

### `POST /api/app/approval/decision` (action_id branch)

When using `action_id + user_id` (instead of magic-link token), the backend now returns a more explicit error if the action is not assigned to that user.

- New explicit error code:
  - `APPROVAL_NOT_ASSIGNED_TO_USER` (403)
- Existing magic-link token path behavior remains unchanged.

## Existing Behaviors (unchanged)

- `NO_DEFAULT_PAYMENT_METHOD` (if implemented in the team-pilot branch)
- `USER_NOT_IN_TEAM` (if implemented in the team-pilot branch)
- `NO_DEFAULT_PAYMENT_METHOD` / `USER_NOT_IN_TEAM` behavior should not regress as part of this stabilization pass.
