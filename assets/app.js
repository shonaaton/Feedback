(() => {
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const state = {
    role: 'coach',
    email: '',
    name: '',
    month: '',
    sessionToken: '',
    currentTask: null,
    currentView: 'coach',
    cache: { coach: null, mentor: null, approved: null }
  };

  function isMentorLane(role = state.role) {
    return ['mentor', 'admin'].includes(String(role || '').toLowerCase());
  }

  const demoData = {
    months: ['Mar 2026', 'Apr 2026', 'May 2026'],
    coach: {
      coachName: 'Sayantan Chandra', coachEmail: 'sayantanchandra12@gmail.com', month: 'May 2026',
      summary: { active: 3, submitted: 1, pending: 2, returned: 0 },
      tasks: [
        { taskId: 'TASK-DEMO-1', month: 'May 2026', studentName: 'Sanvi Ghosh', studentId: 'ECA1077', coachName: 'Sayantan Chandra', coachEmail: 'sayantanchandra12@gmail.com', batchCode: '99936', lichessId: 'sanvi-ghosh', taskStatus: 'Pending', mentorStatus: 'Pending' },
        { taskId: 'TASK-DEMO-2', month: 'May 2026', studentName: 'Diya Yashika Janga', studentId: 'ECA1045', coachName: 'Sayantan Chandra', coachEmail: 'sayantanchandra12@gmail.com', batchCode: '99924', lichessId: 'MahaLakshmi30', taskStatus: 'Submitted', mentorStatus: 'Pending' }
      ]
    },
    mentor: {
      month: 'May 2026', summary: { pending: 2, approved: 4, returned: 1, overdue: 2 },
      tasks: [
        { taskId: 'TASK-DEMO-2', month: 'May 2026', studentName: 'Diya Yashika Janga', studentId: 'ECA1045', coachName: 'Sayantan Chandra', batchCode: '99924', lichessId: 'MahaLakshmi30', taskStatus: 'Submitted', mentorStatus: 'Pending' },
        { taskId: 'TASK-DEMO-3', month: 'May 2026', studentName: 'Riaan Mittal', studentId: 'ECA1171', coachName: 'Sayandeep Roy', batchCode: 'I1-100', lichessId: 'riaanmittal777', taskStatus: 'Returned', mentorStatus: 'Returned' }
      ]
    },
    approved: {
      month: 'May 2026', tasks: [
        { taskId: 'TASK-DEMO-4', month: 'Apr 2026', studentName: 'Shivanya Das', studentId: 'ECA1168', coachName: 'Sayantan Chandra', taskStatus: 'Approved', mentorStatus: 'Approved' }
      ]
    },
    task: {
      taskId: 'TASK-DEMO-1', month: 'May 2026', studentName: 'Sanvi Ghosh', studentId: 'ECA1077', coachName: 'Sayantan Chandra', coachEmail: 'sayantanchandra12@gmail.com', batchCode: '99936', lichessId: 'sanvi-ghosh', taskStatus: 'Pending', mentorStatus: 'Pending',
      feedback: {
        studentRating: 'Unrated', gamesPlayed: '35', wins: '18', draws: '0', losses: '17', ratingChange: '-25', puzzleActivity: '42 puzzles', bestResult: 'Win vs 1738',
        puzzleConsistency: 'Excellent — Daily practice', skillLevel: 'Good', classPerformance: 'Excellent', strengths: 'Strong tactical vision and good opening recall.', improvementAreas: 'Needs more independent thinking and faster calculation.', focusNextMonth: 'Daily Puzzle Racer and 2 classical practice games weekly.', overallComment: 'Sanvi is improving well and should now focus on confidence and independent decision-making.', mentorRemark: '', mentorNotes: ''
      }
    }
  };

  const fields = {
    studentName: $('student-name'), coachName: $('coach-name'), batchCode: $('batch-code'), lichessId: $('lichess-id'),
    studentRating: $('student-rating'), gamesPlayed: $('games-played'), wins: $('wins'), draws: $('draws'), losses: $('losses'), ratingChange: $('rating-change'), puzzleActivity: $('puzzle-activity'), bestResult: $('best-result'),
    puzzleConsistency: $('puzzle-consistency'), skillLevel: $('skill-level'), classPerformance: $('class-performance'), strengths: $('strengths'), improvementAreas: $('improvement-areas'), focusNextMonth: $('focus-next-month'), overallComment: $('overall-comment'), mentorRemark: $('mentor-remark'), mentorNotes: $('mentor-notes')
  };

  init();

  function init() {
    bindEvents();
    setBanner('Portal ready.');
    pingBackend();
    loadMonths();
  }

  function bindEvents() {
    $('login-role').addEventListener('change', () => { state.role = $('login-role').value; updateLoginUi(); });
    $('send-otp-btn').addEventListener('click', requestOtp);
    $('verify-otp-btn').addEventListener('click', verifyOtp);
    $('reset-btn').addEventListener('click', resetPortal);
    $('logout-btn').addEventListener('click', resetPortal);
    $('reload-btn').addEventListener('click', reloadCurrentView);
    $('load-coach-btn').addEventListener('click', loadCoachDashboard);
    $('load-mentor-btn').addEventListener('click', loadMentorDashboard);
    $('load-approved-btn').addEventListener('click', loadApprovedDashboard);
    $('workspace-month').addEventListener('change', () => { state.month = $('workspace-month').value; $('month-select').value = state.month; reloadCurrentView(); });
    $('month-select').addEventListener('change', () => { state.month = $('month-select').value; $('workspace-month').value = state.month; });
    $('coach-search').addEventListener('input', () => renderCoachDashboard(state.cache.coach || null));
    $('mentor-search').addEventListener('input', () => renderMentorDashboard(state.cache.mentor || null));
    $('approved-search').addEventListener('input', () => renderApprovedList((state.cache.approved && state.cache.approved.tasks) || []));
    $('drawer-close').addEventListener('click', closeDrawer);
    $('drawer-backdrop').addEventListener('click', closeDrawer);
    $('fetch-lichess-btn').addEventListener('click', fetchLichess);
    $('save-draft-btn').addEventListener('click', () => submitFeedback('draft'));
    $('submit-feedback-btn').addEventListener('click', () => submitFeedback('submit'));
    $('approve-btn').addEventListener('click', () => mentorUpdate('Approved'));
    $('return-btn').addEventListener('click', () => mentorUpdate('Returned'));
    document.addEventListener('click', handleGlobalClick);
    $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
    $$('.drawer-tab').forEach(btn => btn.addEventListener('click', () => switchDrawerTab(btn.dataset.drawerTab)));
    $$('[data-admin-action]').forEach(btn => btn.addEventListener('click', () => runAdminAction(btn.dataset.adminAction)));
  }

  function handleGlobalClick(event) {
    const openButton = event.target.closest('[data-open-task]');
    if (openButton) {
      event.preventDefault();
      const taskId = String(openButton.dataset.openTask || '').trim();
      if (taskId) openTask(taskId);
    }
  }

  async function pingBackend() {
    try {
      const data = await apiGet('ping', {});
      $('connection-label').textContent = 'Backend connected';
      $('connection-detail').textContent = data.message || 'n8n backend is live.';
      setBanner('Backend connected. Send OTP to start.', 'success');
    } catch (error) {
      $('connection-label').textContent = 'Backend not connected';
      $('connection-detail').textContent = error.message;
      setBanner(error.message, 'error');
    }
  }

  async function loadMonths() {
    try {
      const data = await apiGet('available_months', {});
      const months = data.months && data.months.length ? data.months : ['May 2026'];
      fillMonthSelect($('month-select'), months, data.defaultMonth || months[months.length - 1]);
      fillMonthSelect($('workspace-month'), months, data.defaultMonth || months[months.length - 1]);
      state.month = $('month-select').value;
    } catch (error) {
      const fallback = ['Mar 2026', 'Apr 2026', 'May 2026'];
      fillMonthSelect($('month-select'), fallback, fallback[fallback.length - 1]);
      fillMonthSelect($('workspace-month'), fallback, fallback[fallback.length - 1]);
      state.month = $('month-select').value;
    }
  }

  function fillMonthSelect(select, months, selected) {
    select.innerHTML = months.map(month => `<option value="${escapeHtml(month)}">${escapeHtml(month)}</option>`).join('');
    select.value = selected && months.includes(selected) ? selected : months[months.length - 1];
  }

  async function requestOtp() {
    state.role = $('login-role').value;
    state.email = $('login-email').value.trim();
    state.month = $('month-select').value;
    if (!state.email) return setBanner('Enter email first.', 'error');
    setButtonBusy($('send-otp-btn'), true, 'Sending…');
    try {
      await apiJson('/api/auth/request-otp', { email: state.email, role: state.role });
      $('otp-row').classList.add('show');
      $('session-pill').textContent = 'OTP sent';
      $('session-pill').className = 'status-pill warn';
      setBanner('OTP sent. Check the email inbox linked to this role.', 'success');
    } catch (error) {
      setBanner(error.message, 'error');
    } finally {
      setButtonBusy($('send-otp-btn'), false, 'Send OTP');
    }
  }

  async function verifyOtp() {
    const code = $('otp-code').value.replace(/\s+/g, '').trim();
    if (!code) return setBanner('Enter OTP code.', 'error');
    setButtonBusy($('verify-otp-btn'), true, 'Verifying…');
    try {
      const data = await apiJson('/api/auth/verify-otp', { email: state.email, role: state.role, code });
      state.sessionToken = data.sessionToken || data.token || '';
      state.role = data.role || state.role;
      state.name = data.name || '';
      if (!state.sessionToken) throw new Error('OTP verified but no sessionToken was returned by n8n. Check the auth workflow.');
      openWorkspace();
      setBanner('Login verified. Workspace opened.', 'success');
      await reloadCurrentView();
    } catch (error) {
      setBanner(error.message, 'error');
    } finally {
      setButtonBusy($('verify-otp-btn'), false, 'Verify & Open Workspace');
    }
  }

  function openWorkspace() {
    $('login-card').classList.add('hidden');
    $('workspace').classList.remove('hidden');
    $('profile-email').textContent = state.name || state.email;
    $('profile-email').title = state.email;
    $('profile-role').textContent = isMentorLane(state.role) ? 'Mentor / Admin' : capitalize(state.role);
    $('avatar').textContent = (state.email || 'E').slice(0, 1).toUpperCase();
    $('session-pill').textContent = 'Signed in';
    $('session-pill').className = 'status-pill good';
    $$('body .mentor-only').forEach(el => el.classList.toggle('hidden', !isMentorLane()));
    switchView(isMentorLane() ? 'mentor' : 'coach');
    if (isMentorLane()) {
      loadMentorDashboard();
      loadApprovedDashboard();
    } else {
      loadCoachDashboard();
    }
  }

  function resetPortal() {
    state.role = 'coach'; state.email = ''; state.name = ''; state.month = ''; state.sessionToken = ''; state.currentTask = null;
    state.cache = { coach: null, mentor: null, approved: null };
    $('login-role').value = 'coach'; $('login-email').value = ''; $('otp-code').value = ''; $('otp-row').classList.remove('show');
    $('login-card').classList.remove('hidden'); $('workspace').classList.add('hidden'); closeDrawer();
    $('session-pill').textContent = 'Signed out'; $('session-pill').className = 'status-pill neutral';
    loadMonths(); setBanner('Session reset.');
  }

  function updateLoginUi() {
    $('session-pill').textContent = `${capitalize($('login-role').value)} login`;
  }

  async function reloadCurrentView() {
    if (!state.email) return;
    if (state.currentView === 'coach') return loadCoachDashboard();
    if (state.currentView === 'mentor') return loadMentorDashboard();
    if (state.currentView === 'approved') return loadApprovedDashboard();
  }

  function switchView(view) {
    if (!isMentorLane() && view !== 'coach') view = 'coach';
    state.currentView = view;
    $$('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
    $$('.view').forEach(el => el.classList.add('hidden'));
    $(`view-${view}`).classList.remove('hidden');
    if (view === 'mentor' && !state.cache.mentor) loadMentorDashboard();
    if (view === 'approved' && !state.cache.approved) loadApprovedDashboard();
  }

  async function loadCoachDashboard() {
    setButtonBusy($('load-coach-btn'), true, 'Loading…');
    try {
      const data = await apiGet('coach_dashboard', sessionParams({ email: state.email, month: state.month }));
      state.cache.coach = data;
      state.month = data.month || state.month;
      syncMonthControls();
      renderStats($('coach-stats'), data.summary, [ ['active', 'Open'], ['submitted', 'Submitted'], ['pending', 'Pending'], ['returned', 'Returned'] ]);
      renderCoachDashboard(data);
      setBanner('Coach tasks loaded.', 'success');
    } catch (error) {
      renderCoachDashboard({ tasks: [], submittedTasks: [] });
      setBanner(error.message, 'error');
    } finally {
      setButtonBusy($('load-coach-btn'), false, 'Load My Students');
    }
  }

  async function loadMentorDashboard() {
    if (!isMentorLane()) return;
    setButtonBusy($('load-mentor-btn'), true, 'Loading…');
    try {
      const data = await apiGet('mentor_dashboard', sessionParams({ email: state.email, month: state.month }));
      state.cache.mentor = data;
      state.month = data.month || state.month;
      syncMonthControls();
      renderStats($('mentor-stats'), data.summary, [ ['pending', 'Needs review'], ['approved', 'Approved'], ['returned', 'Returned'], ['overdue', 'Overdue'] ]);
      renderMentorDashboard(data);
      setBanner('Mentor queue loaded.', 'success');
    } catch (error) {
      renderMentorDashboard({ tasks: [], completedTasks: [] });
      setBanner(error.message, 'error');
    } finally {
      setButtonBusy($('load-mentor-btn'), false, 'Load Queue');
    }
  }

  async function loadApprovedDashboard() {
    if (!isMentorLane()) return;
    setButtonBusy($('load-approved-btn'), true, 'Loading…');
    try {
      const data = await apiGet('approved_dashboard', sessionParams({ email: state.email, month: state.month }));
      state.cache.approved = data;
      renderApprovedList(data.tasks || []);
      setBanner('Approved reports loaded.', 'success');
    } catch (error) {
      renderApprovedList([]);
      setBanner(error.message, 'error');
    } finally {
      setButtonBusy($('load-approved-btn'), false, 'Load Approved');
    }
  }

  function renderStats(container, summary = {}, defs) {
    container.innerHTML = defs.map(([key, label]) => `<div class="stat-card"><strong>${Number(summary[key] || 0)}</strong><span>${escapeHtml(label)}</span></div>`).join('');
  }

  function renderCoachDashboard(data) {
    const needle = $('coach-search').value.trim().toLowerCase();
    const openTasks = filterTasks((data && data.tasks) || [], needle);
    const submittedTasks = filterTasks((data && data.submittedTasks) || [], needle);
    const activeStudents = uniqueStudents([...(data && data.tasks || []), ...(data && data.submittedTasks || [])], needle);
    $('coach-list').innerHTML = [
      sectionHeader('Active students this month', activeStudents.length, 'Quick roster check for the logged-in coach.'),
      activeStudents.length ? studentRosterGrid(activeStudents) : emptyState('No active students found for this coach and month.'),
      sectionHeader('Open tasks', openTasks.length, 'These are the only tasks the coach still needs to complete.'),
      openTasks.length ? openTasks.map(taskCard).join('') : emptyState('No open tasks for this coach and month.'),
      sectionHeader('Already submitted', submittedTasks.length, 'Completed feedback stays visible but separate.'),
      submittedTasks.length ? submittedTasks.map(taskCard).join('') : emptyState('No submitted tasks yet.')
    ].join('');
  }

  function renderMentorDashboard(data) {
    const needle = $('mentor-search').value.trim().toLowerCase();
    const reviewQueue = filterTasks((data && data.tasks) || [], needle);
    const completed = filterTasks((data && data.completedTasks) || [], needle);
    $('mentor-list').innerHTML = [
      sectionHeader('Review queue', reviewQueue.length, 'Submitted and returned items that still need attention.'),
      reviewQueue.length ? reviewQueue.map(taskCard).join('') : emptyState('No review items found for this month.'),
      sectionHeader('Approved', completed.length, 'These are finished and can be checked without mixing them into the queue.'),
      completed.length ? completed.map(taskCard).join('') : emptyState('No approved records for this month.')
    ].join('');
  }

  function renderApprovedList(tasks) {
    const needle = $('approved-search').value.trim().toLowerCase();
    const filtered = filterTasks(tasks, needle);
    $('approved-list').innerHTML = filtered.length ? filtered.map(taskCard).join('') : emptyState('No approved records found for this month. Run legacy import if old approvals are missing.');
  }

  function filterTasks(tasks, needle) {
    if (!needle) return tasks;
    return tasks.filter(t => [t.studentName, t.studentId, t.coachName, t.batchCode, t.lichessId, t.taskStatus, t.mentorStatus, t.month].join(' ').toLowerCase().includes(needle));
  }

  function uniqueStudents(tasks, needle) {
    const map = new Map();
    tasks.forEach((task) => {
      const key = String(task.studentId || task.studentName || task.taskId || '').trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          studentId: task.studentId || '',
          studentName: task.studentName || 'Unnamed Student',
          batchCode: task.batchCode || '-',
          lichessId: task.lichessId || '',
          coachName: task.coachName || ''
        });
      }
    });
    const students = Array.from(map.values());
    if (!needle) return students;
    return students.filter((student) => [student.studentName, student.studentId, student.batchCode, student.lichessId, student.coachName].join(' ').toLowerCase().includes(needle));
  }

  function studentRosterGrid(students) {
    return `<div class="roster-grid">${students.map(studentRosterCard).join('')}</div>`;
  }

  function studentRosterCard(student) {
    return `<article class="roster-card">
      <h3>${escapeHtml(student.studentName)}</h3>
      <div class="task-meta">
        <span>${escapeHtml(student.studentId || '')}</span>
        <span>Batch ${escapeHtml(student.batchCode || '-')}</span>
        ${student.lichessId ? `<span>${escapeHtml(student.lichessId)}</span>` : ''}
      </div>
    </article>`;
  }

  function sectionHeader(title, count, subtitle) {
    return `<div class="list-section">
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(subtitle)}</p>
      </div>
      <span class="status-pill neutral">${escapeHtml(String(count))}</span>
    </div>`;
  }

  function taskCard(task) {
    const status = task.mentorStatus || task.taskStatus || 'Pending';
    return `<article class="task-card">
      <div>
        <h3 class="task-title">${escapeHtml(task.studentName || 'Unnamed Student')}</h3>
        <div class="task-meta">
          <span>${escapeHtml(task.studentId || '')}</span>
          <span>Coach: ${escapeHtml(task.coachName || '')}</span>
          <span>Batch ${escapeHtml(task.batchCode || '-')}</span>
          <span>${escapeHtml(task.lichessId || 'No Lichess')}</span>
          <span>${escapeHtml(formatMonth(task.month || state.month))}</span>
          ${task.submissionStatus ? `<span>${escapeHtml(task.submissionStatus)}</span>` : ''}
        </div>
      </div>
      <div class="action-row">
        <span class="badge ${badgeClass(status)}">${escapeHtml(status)}</span>
        <button class="btn ghost small" data-open-task="${escapeHtml(task.taskId)}">Open</button>
      </div>
    </article>`;
  }

  async function openTask(taskId) {
    try {
      const task = await apiGet('task', sessionParams({ email: state.email, role: state.role, taskId }));
      state.currentTask = task;
      renderTask(task);
      $('task-drawer').classList.remove('hidden');
      setBanner('Task opened.', 'success');
      loadHistory(taskId);
    } catch (error) {
      setBanner(error.message, 'error');
    }
  }

  async function loadHistory(taskId) {
    const container = $('history-list');
    container.innerHTML = emptyState('Loading history…');
    try {
      if (state.demo) {
        container.innerHTML = historyCards({
          legacyRows: [{ month: 'Mar 2026', mentorStatus: 'Approved', opening: '4', middlegame: '4', endgame: '3', tactics: '4', attendance: '90-100% (Excellent)', homeworkPractice: 'Excellent — Daily practice', coachComment: 'Good opening preparation and tactical awareness.', coachPrivateNotes: 'Needs independent play.' }],
          portalRecords: [{ month: 'May 2026', mentorStatus: 'Pending', overallComment: 'New version comment appears here.', strengths: 'Tactical vision', improvementAreas: 'Calculation speed' }]
        });
        return;
      }
      const data = await apiGet('history', sessionParams({ email: state.email, role: state.role, taskId }));
      container.innerHTML = historyCards(data);
    } catch (error) {
      container.innerHTML = emptyState('History data is unavailable. Check the n8n read workflow and the old feedback sheet tab name.');
    }
  }

  function historyCards(data = {}) {
    const legacyRows = data.legacyRows || [];
    const portalRecords = data.portalRecords || [];
    const blocks = [];
    if (portalRecords.length) {
      blocks.push(`<h4>New portal records</h4>` + portalRecords.map(row => historyCard('New Feedback', row, ['month','mentorStatus','submissionStatus','studentRating','gamesPlayed','bestResult','strengths','improvementAreas','focusNextMonth','overallComment','mentorRemark','mentorNotes'])).join(''));
    }
    if (legacyRows.length) {
      blocks.push(`<h4>Previous feedback records</h4>` + legacyRows.map(row => historyCard('History Record', row, ['month','mentorStatus','studentRating','gamesPlayed','wins','draws','losses','resultWdl','ratingChange','bestResult','puzzleConsistency','skillLevel','classPerformance','strengths','improvementAreas','focusNextMonth','overallComment','mentorRemark','mentorNotes','coachComment','coachPrivateNotes','opening','middlegame','endgame','tactics','thinkingTimeMgmt','attendance','homeworkPractice'])).join(''));
    }
    return blocks.length ? blocks.join('') : emptyState('No old or new history found for this student.');
  }

  function historyCard(title, row, keys) {
    const source = row.feedback && typeof row.feedback === 'object' ? { ...row, ...row.feedback } : row;
    const cells = keys.filter(k => source[k] !== undefined && source[k] !== '').map(k => `<div class="history-cell"><strong>${escapeHtml(labelize(k))}</strong>${escapeHtml(String(source[k]))}</div>`).join('');
    return `<article class="history-card"><h4>${escapeHtml(title)} · ${escapeHtml(formatMonth(row.month || ''))}</h4><div class="history-grid">${cells || '<div class="muted">No details.</div>'}</div></article>`;
  }

  function renderTask(task) {
    $('drawer-context').textContent = `${capitalize(state.role)} task`;
    $('drawer-title').textContent = task.studentName || 'Feedback task';
    $('drawer-subtitle').textContent = `${task.studentId || ''} · ${task.coachName || ''} · ${formatMonth(task.month || state.month)}`;
    $('task-summary-strip').innerHTML = [
      ['Task', task.taskStatus || 'Open'], ['Mentor', task.mentorStatus || 'Pending'], ['Batch', task.batchCode || '-'], ['Lichess', task.lichessId || '-']
    ].map(([label, value]) => `<span class="badge ${badgeClass(value)}">${escapeHtml(label)}: ${escapeHtml(value)}</span>`).join('');

    const feedback = task.feedback || {};
    setValue(fields.studentName, task.studentName); setValue(fields.coachName, task.coachName); setValue(fields.batchCode, task.batchCode); setValue(fields.lichessId, task.lichessId);
    Object.keys(fields).forEach(key => {
      if (['studentName','coachName','batchCode','lichessId'].includes(key)) return;
      setValue(fields[key], feedback[key]);
    });

    const isMentor = isMentorLane();
    const isLegacy = !!task.legacy;
    $$('.mentor-tools').forEach(el => el.classList.toggle('hidden', !isMentor));
    $('save-draft-btn').classList.toggle('hidden', isMentor || isLegacy);
    $('submit-feedback-btn').classList.toggle('hidden', isMentor || isLegacy);
    $('fetch-lichess-btn').classList.toggle('hidden', isLegacy);
    $('approve-btn').classList.toggle('hidden', !isMentor || isLegacy);
    $('return-btn').classList.toggle('hidden', !isMentor || isLegacy);
    switchDrawerTab('form');
  }

  function switchDrawerTab(tab) {
    $$('.drawer-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.drawerTab === tab));
    $('drawer-form').classList.toggle('hidden', tab !== 'form');
    $('drawer-history').classList.toggle('hidden', tab !== 'history');
  }

  function closeDrawer() { $('task-drawer').classList.add('hidden'); }

  async function fetchLichess() {
    if (!state.currentTask) return setBanner('Open a task first.', 'error');
    setButtonBusy($('fetch-lichess-btn'), true, 'Fetching…');
    try {
      const data = await apiJson('/api/lichess', sessionParams({
        email: state.email,
        role: state.role,
        taskId: state.currentTask.taskId,
        month: state.month,
        lichessId: value(fields.lichessId) || state.currentTask.lichessId || ''
      }));
      ['studentRating','gamesPlayed','wins','draws','losses','ratingChange','puzzleActivity','bestResult'].forEach(k => setValue(fields[k], data[k]));
      state.currentTask.feedback = { ...(state.currentTask.feedback || {}), ...data };
      setBanner(data.message || 'Lichess snapshot fetched and added to this feedback form.', 'success');
    } catch (error) {
      setBanner(error.message, 'error');
    } finally {
      setButtonBusy($('fetch-lichess-btn'), false, 'Fetch Lichess');
    }
  }

  async function submitFeedback(mode) {
    if (!state.currentTask) return setBanner('Open a task first.', 'error');
    const payload = collectPayload(mode);
    const button = mode === 'draft' ? $('save-draft-btn') : $('submit-feedback-btn');
    setButtonBusy(button, true, mode === 'draft' ? 'Saving…' : 'Submitting…');
    try {
      const data = await apiPost('submit_feedback', { payload: JSON.stringify(payload) });
      state.currentTask = data.task || state.currentTask;
      renderTask(state.currentTask);
      setBanner(mode === 'draft' ? 'Draft saved.' : 'Feedback submitted to mentor.', 'success');
      loadCoachDashboard();
    } catch (error) {
      setBanner(error.message, 'error');
    } finally {
      setButtonBusy(button, false, mode === 'draft' ? 'Save Draft' : 'Submit to Mentor');
    }
  }

  async function mentorUpdate(status) {
    if (!state.currentTask) return setBanner('Open a task first.', 'error');
    const button = status === 'Approved' ? $('approve-btn') : $('return-btn');
    const payload = collectPayload('mentor');
    payload.mentorStatus = status;
    setButtonBusy(button, true, status === 'Approved' ? 'Approving…' : 'Returning…');
    try {
      const data = await apiPost('mentor_update', { payload: JSON.stringify(payload) });
      state.currentTask = data.task || state.currentTask;
      renderTask(state.currentTask);
      setBanner(status === 'Approved' ? 'Approved and parent delivery triggered.' : 'Returned to coach.', 'success');
      loadMentorDashboard();
    } catch (error) {
      setBanner(error.message, 'error');
    } finally {
      setButtonBusy(button, false, status === 'Approved' ? 'Approve & Send' : 'Return to Coach');
    }
  }

  function collectPayload(mode) {
    return {
      email: state.email,
      role: state.role,
      taskId: state.currentTask.taskId,
      mode,
      sessionToken: state.sessionToken,
      feedback: collectFeedback()
    };
  }

  function collectFeedback() {
    return {
      studentRating: value(fields.studentRating), gamesPlayed: value(fields.gamesPlayed), wins: value(fields.wins), draws: value(fields.draws), losses: value(fields.losses), ratingChange: value(fields.ratingChange), puzzleActivity: value(fields.puzzleActivity), bestResult: value(fields.bestResult),
      puzzleConsistency: value(fields.puzzleConsistency), skillLevel: value(fields.skillLevel), classPerformance: value(fields.classPerformance), strengths: value(fields.strengths), improvementAreas: value(fields.improvementAreas), focusNextMonth: value(fields.focusNextMonth), overallComment: value(fields.overallComment), mentorRemark: value(fields.mentorRemark), mentorNotes: value(fields.mentorNotes)
    };
  }

  async function runAdminAction(action) {
    if (!isMentorLane()) return setBanner('Only mentors/admins can run this.', 'error');
    const log = $('admin-log');
    log.textContent = `Running ${action}…`;
    try {
      const payload = { email: state.email, month: state.month, sessionToken: state.sessionToken };
      const data = await apiPost(action, payload);
      log.textContent = JSON.stringify(data, null, 2);
      setBanner(`${labelize(action)} complete.`, 'success');
      if (['launch_tasks', 'send_reminders', 'queue_parent_delivery', 'cleanup_lichess'].includes(action)) await reloadCurrentView();
    } catch (error) {
      log.textContent = error.stack || error.message;
      setBanner(error.message, 'error');
    }
  }

  function sessionParams(params) { return { ...params, sessionToken: state.sessionToken }; }
  function syncMonthControls() { if (state.month) { $('month-select').value = state.month; $('workspace-month').value = state.month; } }

  async function apiGet(action, params = {}) {
    return apiJson('/api/portal', { action, ...params });
  }

  async function apiPost(action, params = {}) {
    return apiJson('/api/portal', { action, ...params });
  }

  async function apiJson(path, params = {}) {
    const res = await fetch(new URL(path, window.location.origin).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {})
    });
    return parseApiResponse(res);
  }

  async function parseApiResponse(res) {
    const contentType = res.headers.get('content-type') || '';
    const rawText = await res.text();
    if (!rawText.trim()) {
      throw new Error('Backend returned an empty response. Please check the n8n webhook and Respond to Webhook node.');
    }
    let data;
    if (contentType.includes('json')) {
      try {
        data = JSON.parse(rawText);
      } catch (error) {
        throw new Error(`Backend returned invalid JSON. ${rawText.slice(0, 180)}`);
      }
    } else {
      try {
        data = JSON.parse(rawText);
      } catch (error) {
        data = { ok: false, message: rawText };
      }
    }
    if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
    if (data && data.ok === false) throw new Error(data.message || 'Backend returned an error.');
    return data.data || data;
  }

  function setButtonBusy(button, busy, text) { if (!button) return; button.disabled = !!busy; if (text) button.textContent = text; }
  function setBanner(message, type) { const el = $('banner'); el.textContent = message; el.className = `notice ${type || ''}`.trim(); }
  function emptyState(message) { return `<div class="empty-state">${escapeHtml(message)}</div>`; }
  function value(el) { return el ? String(el.value || '').trim() : ''; }
  function setValue(el, val) { if (el) el.value = val == null ? '' : String(val); }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
  function capitalize(value) { return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1); }
  function formatMonth(value) {
    if (!value) return '';
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    return value;
  }
  function badgeClass(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('approved')) return 'approved';
    if (s.includes('returned')) return 'returned';
    if (s.includes('submitted')) return 'submitted';
    if (s.includes('draft')) return 'draft';
    if (s.includes('pending')) return 'pending';
    return 'neutral';
  }
  function labelize(key) { return String(key || '').replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, m => m.toUpperCase()); }
})();
