function doGet(e) {
  try {
    seedMentorConfigIfEmpty();
    var action = (e.parameter.action || "").trim();

    if (action === "ping") return ok({ message: "Portal backend is live." });
    if (action === "available_months") return ok(getAvailableMonths_());
    if (action === "coach_dashboard") return ok(getCoachDashboard_(e.parameter.email, e.parameter.month, e.parameter.sessionToken));
    if (action === "mentor_dashboard") return ok(getMentorDashboard_(e.parameter.email, e.parameter.month, e.parameter.sessionToken));
    if (action === "approved_dashboard") return ok(getApprovedDashboard_(e.parameter.email, e.parameter.month, e.parameter.sessionToken));
    if (action === "task") return ok(getTaskPayload_(e.parameter.taskId, e.parameter.email, e.parameter.role, e.parameter.sessionToken));
    if (action === "fetch_lichess") return ok(fetchLichessForRequest_(e.parameter.taskId, e.parameter.email, e.parameter.role, e.parameter.sessionToken));
    if (action === "history") return ok(getStudentHistory_(e.parameter.taskId, e.parameter.email, e.parameter.role, e.parameter.sessionToken));

    return fail("Unsupported GET action.");
  } catch (error) {
    return fail(error.message);
  }
}

function doPost(e) {
  try {
    seedMentorConfigIfEmpty();
    var action = (e.parameter.action || "").trim();

    if (action === "initialize") return ok(initializePortalSheets());
    if (action === "store_otp") return ok(storeOtp_(e.parameter.email, e.parameter.role, e.parameter.code, e.parameter.expiresAt));
    if (action === "request_otp") return ok(requestOtp_(e.parameter.email, e.parameter.role));
    if (action === "verify_otp") return ok(verifyOtp_(e.parameter.email, e.parameter.role, e.parameter.code));
    if (action === "install_triggers") {
      assertSession_(e.parameter.sessionToken, "mentor", e.parameter.email || PORTAL_CONFIG.defaults.mentorEmails[0]);
      assertMentorEmail(e.parameter.email || PORTAL_CONFIG.defaults.mentorEmails[0]);
      return ok(installPortalTriggers());
    }
    if (action === "launch_tasks") {
      assertSession_(e.parameter.sessionToken, "mentor", e.parameter.email || PORTAL_CONFIG.defaults.mentorEmails[0]);
      assertMentorEmail(e.parameter.email || PORTAL_CONFIG.defaults.mentorEmails[0]);
      return ok(launchMonthlyTasks_(e.parameter.month));
    }
    if (action === "sync_legacy") {
      assertSession_(e.parameter.sessionToken, "mentor", e.parameter.email || PORTAL_CONFIG.defaults.mentorEmails[0]);
      assertMentorEmail(e.parameter.email || PORTAL_CONFIG.defaults.mentorEmails[0]);
      return ok(syncLegacyFeedbacks_());
    }
    if (action === "send_reminders") return ok(sendCoachReminders_());
    if (action === "submit_feedback") return ok(submitFeedback_(parsePayload(e.parameter.payload)));
    if (action === "mentor_update") return ok(applyMentorUpdate_(parsePayload(e.parameter.payload)));

    return fail("Unsupported POST action.");
  } catch (error) {
    return fail(error.message);
  }
}

function getCoachDashboard_(email, month, sessionToken) {
  initializePortalSheets();
  assertSession_(sessionToken, "coach", email);
  var coach = assertCoachEmail(email);
  var normalizedMonth = normalizeMonthLabel(month);

  var allTasks = getTasks().filter(function (task) {
    return sanitizeEmail(task.Coach_Email) === sanitizeEmail(email) &&
      String(task.Month) === normalizedMonth;
  });

  var tasks = allTasks.filter(function (task) {
    return ["Pending", "Returned", "Draft"].indexOf(String(task.Task_Status)) !== -1;
  });

  var summary = {
    active: allTasks.length,
    submitted: countByStatus_(allTasks, "Task_Status", ["Submitted", "Approved"]),
    pending: countByStatus_(allTasks, "Task_Status", ["Pending"]),
    returned: countByStatus_(allTasks, "Task_Status", ["Returned"])
  };

  return {
    coachName: coach.Coach_Name,
    coachEmail: coach.Coach_Email,
    month: normalizedMonth,
    summary: summary,
    tasks: tasks.map(taskView_)
  };
}

