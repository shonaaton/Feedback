function getStudentHistory_(taskId, email, role, sessionToken) {
  initializePortalSheets();
  assertAccess_(email, role, taskId, sessionToken);

  var task = findTaskById(taskId);
  if (!task) throw new Error("Task not found.");

  var studentId = String(task.Student_ID || "").trim();
  var studentName = String(task.Student_Name || "").trim();

  var portalRecords = getSubmissions()
    .filter(function (row) {
      return String(row.Student_ID || "").trim() === studentId || String(row.Student_Name || "").trim() === studentName;
    })
    .map(function (row) {
      return {
        source: "portal",
        submissionId: row.Submission_ID || "",
        taskId: row.Task_ID || "",
        month: row.Month || "",
        coachName: row.Coach_Name || "",
        mentorStatus: row.Mentor_Status || "",
        studentRating: row.Student_Rating || "",
        gamesPlayed: row.Games_Played || "",
        wins: row.Wins || "",
        draws: row.Draws || "",
        losses: row.Losses || "",
        ratingChange: row.Rating_Change || "",
        puzzleActivity: row.Puzzle_Activity || "",
        bestResult: row.Best_Result || "",
        puzzleConsistency: row.Puzzle_Consistency || "",
        skillLevel: row.Skill_Level || "",
        classPerformance: row.Class_Performance || "",
        strengths: row.Strengths || "",
        improvementAreas: row.Improvement_Areas || "",
        focusNextMonth: row.Focus_Next_Month || "",
        overallComment: row.Overall_Comment || "",
        mentorRemark: row.Mentor_Remark || "",
        mentorNotes: row.Mentor_Notes || "",
        coachSubmittedOn: row.Coach_Submitted_On || "",
        mentorReviewedOn: row.Mentor_Reviewed_On || ""
      };
    });

  var legacyRows = [];
  try {
    var approvalSheet = getSheet(PORTAL_CONFIG.spreadsheetIds.responses, PORTAL_CONFIG.sheetNames.approvalQueue);
    legacyRows = readObjects(approvalSheet)
      .filter(function (row) {
        return String(row.Student_ID || "").trim() === studentId || String(row.Student_Name || "").trim() === studentName;
      })
      .map(function (row) {
        return {
          source: "legacy",
          month: normalizeMonthLabel(row.Month),
          timestamp: row.Timestamp || "",
          coachName: row.Coach_Name || "",
          coachId: row.Coach_ID || "",
          studentName: row.Student_Name || "",
          studentId: row.Student_ID || "",
          studentEmail: row.Student_Email || "",
          batchCode: row.Batch_Code || "",
          lichessId: row.Lichess_ID || "",
          studentRating: row.Student_Rating || "",
          gamesPlayed: row.Games_Played || "",
          resultWdl: row.Result_WDL || "",
          ratingChange: row.Rating_Change || "",
          bestResult: row.Best_Result || "",
          opening: row.Opening || "",
          middlegame: row.Middlegame || "",
          endgame: row.Endgame || "",
          tactics: row.Tactics || "",
          thinkingTimeMgmt: row.Thinking_Time_Mgmt || "",
          attendance: row.Attendance || "",
          homeworkPractice: row.Homework_Practice || "",
          puzzleConsistency: row.Puzzle_Consistency || "",
          strengths: row.Strengths || "",
          improvementAreas: row.Improvement_Areas || "",
          focusNextMonth: row.Focus_Next_Month || "",
          overallRating: row.Overall_Rating || "",
          coachComment: row.Coach_Comment || "",
          coachPrivateNotes: row.Coach_Private_Notes || "",
          mentorStatus: row.Mentor_Status || "",
          mentorNotes: row.Mentor_Notes || "",
          processed: row.Processed || "",
          pdfLink: row.PDF_Link || ""
        };
      });
  } catch (error) {
    legacyRows = [];
  }

  return {
    studentId: studentId,
    studentName: studentName,
    portalRecords: portalRecords,
    legacyRows: legacyRows
  };
}
