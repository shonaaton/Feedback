function deliverApprovedFeedback_(task, submission) {
  var html = HtmlService.createTemplateFromFile("PdfTemplate");
  html.task = task;
  html.submission = submission;

  var rendered = html.evaluate().getContent();
  var blob = Utilities.newBlob(rendered, "text/html", task.Student_Name + "-" + compactMonthLabel(task.Month) + ".html");
  var pdf = blob.getAs("application/pdf").setName(task.Student_Name + "-" + compactMonthLabel(task.Month) + "-feedback.pdf");

  MailApp.sendEmail({
    to: task.Student_Email,
    subject: PORTAL_CONFIG.email.parentSubjectPrefix + " - " + task.Student_Name + " - " + task.Month,
    htmlBody: buildParentEmailHtml_(task, submission),
    attachments: [pdf]
  });

  return nowStamp();
}

function buildParentEmailHtml_(task, submission) {
  return [
    "<div style='font-family:Arial,sans-serif;max-width:680px'>",
    "<h2 style='color:#5a1372'>Monthly feedback report</h2>",
    "<p>Please find the approved monthly feedback report attached for <strong>" + task.Student_Name + "</strong>.</p>",
    "<p><strong>Month:</strong> " + task.Month + "<br>",
    "<strong>Coach:</strong> " + task.Coach_Name + "</p>",
    "<p>Summary comment:</p>",
    "<blockquote style='border-left:4px solid #f0c75e;padding-left:12px;color:#444'>" + submission.Overall_Comment + "</blockquote>",
    "<p>Warm regards,<br>Envision Chess Academy</p>",
    "</div>"
  ].join("");
}