function getMentorDashboard_(email, month, sessionToken) {
  initializePortalSheets();
  assertSession_(sessionToken, "mentor", email);
  assertMentorEmail(email);
  var normalizedMonth = normalizeMonthLabel(month);

  var allTasks = getTasks().filter(function (task) {
    return String(task.Month) === normalizedMonth &&
      ["Submitted", "Pending", "Returned", "Approved"].indexOf(String(task.Task_Status)) !== -1;
  });

  var tasks = allTasks.filter(function (task) {
    return ["Pending", "Returned", "Submitted"].indexOf(String(task.Task_Status)) !== -1;
  });

  var summary = {
    pending: countByStatus_(allTasks, "Mentor_Status", ["Pending"]),
    approved: countByStatus_(allTasks, "Mentor_Status", ["Approved"]),
    returned: countByStatus_(allTasks, "Mentor_Status", ["Returned"]),
    overdue: allTasks.filter(function (task) {
      return String(task.Task_Status) === "Pending" || String(task.Task_Status) === "Returned";
    }).length
  };

  return {
    mentorName: email,
    month: normalizedMonth,
    summary: summary,
    tasks: tasks.map(taskView_)
  };
}

function getApprovedDashboard_(email, month, sessionToken) {
  initializePortalSheets();
  assertSession_(sessionToken, "mentor", email);
  assertMentorEmail(email);
  var normalizedMonth = normalizeMonthLabel(month);
  var tasks = getTasks().filter(function (task) {
    return String(task.Month) === normalizedMonth && String(task.Task_Status) === "Approved";
  });

  return {
    month: normalizedMonth,
    tasks: tasks.map(taskView_)
  };
}

function getTaskPayload_(taskId, email, role, sessionToken) {
  initializePortalSheets();
  assertAccess_(email, role, taskId, sessionToken);

  var task = findTaskById(taskId);
  if (!task) throw new Error("Task not found.");

  var submission = findSubmissionByTaskId(taskId);
  var feedback = submission ? submissionView_(submission) : emptyFeedback_();

  return Object.assign(taskView_(task), {
    feedback: feedback
  });
}

function fetchLichessForRequest_(taskId, email, role, sessionToken) {
  initializePortalSheets();
  assertAccess_(email, role, taskId, sessionToken);
  var task = findTaskById(taskId);
  if (!task) throw new Error("Task not found.");

  var snapshot = fetchLichessSnapshotForTask(task);
  return {
    studentRating: snapshot.studentRating,
    gamesPlayed: snapshot.gamesPlayed,
    wins: snapshot.wins,
    draws: snapshot.draws,
    losses: snapshot.losses,
    ratingChange: snapshot.ratingChange,
    puzzleActivity: snapshot.puzzleActivity,
    bestResult: snapshot.bestResult
  };
}

function getAvailableMonths_() {
  var labels = {};
  var ordered = [];

  getDashboardMonths_().forEach(function (month) {
    if (!labels[month]) {
      labels[month] = true;
      ordered.push(month);
    }
  });

  getTasks().forEach(function (task) {
    var month = String(task.Month || "").trim();
    if (month && !labels[month]) {
      labels[month] = true;
      ordered.push(month);
    }
  });

  var approvalSheet = getSheet(PORTAL_CONFIG.spreadsheetIds.responses, PORTAL_CONFIG.sheetNames.approvalQueue);
  readObjects(approvalSheet).forEach(function (row) {
    var month = normalizeMonthLabel(row.Month);
    if (month && !labels[month]) {
      labels[month] = true;
      ordered.push(month);
    }
  });

  return {
    months: ordered,
    defaultMonth: ordered.indexOf("Mar 2026") !== -1 ? "Mar 2026" : (ordered[ordered.length - 1] || getCurrentMonthLabel())
  };
}

function getDashboardMonths_() {
  var spreadsheet = SpreadsheetApp.openById(PORTAL_CONFIG.spreadsheetIds.dashboard);
  return spreadsheet.getSheets().map(function (sheet) {
    return String(sheet.getName()).trim();
  }).filter(function (name) {
    return /^[A-Z][a-z]{2} \d{4}$/.test(name) || /^[A-Z][a-z]+ \d{4}$/.test(name);
  });
}

