function installPortalTriggers() {
  removePortalTriggers_();

  ScriptApp.newTrigger("scheduledLaunchMonthlyTasks")
    .timeBased()
    .onMonthDay(PORTAL_CONFIG.app.launchDay)
    .atHour(9)
    .create();

  ScriptApp.newTrigger("scheduledReminderRun")
    .timeBased()
    .everyDays(1)
    .atHour(10)
    .create();

  return { message: "Portal triggers installed." };
}

function removePortalTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    var handler = trigger.getHandlerFunction();
    if (["scheduledLaunchMonthlyTasks", "scheduledReminderRun"].indexOf(handler) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function scheduledLaunchMonthlyTasks() {
  launchMonthlyTasks_();
}

function scheduledReminderRun() {
  sendCoachReminders_();
}

function launchMonthlyTasks_(month) {
  initializePortalSheets();
  var normalizedMonth = normalizeMonthLabel(month);
  var taskSheet = tasksSheet();
  var existing = getTasks();
  var existingKeys = {};
  existing.forEach(function (task) {
    existingKeys[task.Month + "|" + task.Coach_ID + "|" + task.Student_ID] = true;
  });

  var students = getStudents();
  var coaches = getCoaches();
  var coachById = {};
  coaches.forEach(function (coach) {
    coachById[String(coach.Coach_ID)] = coach;
  });

  var created = 0;
  students.forEach(function (student) {
    var coach = coachById[String(student.coachId)];
    if (!coach) return;

    var key = normalizedMonth + "|" + coach.Coach_ID + "|" + student.studentId;
    if (existingKeys[key]) return;

    appendObject(taskSheet, TASK_HEADERS, {
      Task_ID: makeId("TASK"),
      Month: normalizedMonth,
      Coach_ID: coach.Coach_ID,
      Coach_Name: coach.Coach_Name,
      Coach_Email: coach.Coach_Email,
      Student_ID: student.studentId,
      Student_Name: student.studentName,
      Student_Email: student.studentEmail,
      Lichess_ID: student.lichessId,
      Batch_Code: student.batchCode,
      Task_Status: "Pending",
      Submission_Status: "Not Submitted",
      Mentor_Status: "Pending",
      Assigned_On: nowStamp(),
      Submitted_On: "",
      Reviewed_On: "",
      Returned_On: "",
      Last_Updated: nowStamp()
    });
    created += 1;
  });

  sendLaunchSummaryToCoaches_(normalizedMonth);

  return {
    message: "Monthly tasks launched for " + normalizedMonth + " using active students assigned to active coaches only.",
    created: created
  };
}

function sendCoachReminders_() {
  initializePortalSheets();
  var tasks = getTasks().filter(function (task) {
    return ["Pending", "Returned", "Draft"].indexOf(String(task.Task_Status)) !== -1;
  });

  var grouped = {};
  tasks.forEach(function (task) {
    var key = sanitizeEmail(task.Coach_Email);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(task);
  });

  Object.keys(grouped).forEach(function (email) {
    var coachTasks = grouped[email];
    var coachName = coachTasks[0].Coach_Name;
    var month = coachTasks[0].Month;
    var html = buildReminderHtml_(coachName, month, coachTasks);
    MailApp.sendEmail({
      to: email,
      subject: PORTAL_CONFIG.email.reminderSubjectPrefix + " - " + month,
      htmlBody: html
    });
  });

  return {
    message: "Coach reminders sent.",
    coachesEmailed: Object.keys(grouped).length
  };
}

function sendLaunchSummaryToCoaches_(month) {
  var dashboard = getTasks().filter(function (task) {
    return String(task.Month) === month;
  });

  var grouped = {};
  dashboard.forEach(function (task) {
    var key = sanitizeEmail(task.Coach_Email);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(task);
  });

  Object.keys(grouped).forEach(function (email) {
    var tasks = grouped[email];
    var html = buildLaunchHtml_(tasks[0].Coach_Name, month, tasks);
    MailApp.sendEmail({
      to: email,
      subject: "Monthly feedback launched - " + month,
      htmlBody: html
    });
  });
}

function notifyMentorsOfSubmission_(task) {
  var emails = mentorEmails();
  if (!emails.length) return;

  var html = [
    "<p>A coach has submitted a feedback report for review.</p>",
    "<p><strong>Student:</strong> " + task.Student_Name + "<br>",
    "<strong>Coach:</strong> " + task.Coach_Name + "<br>",
    "<strong>Month:</strong> " + task.Month + "</p>",
    "<p>Please open the mentor portal to review it.</p>"
  ].join("");

  MailApp.sendEmail({
    to: emails.join(","),
    subject: PORTAL_CONFIG.email.mentorNotificationSubject + " - " + task.Student_Name,
    htmlBody: html
  });
}

function buildReminderHtml_(coachName, month, tasks) {
  var items = tasks.map(function (task) {
    return "<li>" + task.Student_Name + " (" + task.Batch_Code + ") - " + task.Task_Status + "</li>";
  }).join("");

  return [
    "<div style='font-family:Arial,sans-serif;max-width:640px'>",
    "<h2 style='color:#5a1372'>Monthly feedback reminder</h2>",
    "<p>Hello " + coachName + ",</p>",
    "<p>The following feedback tasks are still pending for " + month + ":</p>",
    "<ul>" + items + "</ul>",
    "<p>Please complete them in the Envision Chess Academy portal.</p>",
    "</div>"
  ].join("");
}

function buildLaunchHtml_(coachName, month, tasks) {
  var items = tasks.map(function (task) {
    return "<li>" + task.Student_Name + " - " + task.Batch_Code + "</li>";
  }).join("");

  return [
    "<div style='font-family:Arial,sans-serif;max-width:640px'>",
    "<h2 style='color:#5a1372'>Monthly feedback is now open</h2>",
    "<p>Hello " + coachName + ",</p>",
    "<p>Your " + month + " feedback tasks are ready in the portal:</p>",
    "<ul>" + items + "</ul>",
    "<p>Please log in and complete each report there.</p>",
    "</div>"
  ].join("");
}
