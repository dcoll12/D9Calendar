/**
 * D9 Calendar - Google Form to Google Calendar Integration
 *
 * This script listens for form submissions and automatically creates
 * calendar events based on the submitted data.
 *
 * Setup:
 *   1. Open your Google Form → Extensions → Apps Script
 *   2. Paste this code replacing any existing content
 *   3. Run installTrigger() once to set up the form submit trigger
 *   4. Grant the required permissions when prompted
 */

// ─── CONFIGURATION ────────────────────────────────────────────────────────────

var CONFIG = {
  // Target Google Calendar ID
  calendarId: "be1ac89bbe6867d17b30c19680c17dabe0d9c18d4f14b05a69a647998df079c6@group.calendar.google.com",

  // Default event duration in minutes (used if end time is missing)
  defaultDurationMinutes: 60,

  // Set to true to send an email confirmation to the submitter
  sendConfirmationEmail: true,

  // Email subject prefix for confirmations
  confirmationEmailSubject: "Appointment Confirmed – D9 Calendar",

  // Name of the person / org shown in confirmation emails
  organizationName: "D9",

  // Form field titles – update these to exactly match your form question text
  fields: {
    name:        "Name",          // entry.2005620554
    email:       "Email",         // entry.1045781291
    phone:       "Phone Number",  // entry.1166974658
    address:     "Address",       // entry.1065046570
    date:        "Date",          // entry.1740888052  (YYYY-MM-DD)
    startTime:   "Start Time",    // entry.1388854476  (HH:MM, 24-hr)
    endTime:     "End Time",      // entry.1473712924  (HH:MM, 24-hr)
    jobTitle:    "Job / Service", // entry.1587085788
    description: "Description",   // entry.323554986
    equipment:   "Equipment Needed", // entry.439887738
    notes:       "Special Notes", // entry.533019475
    extra:       "Additional Info" // entry.839337160
  }
};

// ─── TRIGGER SETUP ────────────────────────────────────────────────────────────

/**
 * Run this function ONCE manually from the Apps Script editor to install
 * the onFormSubmit trigger.  After that it runs automatically.
 */
