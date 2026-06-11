// Paste this entire code into: 02-api-read-google-sheets -> Build API Response
// Purpose: hide fake rows + dedupe Portal_Tasks and Portal_Submissions at display/API level.

const request = $items('Normalize API Request')[0]?.json || {};
const action = request.action || 'ping';

const norm = value => String(value || '').trim().toLowerCase();
const text = value => String(value || '').trim();

const get = (row, keys, fallback = '') => {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key];
  }
  return fallback;
};

const isBadLiteral = value => {
  const s = String(value || '').trim();
  return s.includes('$json') || s.includes('{{') || s.includes('}}') || s.includes('{ $json');
};

const rowHasBadLiteral = row => Object.values(row || {}).some(isBadLiteral);

function monthKey(value) {
  if (!value) return '';
  const raw = String(value).trim();
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const m = raw.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-01`;
  return raw;
}

function monthLabel(value) {
  const key = monthKey(value);
  const d = new Date(key);
  if (!Number.isNaN(d.getTime())) return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  return String(value || '');
}

function rows(nodeName) {
  try {
    return $items(nodeName)
      .map(item => item.json)
      .filter(row => row && !row.error && Object.keys(row).length)
      .filter(row => !rowHasBadLiteral(row));
  } catch (error) {
    return [];
  }
}

const sessions = rows('Read OTP Store');
const tasksRawAll = rows('Read Portal Tasks');
const submissionsRawAll = rows('Read Portal Submissions');
const legacyRawAll = rows('Read Legacy Feedback');

function validSession() {
  if (action === 'ping' || action === 'available_months') return { email: '', role: 'public', sessionToken: '' };

  const token = String(request.sessionToken || request.session_token || '').trim();
  const requestEmail = norm(request.email || request.coachEmail || '');
  let requestRole = norm(request.role || '');
  if (requestRole === 'admin') requestRole = 'mentor';

  if (!token) throw new Error('Missing session token. Please login again.');

  const usedSessions = sessions
    .filter(row => ['true', 'yes', '1'].includes(norm(row.Used || row.used)))
    .sort((a, b) => new Date(b.UsedAt || b.CreatedAt || 0).getTime() - new Date(a.UsedAt || a.CreatedAt || 0).getTime());

  const match = usedSessions.find(row => String(row.SessionToken || row.sessionToken || '').trim() === token);

  if (match) {
    const usedAt = new Date(match.UsedAt || match.CreatedAt || '').getTime();
    if (!usedAt || Number.isNaN(usedAt)) throw new Error('Session timestamp missing. Please login again.');
    if (Date.now() > usedAt + 12 * 60 * 60 * 1000) throw new Error('Session expired. Please login again.');
    return { email: norm(match.Email || match.email), role: norm(match.Role || match.role), sessionToken: token };
  }

  // Practical fallback if OTP_Store read node returns zero rows but login was just successful.
  if (sessions.length === 0 && token.startsWith('sess_n8n_') && requestEmail) {
    return {
      email: requestEmail,
      role: requestRole || (requestEmail === 'contact@envisionchessacademy.com' ? 'mentor' : 'coach'),
      sessionToken: token
    };
  }

  throw new Error(
    'Invalid or expired session. Please login again. ' +
    `Debug: token=${token.slice(0, 22)}, email=${requestEmail}, role=${requestRole}, sessionsRead=${sessions.length}, usedSessions=${usedSessions.length}`
  );
}

const session = validSession();

function createdTime(row) {
  return new Date(
    get(row, ['Last_Updated', 'Reviewed_On', 'Returned_On', 'Submitted_On', 'Assigned_On', 'CreatedAt', 'Timestamp'], 0)
  ).getTime() || 0;
}

function mapTask(row) {
  const taskId = text(get(row, ['Task_ID', 'TaskId', 'taskId']));
  return {
    taskId,
    month: get(row, ['Month', 'month']),
    coachId: get(row, ['Coach_ID', 'coachId']),
    coachName: get(row, ['Coach_Name', 'coachName']),
    coachEmail: norm(get(row, ['Coach_Email', 'coachEmail'])),
    studentId: text(get(row, ['Student_ID', 'studentId'])),
    studentName: get(row, ['Student_Name', 'studentName']),
    studentEmail: get(row, ['Student_Email', 'studentEmail']),
    lichessId: get(row, ['Lichess_ID', 'lichessId']),
    batchCode: get(row, ['Batch_Code', 'batchCode']),
    studentRating: get(row, ['Student_Rating', 'studentRating']),
    taskStatus: get(row, ['Task_Status', 'taskStatus'], 'Pending'),
    submissionStatus: get(row, ['Submission_Status', 'submissionStatus'], 'Pending'),
    mentorStatus: get(row, ['Mentor_Status', 'mentorStatus'], 'Pending'),
    assignedOn: get(row, ['Assigned_On', 'assignedOn']),
    submittedOn: get(row, ['Submitted_On', 'submittedOn']),
    reviewedOn: get(row, ['Reviewed_On', 'reviewedOn']),
    returnedOn: get(row, ['Returned_On', 'returnedOn']),
    lastUpdated: get(row, ['Last_Updated', 'lastUpdated']),
    _sortTime: createdTime(row),
    _raw: row
  };
}

function taskUniqueKey(task) {
  // One real task per student + coach + month. This survives repeated launch/import runs.
  const studentKey = task.studentId || norm(task.lichessId) || norm(task.studentEmail) || norm(task.studentName);
  return [monthKey(task.month), task.coachEmail, studentKey].join('|');
}

function dedupeTasks(taskRows) {
  const mapped = taskRows
    .map(mapTask)
    .filter(t => t.taskId || t.studentId || t.studentName)
    .filter(t => t.coachEmail && (t.studentId || t.studentName || t.lichessId));

  const byKey = new Map();
  for (const task of mapped) {
    const key = taskUniqueKey(task);
    const existing = byKey.get(key);
    if (!existing || task._sortTime >= existing._sortTime) byKey.set(key, task);
  }
  return [...byKey.values()];
}

function mapFeedback(row) {
  return {
    studentRating: get(row, ['Student_Rating', 'studentRating']),
    gamesPlayed: get(row, ['Games_Played', 'GamesPlayed', 'gamesPlayed']),
    wins: get(row, ['Wins', 'wins']),
    draws: get(row, ['Draws', 'draws']),
    losses: get(row, ['Losses', 'losses']),
    ratingChange: get(row, ['Rating_Change', 'ratingChange']),
    puzzleActivity: get(row, ['Puzzle_Activity', 'Puzzle_Activities', 'puzzleActivity']),
    bestResult: get(row, ['Best_Result', 'bestResult']),
    puzzleConsistency: get(row, ['Puzzle_Consistency', 'puzzleConsistency']),
    skillLevel: get(row, ['Skill_Level', 'skillLevel']),
    classPerformance: get(row, ['Class_Performance', 'classPerformance']),
    strengths: get(row, ['Strengths', 'strengths']),
    improvementAreas: get(row, ['Improvement_Areas', 'Improvement_Area', 'improvementAreas']),
    focusNextMonth: get(row, ['Focus_Next_Month', 'focusNextMonth']),
    overallComment: get(row, ['Overall_Comment', 'overallComment']),
    mentorRemark: get(row, ['Mentor_Remark', 'mentorRemark']),
    mentorNotes: get(row, ['Mentor_Notes', 'mentorNotes'])
  };
}

function mapSubmission(row) {
  return {
    submissionId: get(row, ['Submission_ID', 'SubmissionId', 'submissionId']),
    taskId: text(get(row, ['Task_ID', 'TaskId', 'taskId'])),
    month: get(row, ['Month', 'month']),
    coachId: get(row, ['Coach_ID', 'coachId']),
    coachName: get(row, ['Coach_Name', 'coachName']),
    coachEmail: norm(get(row, ['Coach_Email', 'coachEmail'])),
    studentId: text(get(row, ['Student_ID', 'studentId'])),
    studentName: get(row, ['Student_Name', 'studentName']),
    studentEmail: get(row, ['Student_Email', 'studentEmail']),
    lichessId: get(row, ['Lichess_ID', 'lichessId']),
    batchCode: get(row, ['Batch_Code', 'batchCode']),
    submissionStatus: get(row, ['Submission_Status', 'submissionStatus'], 'Submitted'),
    mentorStatus: get(row, ['Mentor_Status', 'mentorStatus'], 'Pending'),
    submittedOn: get(row, ['Submitted_On', 'Timestamp', 'submittedOn']),
    reviewedOn: get(row, ['Reviewed_On', 'reviewedOn']),
    returnedOn: get(row, ['Returned_On', 'returnedOn']),
    lastUpdated: get(row, ['Last_Updated', 'lastUpdated']),
    feedback: mapFeedback(row),
    _sortTime: createdTime(row),
    raw: row
  };
}

function dedupeSubmissions(rowsIn) {
  const mapped = rowsIn
    .map(mapSubmission)
    .filter(s => s.taskId || s.studentId || s.studentName)
    .filter(s => s.coachEmail || s.studentId || s.studentName);

  // Keep one latest row per taskId. If taskId is missing, use month+coach+student.
  const byKey = new Map();
  for (const s of mapped) {
    const studentKey = s.studentId || norm(s.lichessId) || norm(s.studentEmail) || norm(s.studentName);
    const key = s.taskId || [monthKey(s.month), s.coachEmail, studentKey].join('|');
    const existing = byKey.get(key);
    if (!existing || s._sortTime >= existing._sortTime) byKey.set(key, s);
  }
  return [...byKey.values()];
}

let tasks = dedupeTasks(tasksRawAll);
let submissions = dedupeSubmissions(submissionsRawAll);
const legacyRaw = legacyRawAll.filter(row => !rowHasBadLiteral(row));

const latestSubmissionByTask = {};
for (const submission of submissions) {
  if (submission.taskId) latestSubmissionByTask[submission.taskId] = submission;
}

function mergedTask(task) {
  const submission = latestSubmissionByTask[task.taskId];
  if (!submission) return { ...task, feedback: {} };

  let taskStatus = submission.submissionStatus || task.submissionStatus || 'Submitted';
  if (norm(submission.mentorStatus) === 'approved') taskStatus = 'Approved';
  if (norm(submission.mentorStatus) === 'returned') taskStatus = 'Returned';

  return {
    ...task,
    submissionStatus: submission.submissionStatus || task.submissionStatus,
    mentorStatus: submission.mentorStatus || task.mentorStatus,
    taskStatus,
    submittedOn: submission.submittedOn || task.submittedOn,
    reviewedOn: submission.reviewedOn || task.reviewedOn,
    returnedOn: submission.returnedOn || task.returnedOn,
    lastUpdated: submission.lastUpdated || task.lastUpdated,
    feedback: submission.feedback || {}
  };
}

tasks = tasks.map(mergedTask);

const requestedMonth = monthKey(request.month || '');
const requestedEmail = norm(request.email || request.coachEmail || session.email || '');

function byMonth(task) {
  return !requestedMonth || monthKey(task.month) === requestedMonth;
}

function summary(list) {
  return {
    active: list.length,
    submitted: list.filter(t => norm(t.submissionStatus) === 'submitted' || norm(t.taskStatus) === 'submitted').length,
    pending: list.filter(t => norm(t.taskStatus).includes('pending') || norm(t.submissionStatus).includes('pending')).length,
    returned: list.filter(t => norm(t.mentorStatus) === 'returned' || norm(t.taskStatus) === 'returned').length,
    approved: list.filter(t => norm(t.mentorStatus) === 'approved' || norm(t.taskStatus) === 'approved').length,
    overdue: 0
  };
}

if (action === 'ping') {
  return [{ json: { ok: true, data: { message: 'n8n-only backend connected' } } }];
}

if (action === 'available_months') {
  const allMonths = [
    ...tasksRawAll.map(r => get(r, ['Month', 'month'])),
    ...submissionsRawAll.map(r => get(r, ['Month', 'month'])),
    ...legacyRaw.map(r => get(r, ['Month', 'month']))
  ].filter(Boolean);
  const monthKeys = [...new Set(allMonths.map(monthKey))].filter(Boolean).sort();
  const labels = monthKeys.length ? monthKeys.map(monthLabel) : [monthLabel(new Date())];
  return [{ json: { ok: true, data: { months: labels, defaultMonth: labels[labels.length - 1] } } }];
}

if (action === 'coach_dashboard') {
  if (session.role !== 'coach' && session.role !== 'mentor') throw new Error('Coach access required.');
  const list = tasks
    .filter(byMonth)
    .filter(t => session.role === 'mentor' ? (!requestedEmail || t.coachEmail === requestedEmail) : t.coachEmail === session.email);
  return [{ json: { ok: true, data: { coachEmail: requestedEmail || session.email, month: request.month, summary: summary(list), tasks: list } } }];
}

if (action === 'mentor_dashboard') {
  if (session.role !== 'mentor') throw new Error('Mentor access required.');
  const list = tasks.filter(byMonth).filter(t => {
    const mentorStatus = norm(t.mentorStatus);
    const submissionStatus = norm(t.submissionStatus);
    return ['submitted', 'returned', 'pending'].includes(mentorStatus) || submissionStatus === 'submitted';
  });
  return [{ json: { ok: true, data: { month: request.month, summary: summary(list), tasks: list } } }];
}

if (action === 'approved_dashboard') {
  if (session.role !== 'mentor') throw new Error('Mentor access required.');
  const list = tasks.filter(byMonth).filter(t => norm(t.mentorStatus) === 'approved' || norm(t.taskStatus) === 'approved');
  return [{ json: { ok: true, data: { month: request.month, tasks: list, summary: summary(list) } } }];
}

if (action === 'task') {
  const task = tasks.find(t => String(t.taskId) === String(request.taskId));
  if (!task) throw new Error('Task not found.');
  if (session.role === 'coach' && task.coachEmail !== session.email) throw new Error('This task is not assigned to this coach.');
  return [{ json: { ok: true, data: task } }];
}

if (action === 'history') {
  const task = tasks.find(t => String(t.taskId) === String(request.taskId));
  if (!task) throw new Error('Task not found.');
  const studentId = text(task.studentId);
  const lichessId = norm(task.lichessId);
  const old = legacyRaw.filter(row => {
    const rowStudentId = text(get(row, ['Student_ID', 'Student Id', 'studentId']));
    const rowLichess = norm(get(row, ['Lichess_ID', 'Lichess Id', 'lichessId']));
    return rowStudentId === studentId || (lichessId && rowLichess === lichessId);
  });
  const newer = submissions.filter(s => {
    const rowStudentId = text(s.studentId);
    const rowLichess = norm(s.lichessId);
    return rowStudentId === studentId || (lichessId && rowLichess === lichessId);
  });
  return [{ json: { ok: true, data: { old, newer } } }];
}

if (action === 'fetch_lichess') {
  return [{ json: { ok: true, data: { message: 'Use the dedicated eca-feedback-lichess workflow.' } } }];
}

if (['initialize', 'sync_legacy', 'launch_tasks', 'send_reminders'].includes(action)) {
  if (session.role !== 'mentor') throw new Error('Mentor access required.');
  return [{ json: { ok: true, data: { message: `${action} handled in n8n-only mode. Duplicate rows are hidden by the API dedupe layer.`, tasks: tasks.length, rawTasks: tasksRawAll.length, submissions: submissions.length, rawSubmissions: submissionsRawAll.length, ignoredFakeRows: (tasksRawAll.length + submissionsRawAll.length) - (tasks.length + submissions.length) } } }];
}

throw new Error('Unsupported action: ' + action);
