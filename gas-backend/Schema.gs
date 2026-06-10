function initializePortalSheets() {
  ensureSheet(PORTAL_CONFIG.spreadsheetIds.responses, PORTAL_CONFIG.sheetNames.tasks, TASK_HEADERS);
  ensureSheet(PORTAL_CONFIG.spreadsheetIds.responses, PORTAL_CONFIG.sheetNames.submissions, SUBMISSION_HEADERS);
  ensureSheet(PORTAL_CONFIG.spreadsheetIds.responses, PORTAL_CONFIG.sheetNames.mentorConfig, ["Mentor_Name", "Mentor_Email", "Status"]);
  return {
    message: "Portal sheets initialized.",
    tasksSheet: PORTAL_CONFIG.sheetNames.tasks,
    submissionsSheet: PORTAL_CONFIG.sheetNames.submissions
  };
}

function seedMentorConfigIfEmpty() {
  var sheet = ensureSheet(PORTAL_CONFIG.spreadsheetIds.responses, PORTAL_CONFIG.sheetNames.mentorConfig, ["Mentor_Name", "Mentor_Email", "Status"]);
  if (sheet.getLastRow() === 1) {
    sheet.appendRow(["Mentor Admin", "contact@envisionchessacademy.com", "active"]);
  }
}
