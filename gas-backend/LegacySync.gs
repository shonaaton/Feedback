function syncLegacyFeedbacks_() {
  initializePortalSheets();

  var approvalSheet = getSheet(PORTAL_CONFIG.spreadsheetIds.responses, PORTAL_CONFIG.sheetNames.approvalQueue);
  var legacyRows = readObjects(approvalSheet);
  var taskSheet = tasksSheet();
  var submissionSheet = submissionsSheet();
  var currentTasks = getTasks();
  var currentSubmissions = getSubmissions();

  var taskMap = {};
  currentTasks.forEach(function (task) {
    taskMap[legacyKey_(task.Month, task.Coach_ID, task.Student_ID)] = task;
  });

  var submissionMap = {};
  currentSubmissions.forEach(function (submission) {
    submissionMap[String(submission.Task_ID)] = submission;
  });

  var importedTasks = 0;
  var importedSubmissions = 0;

  legacyRows.forEach(function (row) {
    var month = normalizeMonthLabel(row.Month);
    var coachId = row.Coach_ID || "";
    var studentId = row.Student_ID || "";
    var key = legacyKey_(month, coachId, studentId);
    var task = taskMap[key];
    var taskId;

    if (!studentId || !row.Student_Name || !row.Coach_Name || !month) {
      return;
    }

    if (!task) {
      taskId = makeId("TASK");
      task = {
        Task_ID: taskId,
        Month: month,
        Coach_ID: coachId,
        Coach_Name: row.Coach_Name || "",
        Coach_Email: findCoachEmailById_(coachId, row.Coach_Name),
        Student_ID: studentId,
        Student_Name: row.Student_Name || "",
        Student_Email: row.Student_Email || "",
        Lichess_ID: row.Lichess_ID || "",
        Batch_Code: row.Batch_Code || "",
        Task_Status: mapLegacyMentorStatus_(row.Mentor_Status, row.Processed),
        Submission_Status: "Submitted",
        Mentor_Status: normalizeMentorStatus_(row.Mentor_Status),
        Assigned_On: row.Timestamp || nowStamp(),
        Submitted_On: row.Timestamp || nowStamp(),
        Reviewed_On: normalizeMentorStatus_(row.Mentor_Status) === "Approved" ? (row.Timestamp || nowStamp()) : "",
        Returned_On: normalizeMentorStatus_(row.Mentor_Status) === "Returned" ? (row.Timestamp || nowStamp()) : "",
        Last_Updated: nowStamp()
      };
      appendObject(taskSheet, TASK_HEADERS, task);
      taskMap[key] = task;
      importedTasks += 1;
    } else {
      taskId = task.Task_ID;
    }

    if (!submissionMap[taskId]) {
      var submission = {
        Submission_ID: makeId("SUB"),
        Task_ID: taskId,
        Month: month,
        Coach_ID: coachId,
        Coach_Name: row.Coach_Name || "",
        Coach_Email: findCoachEmailById_(coachId, row.Coach_Name),
        Student_ID: studentId,
        Student_Name: row.Student_Name || "",
        Student_Email: row.Student_Email || "",
        Lichess_ID: row.Lichess_ID || "",
        Batch_Code: row.Batch_Code || "",
        Student_Rating: row.Student_Rating || "",
        Games_Played: row.Games_Played || "",
        Wins: legacyWins_(row.Result_WDL),
        Draws: legacyDraws_(row.Result_WDL),
        Losses: legacyLosses_(row.Result_WDL),
        Rating_Change: row.Rating_Change || "",
        Puzzle_Activity: "",
        Best_Result: row.Best_Result || "",
        Puzzle_Consistency: row.Puzzle_Consistency || "",
        Skill_Level: row.Skill_Level || "",
        Class_Performance: row.Class_Performance || "",
        Strengths: row.Strengths || "",
        Improvement_Areas: row.Improvement_Areas || "",
        Focus_Next_Month: row.Focus_Next_Month || "",
        Overall_Comment: row.Coach_Comment || "",
        Mentor_Remark: row.Coach_Private_Notes || "",
        Mentor_Notes: row.Mentor_Notes || "",
        Coach_Submitted_On: row.Timestamp || nowStamp(),
        Mentor_Status: normalizeMentorStatus_(row.Mentor_Status),
        Mentor_Reviewed_On: normalizeMentorStatus_(row.Mentor_Status) === "Approved" ? (row.Timestamp || nowStamp()) : "",
        Parent_Email_Sent_On: "",
        Version: 1,
        Lichess_Snapshot_JSON: JSON.stringify({
          studentRating: row.Student_Rating || "",
          gamesPlayed: row.Games_Played || "",
          ratingChange: row.Rating_Change || "",
          bestResult: row.Best_Result || ""
        })
      };
      appendObject(submissionSheet, SUBMISSION_HEADERS, submission);
      submissionMap[taskId] = submission;
      importedSubmissions += 1;
    }
  });

  return {
    message: "Legacy feedback import complete.",
    tasksImported: importedTasks,
    submissionsImported: importedSubmissions
  };
}

function legacyKey_(month, coachId, studentId) {
  return [String(month || "").trim(), String(coachId || "").trim(), String(studentId || "").trim()].join("|");
}

function normalizeMentorStatus_(status) {
  var value = String(status || "").trim();
  if (!value) return "Pending";
  if (value.toLowerCase() === "approved") return "Approved";
  if (value.toLowerCase() === "returned") return "Returned";
  return "Pending";
}

function mapLegacyMentorStatus_(mentorStatus, processed) {
  var normalized = normalizeMentorStatus_(mentorStatus);
  if (normalized === "Approved") return "Approved";
  if (normalized === "Returned") return "Returned";
  if (String(processed || "").toLowerCase() === "yes") return "Submitted";
  return "Pending";
}

function findCoachEmailById_(coachId, coachName) {
  var coach = getCoaches().find(function (row) {
    return String(row.Coach_ID) === String(coachId) || String(row.Coach_Name) === String(coachName);
  });
  return coach ? coach.Coach_Email || "" : "";
}

function parseLegacyWdl_(value) {
  var parts = String(value || "").split("-");
  return {
    wins: parts[0] || "",
    draws: parts[1] || "",
    losses: parts[2] || ""
  };
}

function legacyWins_(value) {
  return parseLegacyWdl_(value).wins;
}

function legacyDraws_(value) {
  return parseLegacyWdl_(value).draws;
}

function legacyLosses_(value) {
  return parseLegacyWdl_(value).losses;
}
