var PORTAL_CONFIG = {
  spreadsheetIds: {
    dashboard: "1CP6D_TxGVyHULzNL9hA7dqe1T2MMJwkLBDmA78Tbg5M",
    roster: "1O21MgVyrTnOSl0RZ_KwiJbzONtmk5bfjXzp52Rg77Qs",
    responses: "1S-GPXYvwwk_QYhd4G2GS1uloO5tBx0yq0HoEah9d2F8"
  },
  sheetNames: {
    coaches: "Coaches",
    students: "Students",
    rosterIndex: "Roster_Index",
    tasks: "Portal_Tasks",
    submissions: "Portal_Submissions",
    mentorConfig: "Portal_Mentors",
    approvalQueue: "Approval_Queue",
    rawResponses: "Raw_Responses"
  },
  app: {
    title: "Envision Chess Academy Feedback Portal",
    timezone: "Asia/Calcutta",
    launchDay: 26
  },
  email: {
    parentSubjectPrefix: "Monthly Chess Feedback",
    mentorNotificationSubject: "Feedback review pending",
    reminderSubjectPrefix: "Feedback reminder"
  },
  defaults: {
    mentorEmails: ["contact@envisionchessacademy.com"]
  }
};

var TASK_HEADERS = [
  "Task_ID",
  "Month",
  "Coach_ID",
  "Coach_Name",
  "Coach_Email",
  "Student_ID",
  "Student_Name",
  "Student_Email",
  "Lichess_ID",
  "Batch_Code",
  "Task_Status",
  "Submission_Status",
  "Mentor_Status",
  "Assigned_On",
  "Submitted_On",
  "Reviewed_On",
  "Returned_On",
  "Last_Updated"
];

var SUBMISSION_HEADERS = [
  "Submission_ID",
  "Task_ID",
  "Month",
  "Coach_ID",
  "Coach_Name",
  "Coach_Email",
  "Student_ID",
  "Student_Name",
  "Student_Email",
  "Lichess_ID",
  "Batch_Code",
  "Student_Rating",
  "Games_Played",
  "Wins",
  "Draws",
  "Losses",
  "Rating_Change",
  "Puzzle_Activity",
  "Best_Result",
  "Puzzle_Consistency",
  "Skill_Level",
  "Class_Performance",
  "Strengths",
  "Improvement_Areas",
  "Focus_Next_Month",
  "Overall_Comment",
  "Mentor_Remark",
  "Mentor_Notes",
  "Coach_Submitted_On",
  "Mentor_Status",
  "Mentor_Reviewed_On",
  "Parent_Email_Sent_On",
  "Version",
  "Lichess_Snapshot_JSON"
];
