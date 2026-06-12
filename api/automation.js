const { allowCors, fail, ok, readJsonBody } = require('../lib/http');
const { getDb } = require('../lib/mongo');
const {
  automationSecretMatches,
  cleanupLichessSnapshots,
  claimQueuedJobs,
  completeJob,
  failJob,
  generateMonthlyTasks,
  getParentDeliveryPayload,
  monthLabel,
  queueCoachLaunchEmails,
  queueCoachReminders,
  queueMentorReminders,
  queueParentDelivery,
  syncStudentsFromRows
} = require('../lib/automation');

function getAutomationSecret(req, body) {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return String(body.automationSecret || '').trim();
}

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed.');

  try {
    const body = await readJsonBody(req);
    const secret = getAutomationSecret(req, body);
    if (!automationSecretMatches(secret)) return fail(res, 403, 'Invalid automation secret.');

    const action = String(body.action || '').trim();
    const db = await getDb();

    if (action === 'sync_students') {
      return ok(res, await syncStudentsFromRows(db, body.students || body.rows || []));
    }
    if (action === 'generate_monthly_tasks') {
      const result = await generateMonthlyTasks(db, body.month);
      const emailQueue = await queueCoachLaunchEmails(db, body.month);
      return ok(res, { ...result, coachLaunchEmailsQueued: emailQueue.queued, coachRecipients: emailQueue.coaches });
    }
    if (action === 'queue_coach_reminders') {
      return ok(res, await queueCoachReminders(db, body.month));
    }
    if (action === 'queue_mentor_reminders') {
      return ok(res, await queueMentorReminders(db, body.month));
    }
    if (action === 'queue_parent_delivery') {
      return ok(res, await queueParentDelivery(db, body.month));
    }
    if (action === 'claim_jobs') {
      return ok(res, { jobs: await claimQueuedJobs(db, body.type, Number(body.limit || 20)) });
    }
    if (action === 'complete_job') {
      return ok(res, { job: await completeJob(db, body.jobId, body.result || {}) });
    }
    if (action === 'fail_job') {
      return ok(res, { job: await failJob(db, body.jobId, body.error || 'Unknown error') });
    }
    if (action === 'cleanup_lichess') {
      return ok(res, await cleanupLichessSnapshots(db, Number(body.keepLatest || 1)));
    }
    if (action === 'parent_delivery_payload') {
      return ok(res, await getParentDeliveryPayload(db, body.taskId));
    }
    if (action === 'automation_ping') {
      return ok(res, { message: 'Automation backend connected.', month: monthLabel(new Date()) });
    }

    return fail(res, 400, `Unsupported automation action: ${action}`);
  } catch (error) {
    return fail(res, 500, error.message || 'Automation API failed.');
  }
};
