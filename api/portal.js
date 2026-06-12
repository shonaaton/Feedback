const { requireSession } = require('../lib/auth');
const { allowCors, fail, ok, readJsonBody } = require('../lib/http');
const { getDb } = require('../lib/mongo');
const {
  getApprovedDashboard,
  getAvailableMonths,
  getCoachDashboard,
  getMentorDashboard,
  getTaskById,
  getTaskHistory,
  mentorUpdate,
  queueNotification,
  submitFeedback
} = require('../lib/portal-data');
const {
  cleanupLichessSnapshots,
  queueCoachLaunchEmails,
  queueCoachReminders,
  queueMentorReminders,
  queueParentDelivery
} = require('../lib/automation');
const { generateMonthlyTasks } = require('../lib/task-generator');

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed.');
  try {
    const body = await readJsonBody(req);
    const payload = typeof body.payload === 'string' ? JSON.parse(body.payload) : body.payload || {};
    const action = String(body.action || payload.action || 'ping').trim();
    const db = await getDb();

    if (action === 'ping') return ok(res, { message: 'MongoDB backend connected.' });
    if (action === 'available_months') return ok(res, await getAvailableMonths(db));

    const session = await requireSession(db, body.sessionToken || payload.sessionToken);
    const month = body.month || payload.month;

    if (action === 'coach_dashboard') {
      return ok(res, await getCoachDashboard(db, { month, coachEmail: session.email }));
    }
    if (action === 'mentor_dashboard') {
      if (!['mentor', 'admin'].includes(session.role)) return fail(res, 403, 'Mentor access required.');
      return ok(res, await getMentorDashboard(db, { month, mentorEmail: session.email }));
    }
    if (action === 'approved_dashboard') {
      if (!['mentor', 'admin'].includes(session.role)) return fail(res, 403, 'Mentor access required.');
      return ok(res, await getApprovedDashboard(db, { month, mentorEmail: session.email }));
    }
    if (action === 'task') {
      const task = await getTaskById(db, body.taskId || payload.taskId);
      if (!task) return fail(res, 404, 'Task not found.');
      if (session.role === 'coach' && task.coachEmail !== session.email) return fail(res, 403, 'This task is not assigned to this coach.');
      return ok(res, task);
    }
    if (action === 'history') {
      const task = await getTaskById(db, body.taskId || payload.taskId);
      if (!task) return fail(res, 404, 'Task not found.');
      return ok(res, await getTaskHistory(db, task));
    }
    if (action === 'submit_feedback') {
      const task = await getTaskById(db, payload.taskId);
      if (!task) return fail(res, 404, 'Task not found.');
      if (session.role !== 'coach' || task.coachEmail !== session.email) return fail(res, 403, 'Only the assigned coach can submit this feedback.');
      const updatedTask = await submitFeedback(db, task, payload, session);
      await queueNotification(db, 'mentor-review-needed', { taskId: task.taskId, mentorEmail: task.mentorEmail, month: task.month });
      return ok(res, { task: updatedTask, message: 'Feedback submitted to mentor.' });
    }
    if (action === 'mentor_update') {
      if (!['mentor', 'admin'].includes(session.role)) return fail(res, 403, 'Mentor access required.');
      const task = await getTaskById(db, payload.taskId);
      if (!task) return fail(res, 404, 'Task not found.');
      const updatedTask = await mentorUpdate(db, task, payload, session);
      if (String(payload.mentorStatus || '') === 'Approved') {
        await queueNotification(db, 'parent-feedback-approved', { taskId: task.taskId, parentEmail: task.parentEmail, studentName: task.studentName, month: task.month });
      }
      return ok(res, { task: updatedTask, message: payload.mentorStatus === 'Approved' ? 'Approved and queued for parent delivery.' : 'Returned to coach.' });
    }
    if (action === 'launch_tasks') {
      if (!['mentor', 'admin'].includes(session.role)) return fail(res, 403, 'Mentor access required.');
      const generated = await generateMonthlyTasks(db, month);
      const coachLaunch = await queueCoachLaunchEmails(db, month);
      return ok(res, {
        message: 'Monthly tasks generated and coach launch emails queued.',
        generated,
        coachLaunch
      });
    }
    if (action === 'send_reminders') {
      if (!['mentor', 'admin'].includes(session.role)) return fail(res, 403, 'Mentor access required.');
      const coach = await queueCoachReminders(db, month);
      const mentor = await queueMentorReminders(db, month);
      return ok(res, {
        message: 'Coach and mentor reminder emails queued.',
        coach,
        mentor
      });
    }
    if (action === 'queue_parent_delivery') {
      if (!['mentor', 'admin'].includes(session.role)) return fail(res, 403, 'Mentor access required.');
      const parentDelivery = await queueParentDelivery(db, month);
      return ok(res, {
        message: 'Parent delivery jobs queued.',
        parentDelivery
      });
    }
    if (action === 'cleanup_lichess') {
      if (!['mentor', 'admin'].includes(session.role)) return fail(res, 403, 'Mentor access required.');
      const cleanup = await cleanupLichessSnapshots(db, 1);
      return ok(res, {
        message: 'Lichess snapshot cleanup complete.',
        cleanup
      });
    }
    if (['initialize', 'sync_legacy', 'install_triggers'].includes(action)) {
      if (!['mentor', 'admin'].includes(session.role)) return fail(res, 403, 'Mentor access required.');
      await queueNotification(db, `admin-${action}`, { actorEmail: session.email, month });
      return ok(res, { message: `${action} queued for legacy support processing.` });
    }

    return fail(res, 400, `Unsupported action: ${action}`);
  } catch (error) {
    return fail(res, 500, error.message || 'Portal API failed.');
  }
};
