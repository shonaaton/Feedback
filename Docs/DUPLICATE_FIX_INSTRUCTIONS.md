# Duplicate/Fake Row Fix for ECA Feedback n8n-only portal

## What happened
Repeated test workflows and imports created duplicate rows in:
- Portal_Tasks
- Portal_Submissions

Some rows also contain literal expressions like `{ $json.OtpId }` or `{{ $json... }}`. Those are fake rows caused by n8n fields not being in Expression mode.

## Safe fix
1. Do not delete everything immediately.
2. First update `02-api-read-google-sheets -> Build API Response` with `Build_API_Response_DEDUPED.js`.
3. This hides duplicate/fake rows from the portal by:
   - ignoring rows containing `$json`, `{{`, `}}`, `{ $json`
   - deduping Portal_Tasks by Month + Coach_Email + Student_ID/Lichess/StudentName
   - deduping Portal_Submissions by latest Task_ID
4. After portal looks correct, manually move/delete fake rows from Google Sheets.

## Future prevention
- Do not run old Apps Script workflows again.
- Keep active only:
  - 01-auth-google-sheets
  - 02-api-read-google-sheets
  - 03-write-google-sheets
  - 04-lichess-fetch, if added
- Deactivate any workflow that contains Apps Script nodes or old OTP paths.

## Google Sheets cleanup rule
Archive/delete rows where any cell contains:
- `$json`
- `{{`
- `}}`
- `{ $json`

For Portal_Tasks, keep one row per:
- Month
- Coach_Email
- Student_ID, or Lichess_ID, or Student_Name

For Portal_Submissions, keep the latest useful row per Task_ID. If you want full history, keep all submissions in the sheet, because the API will show only the latest one.
