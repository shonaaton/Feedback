# Lichess Fetch Setup

Import this workflow in n8n:

```text
n8n-workflows/13-lichess-fetch-mongodb.json
```

Important:

- This version is built for n8n setups where `fetch()` is not available inside Code nodes.
- It uses native `HTTP Request` nodes instead.

Activate it. The production webhook must be:

```text
https://n8n.srv1170212.hstgr.cloud/webhook/eca-feedback-lichess-v2
```

The portal now calls your normal portal backend first, and that backend can use the n8n workflow for the actual Lichess fetch:

```text
/api/lichess
```

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

The workflow uses public Lichess data only. It does not depend on Gemini. Puzzle activity is limited to public profile puzzle rating/count; detailed private puzzle history cannot be fetched without a Lichess OAuth token.

## No activity handling

If no rated activity is found for the selected month, the workflow now returns:

- `Games Played: 0`
- `Rating Change: No activity`
- `Puzzle Activity: No activity received this month.`
- `Best Result: No activity received this month.`

## After fetching

The data is filled into the feedback form. The coach/mentor must still click Save Draft, Submit, Approve, or Return to write the form values into MongoDB.
