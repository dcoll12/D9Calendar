/**
 * D9 Calendar – Google Sheet (Form Responses) → Google Calendar
 *
 * Attach this script to your Form Responses Google Sheet:
 *   Sheet → Extensions → Apps Script → paste this code → Save
 *
 * Then run installTrigger() ONCE to activate automatic event creation.
 */

// ─── CONFIGURATION ────────────────────────────────────────────────────────────

var CONFIG = {
  // Google Calendar ID to add events to
  calendarId: "be1ac89bbe6867d17b30c19680c17dabe0d9c18d4f14b05a69a647998df079c6@group.calendar.google.com",

  // Form Responses spreadsheet ID (from the sheet URL)
  spreadsheetId: "11y0aSk25N4ZWl1MZ3dgwWgTX-imHV34b0cCYaeQb4X8",

  // Default duration in minutes when no End Time column exists
  defaultDurationMinutes: 60,

  // Send a confirmation email to the submitter after booking
  sendConfirmationEmail: true,
  confirmationEmailSubject: "Appointment Confirmed – D9 Calendar",
  organizationName: "D9",

  /**
   * Map each key to the EXACT column header in your Google Sheet.
   * Run debugSheetHeaders() to see all your column names printed in the log.
   *
   * Required: date, startTime
   * Optional: everything else (script handles missing columns gracefully)
   */
  columns: {
    timestamp:   "Timestamp",
    email:       "Email Address",
    name:        "Contact Name",
    contactEmail:"Contact Email",
    phone:       "Contact Phone number",
    address:     "Event Location - Title and Address",
    startTime:   "Event Start Time",
    details:     "Event Details",
    ticketed:    "Ticketed? ",
    ticketInfo:  "If ticketed provide price information & link",
    notes:       "Other Comments",
    date:        "Event Date",
    endTime:     "Event End Time",
    eventLink:   "Event Link",
    description: "Event Description",
    title:       "Event Title"
  }
};

// ─── TRIGGER SETUP ────────────────────────────────────────────────────────────

/**
 * Run this ONCE from the Apps Script editor (▶ Run button).
 * It installs the onFormSubmit trigger on this spreadsheet.
 */
function installTrigger() {
  // Remove existing onFormSubmit triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "onFormSubmit") {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Works whether script is bound to the sheet or standalone
  var ss = SpreadsheetApp.getActiveSpreadsheet()
        || SpreadsheetApp.openById(CONFIG.spreadsheetId);

  ScriptApp.newTrigger("onFormSubmit")
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  Logger.log("Trigger installed on: " + ss.getName());
  Logger.log("onFormSubmit will now fire on every new form response.");
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

/**
 * Fires automatically when a new form response is added to the sheet.
 * @param {GoogleAppsScript.Events.SheetsOnFormSubmit} e
 */
function onFormSubmit(e) {
  try {
    var data = parseNamedValues(e.namedValues);
    Logger.log("Form data: " + JSON.stringify(data));

    var event = createCalendarEvent(data);
    Logger.log("Calendar event created: " + event.getTitle() + " (" + event.getId() + ")");

    if (CONFIG.sendConfirmationEmail && data.email) {
      sendConfirmation(data, event);
    }
  } catch (err) {
    Logger.log("ERROR: " + err.message + "\n" + err.stack);
    notifyAdminOfError(err, e);
  }
}

// ─── SHEET PARSING ────────────────────────────────────────────────────────────

/**
 * Converts e.namedValues ({"Column": ["value"], ...}) to a flat data object
 * using the column mappings in CONFIG.columns.
 *
 * @param {Object} namedValues - The namedValues from the form submit event.
 * @returns {Object}
 */
function parseNamedValues(namedValues) {
  var data = {};
  var cols = CONFIG.columns;

  Object.keys(cols).forEach(function (key) {
    var colName = cols[key];
    var arr = namedValues[colName];
    data[key] = (arr && arr[0]) ? arr[0].toString().trim() : "";
  });

  // Also keep the raw map so we can log it for debugging
  data._raw = namedValues;
  return data;
}

// ─── CALENDAR EVENT CREATION ──────────────────────────────────────────────────

/**
 * Creates a Google Calendar event from the parsed row data.
 * @param {Object} data
 * @returns {CalendarApp.CalendarEvent}
 */
function createCalendarEvent(data) {
  var calendar = CalendarApp.getCalendarById(CONFIG.calendarId);
  if (!calendar) {
    throw new Error(
      "Calendar not found: " + CONFIG.calendarId + "\n" +
      "Make sure the account running this script has 'Make changes to events' " +
      "permission on that calendar."
    );
  }

  var startDate = buildDate(data.date, data.startTime);
  var endDate = data.endTime
    ? buildDate(data.date, data.endTime)
    : new Date(startDate.getTime() + CONFIG.defaultDurationMinutes * 60000);

  var title       = buildEventTitle(data);
  var description = buildEventDescription(data);

  var event = calendar.createEvent(title, startDate, endDate, {
    description: description,
    location:    data.address || ""
  });

  if (data.email) {
    event.addGuest(data.email);
  }

  return event;
}

function buildEventTitle(data) {
  return data.title || "New Event";
}

function buildEventDescription(data) {
  var lines = [];
  if (data.description)  lines.push(data.description);
  if (data.details)      { if (lines.length) lines.push(""); lines.push("Event Details:  " + data.details); }
  var isTicketed = data.ticketed && data.ticketed.toLowerCase() !== "no";
  if (isTicketed) {
    lines.push("Ticketed:       " + data.ticketed);
    if (data.ticketInfo) lines.push("Ticket Info:    " + data.ticketInfo);
  }
  if (data.eventLink)    lines.push("Event Link:     " + data.eventLink);

  return lines.join("\n");
}

// ─── DATE / TIME HELPERS ──────────────────────────────────────────────────────

/**
 * Parses a date + time into a JS Date.
 *
 * Supported date formats: "2026-03-11", "03/11/2026", "March 11, 2026"
 * Supported time formats: "15:00", "3:00 PM", "3 PM"
 *
 * @param {string} dateStr
 * @param {string} timeStr
 * @returns {Date}
 */
function buildDate(dateStr, timeStr) {
  if (!dateStr) throw new Error("Date field is empty. Check that CONFIG.columns.date matches your sheet header.");

  var date;

  // Try ISO format YYYY-MM-DD first
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    var dp = dateStr.substring(0, 10).split("-");
    date = new Date(parseInt(dp[0]), parseInt(dp[1]) - 1, parseInt(dp[2]));
  } else {
    // Fall back to JS Date parser for other formats (MM/DD/YYYY, "March 11, 2026", etc.)
    date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error("Could not parse date: '" + dateStr + "'");
    }
    // Reset time portion
    date = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  // Parse time
  var hours = 0, minutes = 0;
  if (timeStr) {
    var t = timeStr.trim().toUpperCase();
    var isPM = t.indexOf("PM") !== -1;
    var isAM = t.indexOf("AM") !== -1;
    t = t.replace(/[APM\s]/g, "");

    var tp = t.split(":");
    hours   = parseInt(tp[0], 10) || 0;
    minutes = parseInt(tp[1] || "0", 10) || 0;

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0);
}

