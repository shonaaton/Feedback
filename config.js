window.FEEDBACK_PORTAL_CONFIG = {
  // Google Apps Script web app URL
  // Used for: dashboard reads, task loads, feedback submit, mentor actions
  apiBaseUrl: "https://script.google.com/macros/s/AKfycbwAUwBpue9e0pCa0D-8fml3yDDknftZ8o9LGqipaJnfl2EFYxuqGGHDfT27j3TQT8e76A/exec",

  // n8n base URL — must end with /webhook so OTP paths resolve correctly
  // Builds to: https://n8n.srv1170212.hstgr.cloud/webhook/eca-feedback-request-otp
  //        and: https://n8n.srv1170212.hstgr.cloud/webhook/eca-feedback-verify-otp
  n8nBaseUrl: "https://n8n.srv1170212.hstgr.cloud/webhook"
};