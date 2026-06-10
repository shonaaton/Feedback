(function () {
  var config = window.FEEDBACK_PORTAL_CONFIG || {};
  var demoMode = !config.apiBaseUrl;

  var state = {
    role: "coach",
    email: "",
    month: "",
    coachDashboard: null,
    mentorDashboard: null,
    currentTask: null,
    currentTaskId: "",
    editorRole: "coach"
  };

  var demoStore = {
    coach: {
      coachName: "Test Coach",
      coachEmail: "sayatanchandra2@gmail.com",
      month: "June 2026",
      summary: { active: 24, submitted: 14, pending: 8, returned: 2 },
      tasks: [
        {
          taskId: "TASK-001",
          studentName: "Test Student",
          studentId: "ECA1077",
          studentEmail: "sayantanchandra12@gmail.com",
          coachName: "Test Coach",
          coachId: "COA-005",
          batchCode: "PIC-99936",
          month: "June 2026",
          lichessId: "sanvi-ghosh",
          taskStatus: "Pending",
          mentorStatus: "Pending",
          submissionStatus: "Not Submitted"
        },
        {
          taskId: "TASK-002",
          studentName: "Test Student",
          studentId: "ECA1007",
          studentEmail: "sayantanchandra12@gmail.com",
          coachName: "Test Coach",
          coachId: "COA-005",
          batchCode: "PIC-99903",
          month: "June 2026",
          lichessId: "Debanjan1708",
          taskStatus: "Returned",
          mentorStatus: "Returned",
          submissionStatus: "Returned"
        }
      ]
    },
    mentor: {
      mentorName: "Test Mentor",
      month: "June 2026",
      summary: { pending: 12, approved: 18, returned: 3, overdue: 4 },
      tasks: [
        {
          taskId: "TASK-001",
          studentName: "Test Student",
          studentId: "ECA1077",
          coachName: "Test Coach",
          coachEmail: "sayatanchandra2@gmail.com",
          batchCode: "PIC-99936",
          month: "June 2026",
          mentorStatus: "Pending",
          taskStatus: "Submitted",
          submissionStatus: "Submitted"
        }
      ]
    },
    submissions: {
      "TASK-001": {
        taskId: "TASK-001",
        studentName: "Test Student",
        studentId: "ECA1077",
        studentEmail: "sayantanchandra12@gmail.com",
        coachName: "Test Coach",
        coachId: "COA-005",
        coachEmail: "sayatanchandra2@gmail.com",
        batchCode: "PIC-99936",
        month: "June 2026",
        lichessId: "sanvi-ghosh",
        taskStatus: "Pending",
        mentorStatus: "Pending",
        submissionStatus: "Not Submitted",
        feedback: {
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
        }
      },
      "TASK-002": {
        taskId: "TASK-002",
        studentName: "Test Student",
        studentId: "ECA1007",
        studentEmail: "sayantanchandra12@gmail.com",
        coachName: "Test Coach",
        coachId: "COA-005",
        coachEmail: "sayatanchandra2@gmail.com",
        batchCode: "PIC-99903",
        month: "June 2026",
        lichessId: "Debanjan1708",
        taskStatus: "Returned",
        mentorStatus: "Returned",
        submissionStatus: "Returned",
        feedback: {
          studentRating: "Unrated",
          gamesPlayed: "18",
          wins: "7",
          draws: "1",
          losses: "10",
          ratingChange: "-11",
          puzzleActivity: "18 puzzles",
          bestResult: "Win vs 1610 rated opponent",
          puzzleConsistency: "Average",
          skillLevel: "Good",
          classPerformance: "Average",
          strengths: "Can recognize tactical chances when focused.",
          improvementAreas: "Needs stronger opening recall and steadier calculation.",
          focusNextMonth: "Play slow practice games and solve 10 puzzles daily.",
          overallComment: "Debanjan has clear potential and should improve quickly with more regular practice.",
          mentorRemark: "Please review parent communication tone.",
          mentorNotes: "Return once coach expands improvement detail."
        }
      }
    }
  };

  var elements = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    bindEvents();
    updateModeUi();
    loadAvailableMonths();
    renderCoachDashboard(null);
    renderMentorDashboard(null);
    renderTask(null);
    setBanner(
      demoMode
        ? "Demo mode is active. Add your deployed Apps Script web app URL in config.js for live Sheets and Lichess data."
        : "Live backend connected. Sign in with a coach or mentor email to load data."
    );
  }

  function cacheElements() {
    elements.modeBadge = byId("mode-badge");
    elements.statusBanner = byId("status-banner");
    elements.loginForm = byId("login-form");
    elements.emailInput = byId("email-input");
    elements.monthInput = byId("month-input");
    elements.dashboardTitle = byId("dashboard-title");
    elements.coachSummaryBadge = byId("coach-summary-badge");
    elements.coachTaskList = byId("coach-task-list");
    elements.summaryActive = byId("summary-active");
    elements.summarySubmitted = byId("summary-submitted");
    elements.summaryPending = byId("summary-pending");
    elements.summaryReturned = byId("summary-returned");
    elements.mentorTitle = byId("mentor-title");
    elements.mentorSummaryBadge = byId("mentor-summary-badge");
    elements.mentorTaskList = byId("mentor-task-list");
    elements.mentorPending = byId("mentor-pending");
    elements.mentorApproved = byId("mentor-approved");
    elements.mentorReturned = byId("mentor-returned");
    elements.mentorOverdue = byId("mentor-overdue");
    elements.formTitle = byId("form-title");
    elements.currentTaskBadge = byId("current-task-badge");
    elements.refreshTaskButton = byId("refresh-task-button");
    elements.fetchLichessButton = byId("fetch-lichess-button");
    elements.feedbackForm = byId("feedback-form");
    elements.editorModeNote = byId("editor-mode-note");
    elements.saveDraftButton = byId("save-draft-button");
    elements.submitFeedbackButton = byId("submit-feedback-button");
    elements.approveButton = byId("approve-button");
    elements.returnButton = byId("return-button");
    elements.demoFillButton = byId("demo-fill-button");
    elements.mentorLaunchButton = byId("mentor-launch-button");
  }

  function bindEvents() {
    document.querySelectorAll("[data-role-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.role = button.getAttribute("data-role-tab");
        updateModeUi();
      });
    });

    elements.loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      handleLogin();
    });

    byId("reset-session-button").addEventListener("click", resetSession);
    byId("refresh-dashboard-button").addEventListener("click", function () {
      if (state.email) {
        loadCoachDashboard();
      }
    });
    byId("refresh-mentor-button").addEventListener("click", function () {
      if (state.email) {
        loadMentorDashboard();
      }
    });
    elements.refreshTaskButton.addEventListener("click", function () {
      if (state.currentTaskId) {
        loadTask(state.currentTaskId);
      }
    });
    elements.fetchLichessButton.addEventListener("click", fetchLichessSnapshot);
    elements.feedbackForm.addEventListener("submit", function (event) {
      event.preventDefault();
      submitFeedback("submit");
    });
    elements.saveDraftButton.addEventListener("click", function () {
      submitFeedback("draft");
    });
    elements.approveButton.addEventListener("click", function () {
      mentorUpdate("Approved");
    });
    elements.returnButton.addEventListener("click", function () {
      mentorUpdate("Returned");
    });
    elements.demoFillButton.addEventListener("click", loadDemoExperience);
    elements.mentorLaunchButton.addEventListener("click", function () {
      runAutomation("launch_tasks");
    });

    document.querySelectorAll(".automation-action").forEach(function (button) {
      button.addEventListener("click", function () {
        runAutomation(button.getAttribute("data-action"));
      });
    });
  }

  function updateModeUi() {
    document.querySelectorAll("[data-role-tab]").forEach(function (button) {
      button.classList.toggle("is-active", button.getAttribute("data-role-tab") === state.role);
    });
    elements.modeBadge.textContent = capitalize(state.role);
    elements.editorModeNote.textContent = state.role === "mentor" ? "Mentor mode" : "Coach mode";
    document.body.classList.toggle("is-mentor", state.role === "mentor");
  }

  function handleLogin() {
    state.email = elements.emailInput.value.trim();
    state.month = elements.monthInput.value.trim();

    if (!state.email) {
      setBanner("Please enter an email address before loading the portal.", true);
      return;
    }

    if (state.role === "coach") {
      loadCoachDashboard();
    } else {
      loadMentorDashboard();
    }
  }

  function loadCoachDashboard() {
    if (demoMode) {
      state.coachDashboard = clone(demoStore.coach);
      ensureSelectedMonth(state.month || state.coachDashboard.month);
      state.month = elements.monthInput.value;
      renderCoachDashboard(state.coachDashboard);
      setBanner("Coach dashboard loaded in demo mode.");
      return;
    }

    apiGet("coach_dashboard", { email: state.email, month: state.month }).then(function (data) {
      state.coachDashboard = data;
      state.month = data.month || state.month;
      renderCoachDashboard(data);
      setBanner("Coach dashboard loaded.");
    }).catch(handleError);
  }

  function loadMentorDashboard() {
    if (demoMode) {
      state.mentorDashboard = clone(demoStore.mentor);
      ensureSelectedMonth(state.month || state.mentorDashboard.month);
      state.month = elements.monthInput.value;
      renderMentorDashboard(state.mentorDashboard);
      setBanner("Mentor dashboard loaded in demo mode.");
      return;
    }

    apiGet("mentor_dashboard", { email: state.email, month: state.month }).then(function (data) {
      state.mentorDashboard = data;
      state.month = data.month || state.month;
      renderMentorDashboard(data);
      setBanner("Mentor dashboard loaded.");
    }).catch(handleError);
  }

  function loadTask(taskId) {
    state.currentTaskId = taskId;
    state.editorRole = state.role;

    if (demoMode) {
      state.currentTask = clone(demoStore.submissions[taskId] || null);
      renderTask(state.currentTask);
      setBanner("Task opened in demo mode.");
      return;
    }

    apiGet("task", { email: state.email, role: state.role, taskId: taskId }).then(function (data) {
      state.currentTask = data;
      renderTask(data);
      setBanner("Feedback task loaded.");
    }).catch(handleError);
  }

  function fetchLichessSnapshot() {
    if (!state.currentTaskId) {
      setBanner("Open a student task before fetching Lichess data.", true);
      return;
    }

    if (demoMode) {
      fillLichessFields({
        studentRating: "1652 Blitz",
        gamesPlayed: "35",
        wins: "18",
        draws: "0",
        losses: "17",
        ratingChange: "-25",
        puzzleActivity: "42 puzzles",
        bestResult: "Win vs 1738 rated opponent"
      });
      setBanner("Lichess activity populated in demo mode.");
      return;
    }

    apiGet("fetch_lichess", { email: state.email, role: state.role, taskId: state.currentTaskId }).then(function (data) {
      fillLichessFields(data);
      setBanner("Lichess activity fetched.");
    }).catch(handleError);
  }

  function submitFeedback(mode) {
    if (!state.currentTaskId) {
      setBanner("Open a student task before saving feedback.", true);
      return;
    }

    var payload = collectFeedbackPayload(mode);

    if (demoMode) {
      demoStore.submissions[state.currentTaskId].feedback = clone(payload.feedback);
      demoStore.submissions[state.currentTaskId].submissionStatus = mode === "draft" ? "Draft" : "Submitted";
      demoStore.submissions[state.currentTaskId].taskStatus = mode === "draft" ? "Draft" : "Submitted";
      state.currentTask = clone(demoStore.submissions[state.currentTaskId]);
      renderTask(state.currentTask);
      setBanner(mode === "draft" ? "Draft saved in demo mode." : "Feedback submitted in demo mode.");
      return;
    }

    apiPost("submit_feedback", { payload: JSON.stringify(payload) }).then(function (data) {
      state.currentTask = data.task;
      renderTask(data.task);
      setBanner(mode === "draft" ? "Draft saved." : "Feedback submitted to mentor.");
      if (state.role === "coach") {
        loadCoachDashboard();
      }
      if (state.role === "mentor") {
        loadMentorDashboard();
      }
    }).catch(handleError);
  }

  function mentorUpdate(status) {
    if (!state.currentTaskId) {
      setBanner("Open a task before updating mentor status.", true);
      return;
    }

    var payload = collectFeedbackPayload("mentor");
    payload.mentorStatus = status;

    if (demoMode) {
      demoStore.submissions[state.currentTaskId].feedback = clone(payload.feedback);
      demoStore.submissions[state.currentTaskId].mentorStatus = status;
      demoStore.submissions[state.currentTaskId].taskStatus = status;
      state.currentTask = clone(demoStore.submissions[state.currentTaskId]);
      renderTask(state.currentTask);
      setBanner("Mentor update applied in demo mode: " + status + ".");
      return;
    }

    apiPost("mentor_update", { payload: JSON.stringify(payload) }).then(function (data) {
      state.currentTask = data.task;
      renderTask(data.task);
      setBanner("Mentor update applied: " + status + ".");
      loadMentorDashboard();
      if (status === "Approved") {
        loadCoachDashboard();
      }
    }).catch(handleError);
  }

  function runAutomation(action) {
    if (demoMode) {
      setBanner("Automation action '" + action + "' is available after you connect the live Apps Script backend.");
      return;
    }

    apiPost(action, { email: state.email || "" }).then(function (data) {
      var message = buildAutomationMessage(action, data);
      setBanner(message);

      if (action === "sync_legacy" || action === "launch_tasks") {
        if (state.role === "mentor" && state.email) {
          loadMentorDashboard();
        }
        if (state.email) {
          loadCoachDashboard();
        }
      }
    }).catch(handleError);
  }

  function buildAutomationMessage(action, data) {
    if (action === "sync_legacy") {
      return (data.message || "Legacy import complete.") +
        " Tasks imported: " + (data.tasksImported || 0) +
        ", submissions imported: " + (data.submissionsImported || 0) + ".";
    }

    if (action === "launch_tasks") {
      return (data.message || "Monthly tasks launched.") +
        " Created: " + (data.created || 0) + ".";
    }

    if (action === "send_reminders") {
      return (data.message || "Reminders sent.") +
        " Coaches emailed: " + (data.coachesEmailed || 0) + ".";
    }

    return data.message || ("Automation completed: " + action);
  }

  function collectFeedbackPayload(mode) {
    return {
      email: state.email,
      role: state.role,
      taskId: state.currentTaskId,
      mode: mode,
      feedback: {
        studentRating: byId("student-rating").value,
        gamesPlayed: byId("games-played").value,
        wins: byId("wins").value,
        draws: byId("draws").value,
        losses: byId("losses").value,
        ratingChange: byId("rating-change").value,
        puzzleActivity: byId("puzzle-activity").value,
        bestResult: byId("best-result").value,
        puzzleConsistency: byId("puzzle-consistency").value,
        skillLevel: byId("skill-level").value,
        classPerformance: byId("class-performance").value,
        strengths: byId("strengths").value,
        improvementAreas: byId("improvement-areas").value,
        focusNextMonth: byId("focus-next-month").value,
        overallComment: byId("overall-comment").value,
        mentorRemark: byId("mentor-remark").value,
        mentorNotes: byId("mentor-notes").value
      }
    };
  }

  function renderCoachDashboard(data) {
    if (!data) {
      elements.dashboardTitle.textContent = "Waiting for coach login";
      elements.coachSummaryBadge.textContent = "0 Pending";
      elements.summaryActive.textContent = "0";
      elements.summarySubmitted.textContent = "0";
      elements.summaryPending.textContent = "0";
      elements.summaryReturned.textContent = "0";
      elements.coachTaskList.innerHTML = emptyState("No coach data loaded yet", "Sign in as a coach to load active students and feedback status.");
      return;
    }

    elements.dashboardTitle.textContent = data.coachName + " · " + data.month;
    elements.coachSummaryBadge.textContent = data.summary.pending + " Pending";
    elements.summaryActive.textContent = data.summary.active;
    elements.summarySubmitted.textContent = data.summary.submitted;
    elements.summaryPending.textContent = data.summary.pending;
    elements.summaryReturned.textContent = data.summary.returned;

    if (!data.tasks.length) {
      elements.coachTaskList.innerHTML = emptyState("No tasks found", "This coach has no active feedback tasks for the selected month.");
      return;
    }

    elements.coachTaskList.innerHTML = data.tasks.map(function (task) {
      return (
        '<article class="student-card student-card--' + statusClass(task.taskStatus) + '">' +
          "<div>" +
            "<h3>" + escapeHtml(task.studentName) + "</h3>" +
            "<p>" + escapeHtml(task.studentId) + " · Batch " + escapeHtml(task.batchCode || "-") + " · Lichess: " + escapeHtml(task.lichessId || "-") + "</p>" +
          "</div>" +
          '<div class="student-card__actions">' +
            '<span class="badge badge--' + statusClass(task.taskStatus) + '">' + escapeHtml(task.taskStatus) + "</span>" +
            '<button type="button" class="button button--secondary" data-open-task="' + escapeHtml(task.taskId) + '">Open feedback</button>' +
          "</div>" +
        "</article>"
      );
    }).join("");

    bindTaskButtons();
  }

  function renderMentorDashboard(data) {
    if (!data) {
      elements.mentorTitle.textContent = "Waiting for mentor login";
      elements.mentorSummaryBadge.textContent = "0 Reviews";
      elements.mentorPending.textContent = "0";
      elements.mentorApproved.textContent = "0";
      elements.mentorReturned.textContent = "0";
      elements.mentorOverdue.textContent = "0";
      elements.mentorTaskList.innerHTML = emptyState("No mentor data loaded yet", "Sign in as a mentor to load pending approvals.");
      return;
    }

    elements.mentorTitle.textContent = data.mentorName + " · " + data.month;
    elements.mentorSummaryBadge.textContent = data.summary.pending + " Reviews";
    elements.mentorPending.textContent = data.summary.pending;
    elements.mentorApproved.textContent = data.summary.approved;
    elements.mentorReturned.textContent = data.summary.returned;
    elements.mentorOverdue.textContent = data.summary.overdue;

    if (!data.tasks.length) {
      elements.mentorTaskList.innerHTML = emptyState("No review items found", "This mentor has no queue items for the selected month.");
      return;
    }

    elements.mentorTaskList.innerHTML = data.tasks.map(function (task) {
      return (
        '<article class="review-card">' +
          "<div>" +
            "<h3>" + escapeHtml(task.studentName) + "</h3>" +
            "<p>Coach: " + escapeHtml(task.coachName) + " · Month: " + escapeHtml(task.month) + "</p>" +
          "</div>" +
          '<div class="review-card__actions">' +
            '<span class="badge badge--' + statusClass(task.mentorStatus) + '">' + escapeHtml(task.mentorStatus) + "</span>" +
            '<button type="button" class="button button--secondary" data-open-task="' + escapeHtml(task.taskId) + '">Review</button>' +
          "</div>" +
        "</article>"
      );
    }).join("");

    bindTaskButtons();
  }

  function renderTask(task) {
    if (!task) {
      elements.formTitle.textContent = "Open a task to start feedback";
      elements.currentTaskBadge.textContent = "No task selected";
      clearTaskFields();
      return;
    }

    var feedback = task.feedback || {};

    elements.formTitle.textContent = task.studentName + " · " + task.month;
    elements.currentTaskBadge.textContent = task.taskStatus || task.mentorStatus || "Open";
    byId("student-name").value = task.studentName || "";
    byId("coach-name").value = task.coachName || "";
    byId("batch-code").value = task.batchCode || "";
    byId("feedback-month").value = task.month || "";

    fillLichessFields(feedback);
    byId("puzzle-consistency").value = feedback.puzzleConsistency || "";
    byId("skill-level").value = feedback.skillLevel || "";
    byId("class-performance").value = feedback.classPerformance || "";
    byId("strengths").value = feedback.strengths || "";
    byId("improvement-areas").value = feedback.improvementAreas || "";
    byId("focus-next-month").value = feedback.focusNextMonth || "";
    byId("overall-comment").value = feedback.overallComment || "";
    byId("mentor-remark").value = feedback.mentorRemark || "";
    byId("mentor-notes").value = feedback.mentorNotes || "";
  }

  function clearTaskFields() {
    [
      "student-name", "coach-name", "batch-code", "feedback-month", "student-rating", "games-played",
      "wins", "draws", "losses", "rating-change", "puzzle-activity", "best-result",
      "puzzle-consistency", "skill-level", "class-performance", "strengths", "improvement-areas",
      "focus-next-month", "overall-comment", "mentor-remark", "mentor-notes"
    ].forEach(function (id) {
      byId(id).value = "";
    });
  }

  function fillLichessFields(data) {
    byId("student-rating").value = data.studentRating || "";
    byId("games-played").value = data.gamesPlayed || "";
    byId("wins").value = data.wins || "";
    byId("draws").value = data.draws || "";
    byId("losses").value = data.losses || "";
    byId("rating-change").value = data.ratingChange || "";
    byId("puzzle-activity").value = data.puzzleActivity || "";
    byId("best-result").value = data.bestResult || "";
  }

  function bindTaskButtons() {
    document.querySelectorAll("[data-open-task]").forEach(function (button) {
      button.addEventListener("click", function () {
        loadTask(button.getAttribute("data-open-task"));
      });
    });
  }

  function loadDemoExperience() {
    state.role = "coach";
    updateModeUi();
    elements.emailInput.value = demoStore.coach.coachEmail;
    ensureSelectedMonth(demoStore.coach.month);
    state.email = demoStore.coach.coachEmail;
    state.month = demoStore.coach.month;
    loadCoachDashboard();
    loadTask("TASK-001");
  }

  function resetSession() {
    state.email = "";
    state.month = "";
    state.coachDashboard = null;
    state.mentorDashboard = null;
    state.currentTask = null;
    state.currentTaskId = "";
    elements.loginForm.reset();
    loadAvailableMonths();
    renderCoachDashboard(null);
    renderMentorDashboard(null);
    renderTask(null);
    setBanner(demoMode ? "Demo mode is active. Add your Apps Script URL in config.js for live data." : "Session reset.");
  }

  function apiGet(action, params) {
    var url = new URL(config.apiBaseUrl);
    url.searchParams.set("action", action);
    Object.keys(params || {}).forEach(function (key) {
      if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
        url.searchParams.set(key, params[key]);
      }
    });

    return fetch(url.toString()).then(parseJsonResponse);
  }

  function apiPost(action, params) {
    var body = new URLSearchParams();
    body.set("action", action);
    Object.keys(params || {}).forEach(function (key) {
      body.set(key, params[key]);
    });

    return fetch(config.apiBaseUrl, {
      method: "POST",
      body: body
    }).then(parseJsonResponse);
  }

  function parseJsonResponse(response) {
    if (!response.ok) {
      throw new Error("Request failed with status " + response.status);
    }

    return response.json().then(function (data) {
      if (data && data.ok === false) {
        throw new Error(data.message || "Backend returned an error.");
      }
      return data.data || data;
    });
  }

  function handleError(error) {
    setBanner(error.message || "Something went wrong while talking to the backend.", true);
  }

  function loadAvailableMonths() {
    if (demoMode) {
      renderMonthOptions(["Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "June 2026"], "June 2026");
      return;
    }

    apiGet("available_months", {}).then(function (data) {
      renderMonthOptions(data.months || [], data.defaultMonth || "");
    }).catch(function () {
      renderMonthOptions(["Feb 2026", "Mar 2026", "Apr 2026", "May 2026"], "Mar 2026");
    });
  }

  function renderMonthOptions(months, defaultMonth) {
    var list = months && months.length ? months : [defaultMonth || "Mar 2026"];
    elements.monthInput.innerHTML = list.map(function (month) {
      return '<option value="' + escapeHtml(month) + '">' + escapeHtml(month) + "</option>";
    }).join("");
    ensureSelectedMonth(defaultMonth || list[0]);
  }

  function ensureSelectedMonth(month) {
    var options = Array.prototype.slice.call(elements.monthInput.options || []);
    var hasMonth = options.some(function (option) {
      return option.value === month;
    });

    if (!hasMonth && month) {
      var option = document.createElement("option");
      option.value = month;
      option.textContent = month;
      elements.monthInput.appendChild(option);
    }

    if (month) {
      elements.monthInput.value = month;
    } else if (elements.monthInput.options.length) {
      elements.monthInput.selectedIndex = 0;
    }
  }

  function setBanner(message, isError) {
    elements.statusBanner.textContent = message;
    elements.statusBanner.classList.toggle("notice-bar--error", Boolean(isError));
  }

  function statusClass(status) {
    var value = String(status || "").toLowerCase();
    if (value.indexOf("approve") !== -1) return "approved";
    if (value.indexOf("return") !== -1) return "returned";
    if (value.indexOf("draft") !== -1) return "draft";
    return "pending";
  }

  function emptyState(title, text) {
    return '<article class="empty-state"><h3>' + escapeHtml(title) + "</h3><p>" + escapeHtml(text) + "</p></article>";
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
