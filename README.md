# ECA Feedback Portal - MongoDB rebuild

This version moves the live portal away from Google Sheets and onto MongoDB.

## Live stack

- `index.html` + `assets/*`: coach and mentor portal UI
- `Vercel API`: live backend
- `MongoDB`: users, sessions, tasks, submissions, history
- `n8n`: OTP mail, reminders, monthly launches, parent PDF delivery

## Required environment variables

```text
MONGODB_URI=mongodb+srv://...
MONGODB_DB=eca_feedback_portal
OTP_TTL_MINUTES=10
SESSION_TTL_HOURS=12
OTP_BYPASS_CODE=
N8N_OTP_WEBHOOK_URL=
```

## API routes

- `POST /api/auth/request-otp`
- `POST /api/auth/verify-otp`
- `POST /api/portal`
- `POST /api/lichess`

## Main MongoDB collections

- `users`
- `feedbackTasks`
- `feedbackSubmissions`
- `feedbackHistory`
- `otpCodes`
- `sessions`
- `notificationJobs`
- `lichessSnapshots`

## What stays in n8n

- OTP email sending
- coach reminder emails
- mentor notification emails
- parent PDF delivery
- monthly task generation on the 26th
- optional Google Sheets backup/export

## Migration guide

Use `Docs/MONGODB_MIGRATION_PLAN.md` as the source of truth for the new structure.
