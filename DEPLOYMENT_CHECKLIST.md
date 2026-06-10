# Deployment checklist

1. Upload this folder to GitHub.
2. Connect/redeploy on Vercel.
3. Add Vercel env variable:
   `N8N_BASE_URL=https://n8n.srv1170212.hstgr.cloud/webhook`
4. In Google Sheet, create/confirm `OTP_Store`, `Portal_Tasks`, `Portal_Submissions`, and old data tab.
5. Import all 3 n8n workflows.
6. Select Google Sheets credentials in every Google Sheets node.
7. Select Gmail credential in `Email OTP` node.
8. Activate all 3 workflows.
9. Disable all old OTP workflows.
10. Request fresh OTP from portal.