// ─── EMAIL CONFIRMATION ───────────────────────────────────────────────────────

function sendConfirmation(data, event) {
  var startStr = event.getStartTime().toLocaleString();
  var endStr   = event.getEndTime().toLocaleString();

  var body = [
    "Hi " + (data.name || "there") + ",",
    "",
    "Your appointment has been confirmed. Here are the details:",
    "",
    "  Date & Time:   " + startStr + " to " + endStr,
    "  Location:      " + (data.address || "N/A"),
    "  Event Link:    " + (data.eventLink || "N/A"),
    "",
    "A calendar invite has been sent to this address.",
    "Reply to this email with any questions.",
    "",
    "Thanks,",
    CONFIG.organizationName
  ].join("\n");

  MailApp.sendEmail({ to: data.email, subject: CONFIG.confirmationEmailSubject, body: body });
  Logger.log("Confirmation email sent to " + data.email);
}

function notifyAdminOfError(err, e) {
  var owner = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({
    to:      owner,
    subject: "[D9 Calendar] Form submission error",
    body:    "Error: " + err.message + "\n\nStack: " + err.stack +
             "\n\nRaw event:\n" + JSON.stringify(e, null, 2)
  });
}

// ─── DEBUG / TEST UTILITIES ───────────────────────────────────────────────────

/**
 * STEP 1: Run this first.
 * Prints every column header in your sheet so you can match them to CONFIG.columns.
 */
function debugSheetHeaders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
        || SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var sheet = ss.getSheets()[0];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log("=== Sheet Column Headers ===");
  headers.forEach(function (h, i) {
    Logger.log("Column " + (i + 1) + ": \"" + h + "\"");
  });
  Logger.log("=== Update CONFIG.columns to match these exactly ===");
}

/**
 * STEP 2: Run this to simulate a form submission using the last row of the sheet.
 * Useful for testing without submitting the form again.
 */
function testWithLastRow() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
        || SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var sheet = ss.getSheets()[0];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var lastRow = sheet.getRange(sheet.getLastRow(), 1, 1, sheet.getLastColumn()).getValues()[0];

  // Build a namedValues object identical to what e.namedValues would contain
  var namedValues = {};
  headers.forEach(function (h, i) {
    namedValues[h] = [lastRow[i] !== undefined ? lastRow[i].toString() : ""];
  });

  Logger.log("Simulating submission with: " + JSON.stringify(namedValues));
  onFormSubmit({ namedValues: namedValues });
}

/**
 * STEP 3 (optional): Create a test event with hardcoded data to verify calendar access.
 */
function testCalendarAccess() {
  var fakeData = {
    name:        "Darian",
    email:       "darianroark18@gmail.com",
    phone:       "8125215712",
    address:     "302 N Elm St.",
    date:        "2026-03-11",
    startTime:   "15:00",
    endTime:     "16:00",
    jobTitle:    "Test Job",
    description: "Testing calendar access",
    equipment:   "No",
    notes:       "Test notes",
    extra:       ""
  };

  var event = createCalendarEvent(fakeData);
  Logger.log("SUCCESS: Test event created → " + event.getTitle() + " on " + event.getStartTime());
}
