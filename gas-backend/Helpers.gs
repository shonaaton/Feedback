function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function ok(data) {
  return jsonResponse({ ok: true, data: data });
}

function fail(message) {
  return jsonResponse({ ok: false, message: message });
}

function getCurrentMonthLabel() {
  return Utilities.formatDate(new Date(), PORTAL_CONFIG.app.timezone, "MMMM yyyy");
}

function normalizeMonthLabel(input) {
  if (!input) return getCurrentMonthLabel();
  var date = new Date(input);
  if (!isNaN(date.getTime())) {
    return Utilities.formatDate(date, PORTAL_CONFIG.app.timezone, "MMMM yyyy");
  }
  return String(input).trim();
}

function compactMonthLabel(label) {
  var date = new Date(label);
  if (!isNaN(date.getTime())) {
    return Utilities.formatDate(date, PORTAL_CONFIG.app.timezone, "MMM yyyy");
  }
  return String(label).trim();
}

function nowStamp() {
  return Utilities.formatDate(new Date(), PORTAL_CONFIG.app.timezone, "yyyy-MM-dd HH:mm:ss");
}

function makeId(prefix) {
  return prefix + "-" + Utilities.getUuid().split("-")[0].toUpperCase();
}

function getSheet(spreadsheetId, sheetName) {
  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error("Missing sheet: " + sheetName);
  return sheet;
}

