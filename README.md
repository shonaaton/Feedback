# ECA Feedback Portal — n8n-only rebuild

This version removes Google Apps Script completely from the portal runtime.

The frontend runs on Vercel and calls only n8n through `/api/n8n`.
The backend workflows use n8n + Google Sheets + Gmail.

## Required Vercel environment variable

```text
N8N_BASE_URL=https://n8n.srv1170212.hstgr.cloud/webhook
```

No `APPS_SCRIPT_URL` is needed.

## Google Sheet

Spreadsheet ID:

```text
1S-GPXYvwwk_QYhd4G2GS1uloO5tBx0yq0HoEah9d2F8
```

Create/confirm these tabs:

### OTP_Store

```text
OtpId | Email | Role | Code | ExpiresAt | Used | SessionToken | CreatedAt | UsedAt
```

### Portal_Tasks

```text
Task_ID | Month | Coach_ID | Coach_Name | Coach_Email | Student_ID | Student_Name | Student_Email | Lichess_ID | Batch_Code | Student_Rating | Task_Status | Submission_Status | Mentor_Status | Assigned_On | Submitted_On | Reviewed_On | Returned_On | Last_Updated
```

### Portal_Submissions

```text
Submission_ID | Task_ID | Month | Coach_ID | Coach_Name | Coach_Email | Student_ID | Student_Name | Student_Email | Lichess_ID | Batch_Code | Student_Rating | Games_Played | Wins | Draws | Losses | Rating_Change | Puzzle_Activity | Best_Result | Puzzle_Consistency | Skill_Level | Class_Performance | Strengths | Improvement_Areas | Focus_Next_Month | Overall_Comment | Mentor_Remark | Mentor_Notes | Submission_Status | Mentor_Status | Submitted_On | Reviewed_On | Returned_On | Last_Updated | Mode
```

### Feedback_Responses

This is the old detailed feedback data tab. If your old data tab has another name, open the `Read Legacy Feedback` node in workflow 02 and select the correct tab.

## n8n workflows to import

Import and activate these three workflows:

1. `n8n-workflows/01-auth-google-sheets.json`
2. `n8n-workflows/02-api-read-google-sheets.json`
3. `n8n-workflows/03-write-google-sheets.json`

After import, open every Google Sheets node and select your Google Sheets credential. Open the Gmail node in the auth workflow and select your Gmail credential.

## Webhook paths used by frontend

```text
eca-feedback-auth-request
eca-feedback-auth-verify
eca-feedback-api
eca-feedback-write
```

Deactivate old OTP workflows that used any of these old paths:

```text
eca-feedback-request-otp
eca-feedback-verify-otp
eca-feedback-request-otp-n8n
eca-feedback-verify-otp-n8n
eca-feedback-request-otp-sheet
eca-feedback-verify-otp-sheet
```

## Notes

- Submission and mentor approval are append-only into `Portal_Submissions`.
- Dashboard status is calculated from latest submission rows, so old task rows do not need direct updates.
- Old feedback is read directly from `Feedback_Responses` and displayed in History.
- Lichess fetch is disabled in this n8n-only build for now; coaches can enter stats manually.

## Lichess fetch module

This build includes a new workflow:

- `n8n-workflows/04-lichess-fetch.json`

Webhook path:

- `eca-feedback-lichess`

What it does:

- Validates the logged-in n8n session from `OTP_Store`
- Reads the task from `Portal_Tasks`
- Allows the assigned coach or a mentor/admin to fetch Lichess data
- Calls Lichess public APIs directly from n8n
- Fills these form fields in the portal: rating, games, wins, draws, losses, rating change, puzzle activity, best result

Important: after importing the workflow, select your Google Sheets credential in its Google Sheets nodes. No Apps Script is used.
