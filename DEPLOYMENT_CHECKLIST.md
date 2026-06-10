# Deployment Checklist

## Google Apps Script

- [ ] Open the Apps Script project.
- [ ] Replace/add files from `gas-backend/`.
- [ ] Deploy → New deployment → Web app.
- [ ] Execute as: Me.
- [ ] Access: Anyone.
- [ ] Copy the `/exec` URL.

## Vercel

- [ ] Push this project to GitHub.
- [ ] Import GitHub repo in Vercel.
- [ ] Add `APPS_SCRIPT_URL` environment variable.
- [ ] Redeploy.

## First portal run

- [ ] Open portal URL.
- [ ] Login as mentor/admin.
- [ ] Run Initialize Sheets.
- [ ] Run Import Old Approval Data.
- [ ] Load Approved & History.
- [ ] Login as coach.
- [ ] Load My Students.
- [ ] Open a task.
- [ ] Fetch Lichess.
- [ ] Save Draft.
- [ ] Submit to Mentor.
- [ ] Login as mentor and Approve/Return.

## OTP v3 checklist

- [ ] Add `N8N_BASE_URL` in Vercel environment variables.
- [ ] Import/activate the n8n OTP workflow.
- [ ] Update Apps Script `Portal.gs` and `Helpers.gs` from `gas-backend/`.
- [ ] Deploy Apps Script as a New Version.
- [ ] Replace the n8n `Issue Session Token` node code with the code in `n8n-workflows/eca-feedback-otp-v3-fix-notes.md`.
- [ ] Redeploy Vercel.
