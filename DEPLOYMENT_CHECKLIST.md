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