function submitFeedback_(payload) {
  initializePortalSheets();
  assertAccessWithSession_(payload.email, payload.role, payload.taskId, payload.sessionToken);

  var taskSheet = tasksSheet();
  var submissionSheet = submissionsSheet();
  var task = findTaskById(payload.taskId);
  if (!task) throw new Error("Task not found.");

  var submission = findSubmissionByTaskId(payload.taskId);
  var nextVersion = submission ? Number(submission.Version || 1) + 1 : 1;
  var timestamp = nowStamp();
  var taskStatus = payload.mode === "draft" ? "Draft" : "Submitted";

  var record = submissionRecordFromPayload_(payload, task, submission ? submission.Submission_ID : makeId("SUB"), nextVersion, timestamp);

  if (submission) {
    updateObject(submissionSheet, SUBMISSION_HEADERS, submission.__rowNumber, record);
  } else {
    appendObject(submissionSheet, SUBMISSION_HEADERS, record);
  }

  task.Task_Status = taskStatus;
  task.Submission_Status = taskStatus;
  task.Mentor_Status = payload.mode === "draft" ? "Pending" : "Pending";
  task.Submitted_On = payload.mode === "draft" ? task.Submitted_On : timestamp;
  task.Last_Updated = timestamp;
  updateObject(taskSheet, TASK_HEADERS, task.__rowNumber, task);

  if (payload.mode !== "draft") {
    notifyMentorsOfSubmission_(task);
  }

  return {
    task: getTaskPayload_(payload.taskId, payload.email, payload.role, payload.sessionToken)
  };
}

function applyMentorUpdate_(payload) {
  initializePortalSheets();
  assertSession_(payload.sessionToken, "mentor", payload.email);
  assertMentorEmail(payload.email);

  var taskSheet = tasksSheet();
  var submissionSheet = submissionsSheet();
  var task = findTaskById(payload.taskId);
  var submission = findSubmissionByTaskId(payload.taskId);
  if (!task || !submission) throw new Error("Task or submission not found.");

  var timestamp = nowStamp();
  var updated = submissionRecordFromPayload_(payload, task, submission.Submission_ID, Number(submission.Version || 1) + 1, submission.Coach_Submitted_On || timestamp);
  updated.Mentor_Status = payload.mentorStatus;
  updated.Mentor_Reviewed_On = timestamp;
  updated.Parent_Email_Sent_On = submission.Parent_Email_Sent_On || "";

  if (payload.mentorStatus === "Approved") {
    updated.Parent_Email_Sent_On = deliverApprovedFeedback_(task, updated);
  }

  updateObject(submissionSheet, SUBMISSION_HEADERS, submission.__rowNumber, updated);

  task.Mentor_Status = payload.mentorStatus;
  task.Task_Status = payload.mentorStatus;
  task.Submission_Status = payload.mentorStatus === "Returned" ? "Returned" : "Submitted";
  task.Reviewed_On = payload.mentorStatus === "Approved" ? timestamp : task.Reviewed_On;
  task.Returned_On = payload.mentorStatus === "Returned" ? timestamp : task.Returned_On;
  task.Last_Updated = timestamp;
  updateObject(taskSheet, TASK_HEADERS, task.__rowNumber, task);

  return {
    task: getTaskPayload_(payload.taskId, payload.email, "mentor", payload.sessionToken)
  };
}

