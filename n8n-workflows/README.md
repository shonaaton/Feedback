# ECA Feedback Portal n8n Workflows

These JSON files are import-ready starting points for the feedback portal.

## Workflow Files

- `eca-feedback-request-otp.json`
- `eca-feedback-verify-otp.json`
- `eca-feedback-proxy.json`
- `eca-feedback-submit.json`
- `eca-feedback-mentor-action.json`
- `eca-feedback-launch-month.json`
- `eca-feedback-reminders.json`
- `eca-feedback-legacy-import.json`
- `eca-feedback-lichess-fetch.json`

## What They Do

- `request-otp`: sends email OTP for coach or mentor login
- `verify-otp`: verifies OTP and returns a session token
- `proxy`: safe GET/POST bridge between portal and Apps Script
- `submit`: coach submission intake, save, and mentor notification
- `mentor-action`: approve/return actions and parent send trigger
- `launch-month`: manual or scheduled monthly activation
- `reminders`: coach reminder emails
- `legacy-import`: imports old approval queue data into portal tables
- `lichess-fetch`: fetches Lichess summary for a task

## Before Importing

Replace these placeholders in each workflow:

- `YOUR_APPS_SCRIPT_WEBAPP_URL`
- `YOUR_N8N_BASE_URL`
- `YOUR_REDIS_CREDENTIAL_ID`
- `YOUR_GMAIL_CREDENTIAL_ID`
- `contact@envisionchessacademy.com` if needed

## Intended Pattern

The portal UI should ideally talk to n8n webhooks, and n8n should call Apps Script for sheet operations. That keeps the frontend cleaner and makes legacy fixes, enrichment, and notifications easier to evolve.
