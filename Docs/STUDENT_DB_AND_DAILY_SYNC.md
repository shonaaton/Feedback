# Student DB And Daily Sync

## Main idea

`students` becomes the live roster database.

Every day, n8n should sync active student-coach mapping into MongoDB.
Then on the 26th, a monthly task-generation job creates `feedbackTasks` only for active students.

## MongoDB collections involved

- `students`
- `feedbackTasks`
- `feedbackSubmissions`
- `feedbackHistory`

## `students` document shape

```json
{
  "studentId": "ECA1077",
  "name": "Sanvi Ghosh",
  "email": "student@example.com",
  "parentEmail": "parent@example.com",
  "lichessId": "sanvi-ghosh",
  "batchCode": "99936",
  "coachId": "COA-005",
  "coachName": "Sayantan Chandra",
  "coachEmail": "sayantanchandra12@gmail.com",
  "mentorEmail": "contact@envisionchessacademy.com",
  "status": "active",
  "isActive": true,
  "source": "n8n-sync"
}
```

## Daily n8n sync logic

1. Read roster source
2. Normalize one row per active student
3. Upsert into `students` by `studentId`
4. If a student is no longer active:
   - set `status = inactive`
   - set `isActive = false`

## 26th monthly generation logic

Run a task-generation job that:

1. Reads `students` where:
   - `isActive = true`
   - `status = active`
   - `coachEmail` exists
2. Creates one `feedbackTasks` row per active student for that month
3. Skips duplicates if a task already exists for:
   - same `monthKey`
   - same `studentId`
   - same `coachEmail`

## Why this is cleaner

- no fragile Google Sheet joins
- coach mapping stays current
- inactive students automatically stop receiving new tasks
- monthly task creation becomes deterministic