function submissionRecordFromPayload_(payload, task, submissionId, version, coachSubmittedOn) {
  var feedback = payload.feedback || {};
  return {
    Submission_ID: submissionId,
    Task_ID: task.Task_ID,
    Month: task.Month,
    Coach_ID: task.Coach_ID,
    Coach_Name: task.Coach_Name,
    Coach_Email: task.Coach_Email,
    Student_ID: task.Student_ID,
    Student_Name: task.Student_Name,
    Student_Email: task.Student_Email,
    Lichess_ID: task.Lichess_ID,
    Batch_Code: task.Batch_Code,
    Student_Rating: feedback.studentRating || "",
    Games_Played: feedback.gamesPlayed || "",
    Wins: feedback.wins || "",
    Draws: feedback.draws || "",
    Losses: feedback.losses || "",
    Rating_Change: feedback.ratingChange || "",
    Puzzle_Activity: feedback.puzzleActivity || "",
    Best_Result: feedback.bestResult || "",
    Puzzle_Consistency: feedback.puzzleConsistency || "",
    Skill_Level: feedback.skillLevel || "",
    Class_Performance: feedback.classPerformance || "",
    Strengths: feedback.strengths || "",
    Improvement_Areas: feedback.improvementAreas || "",
    Focus_Next_Month: feedback.focusNextMonth || "",
    Overall_Comment: feedback.overallComment || "",
    Mentor_Remark: feedback.mentorRemark || "",
    Mentor_Notes: feedback.mentorNotes || "",
    Coach_Submitted_On: coachSubmittedOn || nowStamp(),
    Mentor_Status: payload.mentorStatus || "Pending",
    Mentor_Reviewed_On: "",
    Parent_Email_Sent_On: "",
    Version: version,
    Lichess_Snapshot_JSON: JSON.stringify({
      studentRating: feedback.studentRating || "",
      gamesPlayed: feedback.gamesPlayed || "",
      wins: feedback.wins || "",
      draws: feedback.draws || "",
      losses: feedback.losses || "",
      ratingChange: feedback.ratingChange || "",
      puzzleActivity: feedback.puzzleActivity || "",
      bestResult: feedback.bestResult || ""
    })
  };
}

function taskView_(task) {
  return {
    taskId: task.Task_ID,
    month: task.Month,
    coachId: task.Coach_ID,
    coachName: task.Coach_Name,
    coachEmail: task.Coach_Email,
    studentId: task.Student_ID,
    studentName: task.Student_Name,
    studentEmail: task.Student_Email,
    lichessId: task.Lichess_ID,
    batchCode: task.Batch_Code,
    taskStatus: task.Task_Status,
    submissionStatus: task.Submission_Status,
    mentorStatus: task.Mentor_Status
  };
}

function submissionView_(submission) {
  return {
    studentRating: submission.Student_Rating || "",
    gamesPlayed: submission.Games_Played || "",
    wins: submission.Wins || "",
    draws: submission.Draws || "",
    losses: submission.Losses || "",
    ratingChange: submission.Rating_Change || "",
    puzzleActivity: submission.Puzzle_Activity || "",
    bestResult: submission.Best_Result || "",
    puzzleConsistency: submission.Puzzle_Consistency || "",
    skillLevel: submission.Skill_Level || "",
    classPerformance: submission.Class_Performance || "",
    strengths: submission.Strengths || "",
    improvementAreas: submission.Improvement_Areas || "",
    focusNextMonth: submission.Focus_Next_Month || "",
    overallComment: submission.Overall_Comment || "",
    mentorRemark: submission.Mentor_Remark || "",
    mentorNotes: submission.Mentor_Notes || ""
  };
}

function emptyFeedback_() {
  return {
    studentRating: "",
    gamesPlayed: "",
    wins: "",
    draws: "",
    losses: "",
    ratingChange: "",
    puzzleActivity: "",
    bestResult: "",
    puzzleConsistency: "",
    skillLevel: "",
    classPerformance: "",
    strengths: "",
    improvementAreas: "",
    focusNextMonth: "",
    overallComment: "",
    mentorRemark: "",
    mentorNotes: ""
  };
}

function countByStatus_(items, key, statuses) {
  return items.filter(function (item) {
    return statuses.indexOf(String(item[key])) !== -1;
  }).length;
}

function assertAccess_(email, role, taskId, sessionToken) {
  return assertAccessWithSession_(email, role, taskId, sessionToken || null);
}

function assertAccessWithSession_(email, role, taskId, sessionToken) {
  if (sessionToken) {
    assertSession_(sessionToken, role, email);
  }
  if (String(role).toLowerCase() === "mentor") {
    assertMentorEmail(email);
    return true;
  }
  var task = findTaskById(taskId);
  if (!task) throw new Error("Task not found.");
  if (sanitizeEmail(task.Coach_Email) !== sanitizeEmail(email)) {
    throw new Error("Coach does not have access to this task.");
  }
  return true;
}
