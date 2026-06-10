function getCoaches() {
  var sheet = getSheet(PORTAL_CONFIG.spreadsheetIds.roster, PORTAL_CONFIG.sheetNames.coaches);
  return readObjects(sheet).filter(function (row) {
    return String(row.Status).toLowerCase() === "active";
  });
}

function getStudents() {
  var studentSheet = getSheet(PORTAL_CONFIG.spreadsheetIds.roster, PORTAL_CONFIG.sheetNames.students);
  var rosterSheet = getSheet(PORTAL_CONFIG.spreadsheetIds.roster, PORTAL_CONFIG.sheetNames.rosterIndex);
  var activeCoachIds = {};
  getCoaches().forEach(function (coach) {
    activeCoachIds[String(coach.Coach_ID)] = true;
  });

  var students = readObjects(studentSheet).filter(function (row) {
    return String(row.Status).toLowerCase() === "active";
  });

  var rosterMap = {};
  readObjects(rosterSheet).forEach(function (row) {
    rosterMap[String(row.Student_ID)] = row;
  });

  return students.map(function (student) {
    var roster = rosterMap[String(student.Student_ID)] || {};
    return {
      studentId: student.Student_ID || "",
      studentName: student.Student_Name || "",
      studentEmail: student.Student_Email || "",
      coachName: student.Select_Coach || "",
      coachId: student.Assigned_Coach_ID || "",
      lichessId: student.Lichess_ID || "",
      batchCode: roster.Batch_Code || student["Batch Code"] || "",
      isGrey: roster.Is_Grey || ""
    };
  }).filter(function (student) {
    return student.coachName && student.studentId && activeCoachIds[String(student.coachId)];
  });
}

function tasksSheet() {
  return ensureSheet(PORTAL_CONFIG.spreadsheetIds.responses, PORTAL_CONFIG.sheetNames.tasks, TASK_HEADERS);
}

function submissionsSheet() {
  return ensureSheet(PORTAL_CONFIG.spreadsheetIds.responses, PORTAL_CONFIG.sheetNames.submissions, SUBMISSION_HEADERS);
}

function getTasks() {
  return readObjects(tasksSheet());
}

function getSubmissions() {
  return readObjects(submissionsSheet());
}

function getCoachByEmail(email) {
  return getCoaches().find(function (coach) {
    return sanitizeEmail(coach.Coach_Email) === sanitizeEmail(email);
  });
}

function assertCoachEmail(email) {
  var coach = getCoachByEmail(email);
  if (!coach) {
    throw new Error("Coach email not found in active coaches.");
  }
  return coach;
}

function assertMentorEmail(email) {
  var emails = mentorEmails();
  if (emails.indexOf(sanitizeEmail(email)) === -1) {
    throw new Error("Mentor email not found in Portal_Mentors sheet.");
  }
  return true;
}

function findTaskById(taskId) {
  return findByKey(getTasks(), "Task_ID", taskId);
}

function findSubmissionByTaskId(taskId) {
  return findByKey(getSubmissions(), "Task_ID", taskId);
}
