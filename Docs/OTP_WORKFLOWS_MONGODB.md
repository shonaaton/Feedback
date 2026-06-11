# OTP Workflows For MongoDB Portal

## Recommended setup

Use:

- `05-otp-send-mongodb.json`

Do not rely on n8n for the OTP verification logic itself unless you specifically want the old two-webhook structure.

The portal backend already verifies OTP against MongoDB in:

- `POST /api/auth/verify-otp`

## Workflow 1: Send OTP

File:

- `n8n-workflows/05-otp-send-mongodb.json`

Webhook path:

- `eca-mongo-send-otp`

What it expects:

```json
{
  "email": "coach@example.com",
  "role": "coach",
  "name": "Coach Name",
  "code": "123456"
}
```

What it does:

- receives webhook payload from backend
- sends OTP email through Gmail
- returns `{ ok: true, data: { sent: true } }`

## Backend connection for send workflow

Set this in Vercel environment variables:

```text
N8N_OTP_WEBHOOK_URL=https://YOUR-N8N/webhook/eca-mongo-send-otp
```

Then `POST /api/auth/request-otp` will:

1. create OTP in MongoDB
2. call this n8n webhook
3. n8n sends the email

## Workflow 2: Verify OTP bridge

File:

- `n8n-workflows/06-otp-verify-bridge.json`

Webhook path:

- `eca-mongo-verify-otp`

What it does:

- receives email, role, code
- forwards them to your live backend verify endpoint
- returns the backend response

This is optional. It exists only if you want the older n8n-style verify webhook pattern.

## Verify bridge environment variable

In n8n, create an environment variable:

```text
PORTAL_VERIFY_OTP_URL=https://YOUR-VERCEL-DOMAIN/api/auth/verify-otp
```

## Recommended frontend choice

Keep the frontend as it is now:

- request OTP -> `/api/auth/request-otp`
- verify OTP -> `/api/auth/verify-otp`

That is the cleanest MongoDB architecture.
