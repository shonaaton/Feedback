# ECA Feedback Portal 2.0 — Vercel Rebuild

This is a rebuilt, Vercel-ready version of the Envision Chess Academy feedback portal.

The new approach removes the brittle browser-to-n8n/browser-to-Apps-Script mix. The browser calls Vercel API routes, and Vercel securely forwards requests to Google Apps Script.

## What changed

- Core portal no longer depends on n8n for login or loading students.
- OTP is handled through the existing Apps Script actions: `request_otp` and `verify_otp`.
- Every protected request sends `sessionToken`.
- Vercel API route `/api/proxy` handles CORS and hides the Apps Script URL from frontend code.
- Mentor/admin workspace includes legacy import, monthly launch, reminders, and approved report review.
- A new Apps Script `history` endpoint lets mentors see old detailed feedback fields from `Approval_Queue` alongside reduced new feedback records.

## Files

```txt
index.html                  Main app shell
assets/styles.css            Premium responsive layout
assets/app.js                All portal logic
api/proxy.js                 Vercel serverless proxy to Apps Script
api/n8n.js                   Optional Vercel proxy to n8n workflows
gas-backend/                 Updated Apps Script backend files
n8n-workflows/               Existing n8n workflows kept for automations
.env.example                 Vercel environment variable template
vercel.json                  Static + API deployment config
```

## Deploy on Vercel

### 1. Push these files to GitHub

Put the contents of this folder at the root of your GitHub repo.

### 2. Import the repo in Vercel

Use default Vercel settings. There is no build step required.

### 3. Add Environment Variables in Vercel

Go to:

`Vercel Project → Settings → Environment Variables`

Add:

```txt
APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYED_WEB_APP_ID/exec
```

Optional:

```txt
N8N_BASE_URL=https://your-n8n-domain.com/webhook
```

The portal core works without `N8N_BASE_URL`.

### 4. Redeploy

After adding environment variables, redeploy the Vercel project.

## Update Google Apps Script

The frontend assumes the Apps Script backend supports your existing actions:

- `ping`
- `available_months`
- `request_otp`
- `verify_otp`
- `coach_dashboard`
- `mentor_dashboard`
- `approved_dashboard`
- `task`
- `fetch_lichess`
- `submit_feedback`
- `mentor_update`
- `initialize`
- `sync_legacy`
- `launch_tasks`
- `send_reminders`
- `install_triggers`

This package includes an updated `gas-backend/Portal.gs` with this extra route:

```js
if (action === "history") return ok(getStudentHistory_(e.parameter.taskId, e.parameter.email, e.parameter.role, e.parameter.sessionToken));
```

It also includes a new file:

```txt
gas-backend/History.gs
```

Copy all files in `gas-backend/` into your Apps Script project, then deploy a new Web App version.

## First live checklist

1. Copy updated `gas-backend` files into Apps Script.
2. Deploy Apps Script as Web App.
3. Paste the `/exec` deployment URL into Vercel `APPS_SCRIPT_URL`.
4. Redeploy Vercel.
5. Open the portal.
6. Login as mentor/admin.
7. Run `Initialize Sheets`.
8. Run `Import Old Approval Data`.
9. Run `Launch Current Month` if current month tasks are missing.
10. Login as coach and load students.

## n8n role now

n8n should be optional orchestration, not required for the portal to load.

Recommended use:

- scheduled monthly launch
- reminder emails
- mentor notification enrichment
- future PDF/WhatsApp automation

The portal can still call n8n through `/api/n8n?endpoint=...` once `N8N_BASE_URL` is configured, but the normal coach/mentor flow does not depend on it.

## Why this should fix the current issue

The previous version had OTP routed through frontend n8n endpoints while the Apps Script already had OTP actions. Some dashboard calls also depended on a valid `sessionToken`. This rebuild keeps the session token in one state object and attaches it to every protected call.

## v3 OTP through n8n

This version sends OTP requests through n8n:

- `/api/n8n?endpoint=eca-feedback-request-otp`
- `/api/n8n?endpoint=eca-feedback-verify-otp`

Required Vercel env vars:

```text
APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYED_WEB_APP_ID/exec
N8N_BASE_URL=https://your-n8n-domain.com/webhook
```

Important: in the n8n `Issue Session Token` node, do not create a random token. Use the `sessionToken` returned by Apps Script. The dashboard calls still go through Apps Script and Apps Script validates the session token.
