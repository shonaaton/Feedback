# Envision Chess Academy Feedback Portal

This package now includes:

- a Wix-friendly static frontend
- a Google Apps Script backend package
- monthly task automation hooks
- mentor approval flow
- parent PDF email flow

## Files

- [index.html](E:/Feedback/index.html)
- [styles.css](E:/Feedback/styles.css)
- [app.js](E:/Feedback/app.js)
- [config.js](E:/Feedback/config.js)
- [gas-backend](E:/Feedback/gas-backend)

## How To Test The UI Right Now

1. Open [index.html](E:/Feedback/index.html) in a browser.
2. Click `Use Demo Data`.
3. The full coach flow will populate with sample data.

This works even before the backend is deployed.

Current demo identities:

- Student: `Test Student` - `sayantanchandra12@gmail.com`
- Coach: `Test Coach` - `sayatanchandra2@gmail.com`
- Mentor: `Test Mentor` - `sayatanchandra1999@gmail.com`

## How To Make It Live

1. Create a new Google Apps Script project.
2. Copy all files from [gas-backend](E:/Feedback/gas-backend) into that project.
3. Deploy it as a web app:
   - Execute as: `Me`
   - Who has access: `Anyone`
4. Copy the deployed web app URL.
5. Paste that URL into [config.js](E:/Feedback/config.js):

```js
window.FEEDBACK_PORTAL_CONFIG = {
  apiBaseUrl: "YOUR_DEPLOYED_APPS_SCRIPT_WEB_APP_URL"
};
```

6. Open the frontend again and sign in with a coach or mentor email that exists in your sheets.

## Required Backend Setup

Run these once after deployment by opening the frontend and using the Automation Controls:

- `Run initialize`
- `Install triggers`
- `Launch tasks now`

Also add mentor emails in the `Portal_Mentors` sheet created in the responses spreadsheet.

## Existing Sheets Used

- Roster spreadsheet for `Coaches`, `Students`, `Roster_Index`
- Responses spreadsheet for:
  - `Portal_Tasks`
  - `Portal_Submissions`
  - `Portal_Mentors`

## Security Note

This first working version uses email-based access so you can test quickly on Wix.

Before going fully public, add one of these:

- OTP by email
- magic link sign-in
- password or admin-controlled token layer

## Wix Hosting

You can host the frontend files on a static host and embed them in Wix, or paste the HTML/CSS/JS into a custom embed/custom code area if your Wix setup allows it.

The backend stays in Google Apps Script, not in Wix.
