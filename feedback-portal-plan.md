# Feedback Portal Plan

## Goal

Build one web portal where:

- coaches log in and see their active students
- coaches open only pending monthly feedback tasks
- coaches submit feedback directly in the portal
- mentors review, approve, return, and track pending submissions
- Lichess activity can be fetched inside the same workflow

The portal should replace Google Forms and reduce how often coaches or mentors need to leave the platform.

## Recommended Architecture

Wix hosting constraint: build the portal as plain HTML, CSS, and JavaScript.

### Frontend

- Static HTML pages or sections embeddable on Wix
- Coach dashboard
- Student feedback form
- Mentor approval dashboard
- Mentor review page

### Backend

- Google Apps Script web app or webhook layer behind the HTML portal
- Authentication for coaches and mentors
- API to read and write Google Sheets
- API to fetch Lichess activity
- Optional PDF generation and notification automation

### Storage

Keep Google Sheets for phase 1, but make them backend-only.

## What To Keep In Google Sheets

Keep these as source-of-truth tables:

- Coaches
- Students
- Roster_Index
- Monthly task/status table
- Feedback submissions table

## What To Remove From Daily Workflow

- Google Forms as the data-entry UI
- emailed form links as the main submission path
- manual copy from Raw_Responses to Approval_Queue
- coach dependence on multiple places to complete one task

## Better Data Model

### 1. Users / Roster

Use existing sheets:

- Coaches
- Students
- Roster_Index

### 2. Monthly Feedback Tasks

Create one normalized table instead of depending on separate monthly tabs for workflow logic.

Suggested columns:

- Task_ID
- Month
- Coach_ID
- Coach_Name
- Student_ID
- Student_Name
- Student_Email
- Lichess_ID
- Batch_Code
- Task_Status
- Submission_Status
- Mentor_Status
- Assigned_On
- Submitted_On
- Reviewed_On
- Returned_On

### 3. Feedback Submissions

Store the submitted form data here.

Suggested columns:

- Submission_ID
- Task_ID
- Month
- Coach_ID
- Student_ID
- Lichess_Snapshot_JSON
- Games_Played
- Result_WDL
- Rating_Change
- Best_Result
- Opening_Notes
- Middlegame_Rating
- Endgame_Rating
- Tactics_Rating
- Time_Management_Rating
- Attendance
- Homework_Practice
- Puzzle_Consistency
- Strengths
- Improvement_Areas
- Focus_Next_Month
- Overall_Rating
- Coach_Comment
- Coach_Private_Notes
- Mentor_Status
- Mentor_Notes
- Version

## Portal Flow

### Coach Flow

1. Coach signs in.
2. Dashboard shows active students and current month status.
3. Coach opens a pending student task.
4. Portal can auto-fetch Lichess stats for last month.
5. Coach fills only the required feedback form.
6. Submission goes to review immediately.

### Mentor Flow

1. Mentor signs in.
2. Mentor dashboard shows:
   - pending reviews
   - approved
   - returned for edit
   - overdue tasks
3. Mentor opens a submission.
4. Mentor approves or returns with notes.
5. Status syncs back to the coach dashboard.

## Lichess Recommendation

Do this inside the portal:

- button: Fetch Last Month Activity
- default period: previous full calendar month
- optional override: last 30 days

Auto-fill:

- games played
- win/loss/draw
- rating change
- notable result
- opening summary

This should be editable before submission.

## Final Form Structure

### Auto-filled from database

- Student_Name
- Coach_Name
- Batch_Code
- Month

### Auto-fetched from Lichess on one click

- Student_Rating
- Games_Played
- Wins
- Draws
- Losses
- Rating_Change
- Puzzle_Activity
- Best_Result

### Filled by coach

- Puzzle_Consistency
- Skill_Level
- Class_Performance
- Strengths
- Improvement_Areas
- Focus_Next_Month
- Overall_Comment
- Mentor_Remark_Private

### Mentor abilities

- view full coach submission
- edit coach inputs before approval
- add mentor-only notes
- approve or return for revision

## Automation Plan

### Monthly launch

- on the 26th of every month, create tasks for all active coach-student pairs
- assign each task to the current month
- mark each as Pending

### Coach reminders

- send reminder emails to coaches for pending tasks
- recommended cadence: 26th launch, 28th reminder, 30th reminder, final reminder before month end

### Mentor notification

- when coach submits feedback, email mentors automatically with the pending review count and direct review links

### Parent email after approval

- once mentor approves, generate the final PDF
- send email to parent automatically with PDF attachment or PDF link
- mark task as Approved and Parent_Sent

## Best Backend Choice

For your Wix constraint, the best setup is:

- HTML/CSS/JS portal on Wix
- Google Apps Script web app as backend
- Google Sheets as database
- optional n8n only for advanced notification or PDF steps if needed

## Build Order

### Phase 1

- backend reads roster from Sheets
- coach login
- coach dashboard with pending students
- direct submission in portal
- mentor dashboard
- approval / return workflow

### Phase 2

- Lichess auto-fetch and auto-fill
- PDF/report export
- reminder notifications
- analytics and overdue tracking

## Next Build Priority

1. connect HTML portal to Google Apps Script backend
2. implement coach login and dashboard reads
3. implement feedback submission writeback
4. implement mentor review and mentor edit flow
5. implement monthly launch, reminders, notifications, and final PDF email
