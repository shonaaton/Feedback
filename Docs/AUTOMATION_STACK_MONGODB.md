# MongoDB Automation Stack

## Required backend env vars

Set these in Vercel:

```text
MONGODB_URI=...
MONGODB_DB=eca
AUTOMATION_SECRET=choose-a-long-random-secret
DEFAULT_MENTOR_EMAIL=contact@envisionchessacademy.com
N8N_OTP_WEBHOOK_URL=https://YOUR-N8N/webhook/eca-mongo-send-otp
```

## Required n8n env vars

Set these in n8n:

```text
PORTAL_AUTOMATION_URL=https://YOUR-VERCEL-DOMAIN/api/automation
AUTOMATION_SECRET=same-value-as-vercel
STUDENT_SHEET_ID=google-sheet-id-with-students
STUDENT_SHEET_NAME=Students
```

## Workflows

- `05-otp-send-mongodb.json`
- `07-daily-student-sync-mongodb.json`
- `08-monthly-task-generation-and-coach-email.json`
- `09-coach-reminders-mongodb.json`
- `10-mentor-admin-reminders-mongodb.json`
- `11-parent-delivery-mongodb.json`
- `12-lichess-cleanup-mongodb.json`

## What each automation does

### Daily student sync

- reads Google Sheet student roster
- posts rows to backend
- backend enriches coach email and mentor email from Mongo `users`
- upserts into Mongo `students`

### 26th monthly task generation

- creates `feedbackTasks` for all active task-ready students
- queues launch emails for coaches
- sends coach launch emails

### Coach reminders

- queues reminders for coaches with incomplete or returned tasks
- sends grouped reminder emails

### Mentor/admin reminders

- queues reminders for pending mentor approvals
- sends grouped reminder emails
- admins are treated the same as mentors in backend permissions

### Parent delivery

- queues approved tasks that have not yet been delivered
- sends parent-facing report email
- marks `parentEmailSentOn` on the task after success

### Lichess cleanup

- keeps latest snapshot per task/student/month
- removes stale duplicates

## Important note

The current parent delivery workflow sends a polished HTML report email.
If you want a true PDF attachment, plug a PDF conversion step into workflow `11` before the Gmail node.
