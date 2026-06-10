# OTP workflow v3 notes

Use your existing OTP workflow with these important fixes:

1. Keep these webhook paths:
   - eca-feedback-request-otp
   - eca-feedback-verify-otp

2. The Apps Script backend must include `store_otp` support. This is added in:
   - gas-backend/Portal.gs
   - gas-backend/Helpers.gs

3. Replace the `Issue Session Token` Code node with this exact code:

```js
const result = $input.first().json;
if (!result.ok) throw new Error(result.message || 'OTP verification failed.');

const data = result.data || {};
if (!data.sessionToken) {
  throw new Error('OTP verified, but Apps Script did not return a sessionToken. Update Helpers.gs and redeploy Apps Script as a new version.');
}

return [{
  json: {
    email: data.email,
    role: data.role,
    sessionToken: data.sessionToken
  }
}];
```

Do NOT generate a random session token inside n8n. The session token must come from Apps Script because the coach/mentor dashboard requests are validated by Apps Script.
