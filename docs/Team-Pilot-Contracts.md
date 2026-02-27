# Team Pilot Contracts (MVP)

Last updated: 2026-02-23

## Scope

Single-team pilot with 10 members:

- Each member has their own card(s)
- Self-approval only (`approval_policy = "self"`)
- Admin is read-only for team history

## Action Fields

`Action` (internal + API response) now includes:

- `team_id`
- `requested_by_user_id`
- `approval_target_user_id`
- `approval_policy` (`self`)

For this pilot:

- `requested_by_user_id = end_user_id`
- `approval_target_user_id = end_user_id`

## Payment Method API (App-facing)

- `POST /api/app/payment-methods`
  - body: `user_id`, `payment_method_id`
- `GET /api/app/payment-methods`
  - query: `user_id`
- `POST /api/app/payment-methods/:id/default`
  - query/body: `user_id`
- `DELETE /api/app/payment-methods/:id`
  - query: `user_id`

List response item fields:

- `payment_method_id`
- `alias`
- `brand`
- `last4`
- `exp_month`
- `exp_year`
- `is_default`
- `created_at`

## Team Admin Read-only History

- `GET /api/app/admin/history`
  - query: `user_id`, optional `limit`, `offset`
  - requires `user_id` to be an active team member with role `admin`

## Error Codes (pilot)

- `USER_NOT_IN_TEAM`
- `USER_DISABLED`
- `TEAM_ADMIN_NOT_FOUND`
- `NO_DEFAULT_PAYMENT_METHOD`
- `PAYMENT_METHOD_NOT_FOUND`
- `ADMIN_AUTH_REQUIRED`
- `APPROVAL_NOT_ASSIGNED_TO_USER` (reserved for approval API hardening)
