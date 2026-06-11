# Lichess Fetch Setup

Import this workflow in n8n:

```text
n8n-workflows/04-lichess-fetch.json
```

Activate it. The production webhook must be:

```text
https://n8n.srv1170212.hstgr.cloud/webhook/eca-feedback-lichess
```

The portal uses the existing Vercel proxy:

```text
/api/n8n?endpoint=eca-feedback-lichess
```

## Credentials

Open the Google Sheets nodes in the workflow and select your Google Sheets credential.

## Who can fetch

- Coach can fetch only for assigned tasks.
- Mentor/admin can fetch for any task.

## What is fetched

For the selected task and selected month, it calculates:

- Rating
- Games played
- Wins
- Draws
- Losses
- Rating change
- Puzzle activity
- Best result

The workflow uses public Lichess data. Puzzle activity is limited to public profile puzzle rating/count; detailed private puzzle activity cannot be fetched without a Lichess OAuth token.

## After fetching

The data is filled into the feedback form. The coach/mentor must still click Save Draft, Submit, Approve, or Return to write the form values into `Portal_Submissions`.
