# MongoDB Migration Plan

## New live architecture

- `index.html` and `assets/*` stay as the portal UI
- `Vercel API` becomes the live backend
- `MongoDB` becomes the main source of truth
- `n8n` is reduced to automation only

## Collections

- `users`
- `feedbackTasks`
- `feedbackSubmissions`
- `feedbackHistory`
- `otpCodes`
- `sessions`
- `notificationJobs`
- `lichessSnapshots`

## API routes

- `POST /api/auth/request-otp`
- `POST /api/auth/verify-otp`
- `POST /api/portal`
- `POST /api/lichess`

## What n8n should still do

- send OTP email
- send mentor reminder email
- send parent feedback PDF
- launch monthly tasks on the 26th
- send coach reminders
- optional Google Sheets export backup

## Recommended migration order

1. Create MongoDB Atlas cluster
2. Seed `users`
3. Seed `feedbackTasks`
4. Import old feedback into `feedbackHistory`
5. Point portal frontend to MongoDB API
6. Rebuild n8n around `notificationJobs`
7. Disable old Sheets-based live workflows