function ensureSheet(spreadsheetId, sheetName, headers) {
  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else {
    var existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (existing.join("|") !== headers.join("|")) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sheet;
}

function readObjects(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  return values.slice(1).filter(function (row) {
    return row.join("").trim() !== "";
  }).map(function (row, index) {
    var item = {};
    headers.forEach(function (header, columnIndex) {
      item[header] = row[columnIndex];
    });
    item.__rowNumber = index + 2;
    return item;
  });
}

function appendObject(sheet, headers, object) {
  var row = headers.map(function (header) {
    return object[header] !== undefined ? object[header] : "";
  });
  sheet.appendRow(row);
}

function updateObject(sheet, headers, rowNumber, object) {
  var row = headers.map(function (header) {
    return object[header] !== undefined ? object[header] : "";
  });
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
}

function findByKey(items, key, value) {
  return items.find(function (item) {
    return String(item[key]) === String(value);
  });
}

function parsePayload(raw) {
  return raw ? JSON.parse(raw) : {};
}

function sanitizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function mentorEmails() {
  var sheet = ensureSheet(PORTAL_CONFIG.spreadsheetIds.responses, PORTAL_CONFIG.sheetNames.mentorConfig, ["Mentor_Name", "Mentor_Email", "Status"]);
  var sheetEmails = readObjects(sheet)
    .filter(function (row) { return String(row.Status).toLowerCase() !== "inactive"; })
    .map(function (row) { return sanitizeEmail(row.Mentor_Email); })
    .filter(Boolean);

  var defaults = (PORTAL_CONFIG.defaults && PORTAL_CONFIG.defaults.mentorEmails) || [];
  var merged = sheetEmails.concat(defaults.map(sanitizeEmail)).filter(Boolean);
  return merged.filter(function (email, index) {
    return merged.indexOf(email) === index;
  });
}

function otpKey_(role, email) {
  return "OTP|" + String(role || "").toLowerCase() + "|" + sanitizeEmail(email);
}

function otpEmailKey_(email) {
  return "OTP|" + sanitizeEmail(email);
}

function storeOtp_(email, role, code, expiresAt) {
  var normalizedRole = String(role || "").toLowerCase();
  var normalizedEmail = sanitizeEmail(email);
  var normalizedCode = String(code || "").replace(/\s+/g, "").trim();
  if (!normalizedEmail) throw new Error("Email is required.");
  if (normalizedRole !== "coach" && normalizedRole !== "mentor") throw new Error("Role must be coach or mentor.");
  if (!/^\d{6}$/.test(normalizedCode)) throw new Error("A valid 6-digit OTP is required.");

  if (normalizedRole === "coach") {
    assertCoachEmail(normalizedEmail);
  } else {
    assertMentorEmail(normalizedEmail);
  }

  var expiryMs = new Date(expiresAt || "").getTime();
  if (isNaN(expiryMs)) expiryMs = new Date().getTime() + (10 * 60 * 1000);
  var ttlSeconds = Math.max(60, Math.min(600, Math.floor((expiryMs - new Date().getTime()) / 1000)));

  var payload = JSON.stringify({
    code: normalizedCode,
    email: normalizedEmail,
    role: normalizedRole,
    createdAt: new Date().getTime(),
    expiresAt: expiryMs,
    used: false,
    source: "n8n"
  });

  CacheService.getScriptCache().put(otpKey_(normalizedRole, normalizedEmail), normalizedCode, ttlSeconds);
  CacheService.getScriptCache().put(otpEmailKey_(normalizedEmail), normalizedCode, ttlSeconds);
  PropertiesService.getScriptProperties().setProperty(otpKey_(normalizedRole, normalizedEmail), payload);
  PropertiesService.getScriptProperties().setProperty(otpEmailKey_(normalizedEmail), payload);

  return { message: "OTP stored.", email: normalizedEmail, role: normalizedRole, expiresAt: new Date(expiryMs).toISOString() };
}

function requestOtp_(email, role) {
  var normalizedRole = String(role || "").toLowerCase();
  var normalizedEmail = sanitizeEmail(email);
  if (!normalizedEmail) throw new Error("Email is required.");
  if (normalizedRole !== "coach" && normalizedRole !== "mentor") throw new Error("Role must be coach or mentor.");

  if (normalizedRole === "coach") {
    assertCoachEmail(normalizedEmail);
  } else {
    assertMentorEmail(normalizedEmail);
  }

  var code = String(Math.floor(100000 + Math.random() * 900000));
  var payload = JSON.stringify({
    code: code,
    email: normalizedEmail,
    role: normalizedRole,
    createdAt: new Date().getTime(),
    expiresAt: new Date().getTime() + (10 * 60 * 1000),
    used: false
  });

  // Store in both CacheService and ScriptProperties. CacheService can occasionally miss after a fresh deployment,
  // while ScriptProperties gives the verification step a reliable fallback.
  CacheService.getScriptCache().put(otpKey_(normalizedRole, normalizedEmail), code, 600);
  CacheService.getScriptCache().put(otpEmailKey_(normalizedEmail), code, 600);
  PropertiesService.getScriptProperties().setProperty(otpKey_(normalizedRole, normalizedEmail), payload);
  PropertiesService.getScriptProperties().setProperty(otpEmailKey_(normalizedEmail), payload);

  MailApp.sendEmail({
    to: normalizedEmail,
    subject: PORTAL_CONFIG.app.title + " login code",
    htmlBody: [
      "<div style='font-family:Segoe UI,Arial,sans-serif;max-width:560px'>",
      "<h2 style='color:#5A1372'>Your login code</h2>",
      "<p>Use this one-time code to sign in to the Envision Chess Academy feedback portal.</p>",
      "<div style='font-size:32px;font-weight:800;letter-spacing:0.18em;color:#5A1372;margin:18px 0'>", code, "</div>",
      "<p>This code expires in 10 minutes.</p>",
      "</div>"
    ].join("")
  });

  return { message: "OTP sent.", expiresInMinutes: 10 };
}

function verifyOtp_(email, role, code) {
  var normalizedRole = String(role || "").toLowerCase();
  var normalizedEmail = sanitizeEmail(email);
  var enteredCode = String(code || "").replace(/\s+/g, "").trim();
  if (!normalizedEmail) throw new Error("Email is required.");
  if (!enteredCode) throw new Error("OTP code is required.");

  var keys = [otpKey_(normalizedRole, normalizedEmail), otpEmailKey_(normalizedEmail)];
  var cached = "";
  for (var i = 0; i < keys.length; i++) {
    cached = CacheService.getScriptCache().get(keys[i]);
    if (cached) break;
  }

  var propPayload = null;
  var propKey = "";
  for (var j = 0; j < keys.length; j++) {
    var raw = PropertiesService.getScriptProperties().getProperty(keys[j]);
    if (raw) {
      propPayload = JSON.parse(raw);
      propKey = keys[j];
      break;
    }
  }

  if (!cached && !propPayload) throw new Error("OTP expired or not found. Please request a new code.");

  if (propPayload) {
    if (propPayload.used) throw new Error("OTP already used. Please request a new code.");
    if (new Date().getTime() > Number(propPayload.expiresAt || 0)) {
      keys.forEach(function (key) { PropertiesService.getScriptProperties().deleteProperty(key); });
      throw new Error("OTP expired. Please request a new code.");
    }
    if (String(propPayload.code) !== enteredCode) throw new Error("Incorrect OTP.");
  } else if (String(cached) !== enteredCode) {
    throw new Error("Incorrect OTP.");
  }

  var sessionToken = Utilities.getUuid();
  CacheService.getScriptCache().put("SESSION|" + sessionToken, JSON.stringify({
    email: normalizedEmail,
    role: normalizedRole
  }), 43200);
  PropertiesService.getScriptProperties().setProperty("SESSION|" + sessionToken, JSON.stringify({
    email: normalizedEmail,
    role: normalizedRole,
    expiresAt: new Date().getTime() + (12 * 60 * 60 * 1000)
  }));

  keys.forEach(function (key) {
    CacheService.getScriptCache().remove(key);
    PropertiesService.getScriptProperties().deleteProperty(key);
  });

  return {
    message: "Login verified.",
    sessionToken: sessionToken,
    email: normalizedEmail,
    role: normalizedRole
  };
}

function getSession_(sessionToken) {
  if (!sessionToken) throw new Error("Session token missing.");
  var key = "SESSION|" + sessionToken;
  var cached = CacheService.getScriptCache().get(key) || PropertiesService.getScriptProperties().getProperty(key);
  if (!cached) throw new Error("Session expired. Please log in again.");
  var session = JSON.parse(cached);
  if (session.expiresAt && new Date().getTime() > Number(session.expiresAt)) {
    PropertiesService.getScriptProperties().deleteProperty(key);
    throw new Error("Session expired. Please log in again.");
  }
  return session;
}

function assertSession_(sessionToken, expectedRole, expectedEmail) {
  var session = getSession_(sessionToken);
  if (expectedRole && session.role !== String(expectedRole).toLowerCase()) {
    throw new Error("This session cannot access that section.");
  }
  if (expectedEmail && sanitizeEmail(expectedEmail) !== session.email) {
    throw new Error("This session does not match the requested email.");
  }
  return session;
}