function installTrigger() {
  // Remove any existing triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "onFormSubmit") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("onFormSubmit")
    .forForm(FormApp.getActiveForm())
    .onFormSubmit()
    .create();

  Logger.log("✅ Trigger installed successfully.");
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

/**
 * Triggered automatically every time the form is submitted.
 * @param {Object} e - The form submit event object.
 */
function onFormSubmit(e) {
  try {
    var data = parseFormResponse(e.response);
    Logger.log("Parsed response: " + JSON.stringify(data));

    var event = createCalendarEvent(data);
    Logger.log("Event created: " + event.getId());

    if (CONFIG.sendConfirmationEmail && data.email) {
      sendConfirmation(data, event);
    }
  } catch (err) {
    Logger.log("ERROR in onFormSubmit: " + err.message);
    notifyAdminOfError(err, e);
  }
}

// ─── FORM PARSING ─────────────────────────────────────────────────────────────

/**
 * Converts a FormResponse into a plain object using the field titles
 * defined in CONFIG.fields.  Falls back to entry order when titles don't
 * match so the script degrades gracefully.
 *
 * @param {FormApp.FormResponse} response
 * @returns {Object} Flat map of field keys → answer strings
 */
function parseFormResponse(response) {
  var data = {};
  var itemResponses = response.getItemResponses();

  // Build a map of { "Question Title" : "Answer" }
  var byTitle = {};
  itemResponses.forEach(function (ir) {
    byTitle[ir.getItem().getTitle()] = ir.getResponse();
  });

  // Map known titles to friendly keys
  var fields = CONFIG.fields;
  Object.keys(fields).forEach(function (key) {
    var title = fields[key];
    data[key] = byTitle[title] || "";
  });

  // Store raw map for debugging / unknown fields
  data._raw = byTitle;

  return data;
}

// ─── CALENDAR EVENT CREATION ──────────────────────────────────────────────────

/**
 * Creates a Google Calendar event from the parsed form data.
 *
 * @param {Object} data - Parsed form data.
 * @returns {CalendarApp.CalendarEvent}
 */
function createCalendarEvent(data) {
  var calendar = CalendarApp.getCalendarById(CONFIG.calendarId);
  if (!calendar) {
    throw new Error("Calendar not found: " + CONFIG.calendarId +
      ". Make sure you have access to this calendar.");
  }

  var startDate = buildDate(data.date, data.startTime);
  var endDate   = data.endTime
    ? buildDate(data.date, data.endTime)
    : new Date(startDate.getTime() + CONFIG.defaultDurationMinutes * 60000);

  var title       = buildEventTitle(data);
  var description = buildEventDescription(data);

  var options = {
    description: description,
    location:    data.address || ""
  };

  var event = calendar.createEvent(title, startDate, endDate, options);

  // Add the submitter as a guest so they receive a calendar invite
  if (data.email) {
    event.addGuest(data.email);
  }

  return event;
}

/**
 * Builds the event title.  Customize as needed.
 */
function buildEventTitle(data) {
  var parts = [];
  if (data.jobTitle) parts.push(data.jobTitle);
  if (data.name)     parts.push("– " + data.name);
  return parts.length ? parts.join(" ") : "New Appointment";
}

/**
 * Builds the event description from all known fields.
 */
function buildEventDescription(data) {
  var lines = [];

  if (data.name)        lines.push("Name:              " + data.name);
  if (data.email)       lines.push("Email:             " + data.email);
  if (data.phone)       lines.push("Phone:             " + data.phone);
  if (data.address)     lines.push("Address:           " + data.address);
  if (data.jobTitle)    lines.push("Job / Service:     " + data.jobTitle);
  if (data.description) lines.push("Description:       " + data.description);
  if (data.equipment)   lines.push("Equipment Needed:  " + data.equipment);
  if (data.notes)       lines.push("Special Notes:     " + data.notes);
  if (data.extra)       lines.push("Additional Info:   " + data.extra);

  lines.push("");
  lines.push("Submitted via Google Form on " + new Date().toLocaleString());

  return lines.join("\n");
}

// ─── DATE / TIME HELPERS ──────────────────────────────────────────────────────

/**
 * Combines a date string (YYYY-MM-DD) and time string (HH:MM) into a Date.
 * Handles both 24-hour and 12-hour (AM/PM) time formats.
 *
 * @param {string} dateStr  e.g. "2026-03-11"
 * @param {string} timeStr  e.g. "15:00" or "3:00 PM"
 * @returns {Date}
 */
function buildDate(dateStr, timeStr) {
  if (!dateStr) throw new Error("Date is required but was empty.");

  var dateParts = dateStr.split("-");
  var year  = parseInt(dateParts[0], 10);
  var month = parseInt(dateParts[1], 10) - 1; // JS months are 0-indexed
  var day   = parseInt(dateParts[2], 10);

  var hours   = 0;
  var minutes = 0;

  if (timeStr) {
    // Normalize: remove extra spaces, handle AM/PM
    var t = timeStr.trim().toUpperCase();
    var isPM = t.indexOf("PM") !== -1;
    var isAM = t.indexOf("AM") !== -1;
    t = t.replace(/AM|PM/g, "").trim();

    var timeParts = t.split(":");
    hours   = parseInt(timeParts[0], 10);
    minutes = parseInt(timeParts[1] || "0", 10);

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
  }

  return new Date(year, month, day, hours, minutes, 0);
}

// ─── EMAIL CONFIRMATION ───────────────────────────────────────────────────────

/**
 * Sends a confirmation email to the person who submitted the form.
 *
 * @param {Object} data               - Parsed form data.
 * @param {CalendarApp.CalendarEvent} event - The created calendar event.
 */
function sendConfirmation(data, event) {
  var subject = CONFIG.confirmationEmailSubject;

  var startStr = event.getStartTime().toLocaleString();
  var endStr   = event.getEndTime().toLocaleString();

  var body = [
    "Hi " + (data.name || "there") + ",",
    "",
    "Thank you for submitting your request. Here are the details of your appointment:",
    "",
    "  Date & Time:   " + startStr + " – " + endStr,
    "  Location:      " + (data.address || "N/A"),
    "  Job / Service: " + (data.jobTitle || "N/A"),
    "",
    "A calendar invite has been sent to this address. If you have any questions,",
    "feel free to reply to this email.",
    "",
    "Thanks,",
    CONFIG.organizationName
  ].join("\n");

  MailApp.sendEmail({
    to:      data.email,
    subject: subject,
    body:    body
  });

  Logger.log("Confirmation email sent to " + data.email);
}

// ─── ERROR NOTIFICATION ───────────────────────────────────────────────────────

/**
 * Emails the script owner when an unhandled error occurs.
 *
 * @param {Error}  err - The caught error.
 * @param {Object} e   - The original form submit event.
 */
function notifyAdminOfError(err, e) {
  var owner = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({
    to:      owner,
    subject: "[D9 Calendar] Form submission error",
    body:    "An error occurred while processing a form submission.\n\n" +
             "Error: " + err.message + "\n\n" +
             "Stack: " + err.stack + "\n\n" +
             "Event object: " + JSON.stringify(e)
  });
}

// ─── UTILITY / TEST ───────────────────────────────────────────────────────────

/**
 * Run this from the Apps Script editor to test event creation without
 * submitting a real form response.
 */
function testCreateEvent() {
  var fakeData = {
    name:        "Darian",
    email:       "darianroark18@gmail.com",
    phone:       "8125215712",
    address:     "302 N Elm St.",
    date:        "2026-03-11",
    startTime:   "15:00",
    endTime:     "16:00",
    jobTitle:    "Test Job",
    description: "Test description",
    equipment:   "No",
    notes:       "Test notes",
    extra:       "Test extra info"
  };

  var event = createCalendarEvent(fakeData);
  Logger.log("Test event created: " + event.getTitle() + " | " + event.getId());
}

/**
 * Lists recent form responses in the Logger – useful for verifying field titles.
 */
function debugFormFields() {
  var form      = FormApp.getActiveForm();
  var responses = form.getResponses();

  if (responses.length === 0) {
    Logger.log("No responses yet.");
    return;
  }

  var latest = responses[responses.length - 1];
  latest.getItemResponses().forEach(function (ir) {
    Logger.log(ir.getItem().getTitle() + " → " + ir.getResponse());
  });
}
