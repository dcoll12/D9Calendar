# D9 Calendar – Google Form → Google Calendar Integration

Automatically creates a Google Calendar event every time your Google Form is submitted, using the Form Responses Google Sheet as the trigger point.

---

## Setup (10 minutes, one-time)

### Step 1 – Open Apps Script from the Response Sheet

1. Open your Form Responses sheet:
   **https://docs.google.com/spreadsheets/d/11y0aSk25N4ZWl1MZ3dgwWgTX-imHV34b0cCYaeQb4X8/edit**
2. Click **Extensions → Apps Script**
3. You'll see a default `Code.gs` file

### Step 2 – Paste the Script

1. Select all the text in `Code.gs` and delete it
2. Copy the entire contents of `Code.gs` from this repo and paste it in
3. Click **Save** (💾 icon or Ctrl+S)

### Step 3 – Match Your Column Headers

This is the most important step. The script needs column names that exactly match your sheet.

1. In the Apps Script editor, select **`debugSheetHeaders`** from the function dropdown
2. Click **▶ Run** (approve permissions if prompted)
3. Click **Execution log** at the bottom — you'll see output like:

```
Column 1: "Timestamp"
Column 2: "Name"
Column 3: "Email Address"
...
```

4. Open `Code.gs` and find the `CONFIG.columns` block:

```js
columns: {
  timestamp:   "Timestamp",
  name:        "Name",
  email:       "Email Address",   // ← must match EXACTLY
  phone:       "Phone Number",
  address:     "Address",
  date:        "Date",            // ← REQUIRED
  startTime:   "Start Time",      // ← REQUIRED
  endTime:     "End Time",
  jobTitle:    "Job / Service",
  description: "Description",
  equipment:   "Equipment Needed",
  notes:       "Special Notes",
  extra:       "Additional Info"
}
```

5. Update each value to exactly match what `debugSheetHeaders` printed
6. Save again

### Step 4 – Test Calendar Access

1. Select **`testCalendarAccess`** and click **▶ Run**
2. Check your Google Calendar — a test event should appear for **March 11, 2026, 3–4 PM**
3. If you get "Calendar not found": see **Troubleshooting** below

### Step 5 – Test with Real Data

1. Select **`testWithLastRow`** and click **▶ Run**
2. This simulates a form submission using your most recent sheet row
3. Check the calendar for the new event

### Step 6 – Install the Live Trigger

1. Select **`installTrigger`** and click **▶ Run**
2. Approve permissions
3. Done — every future form submission will now auto-create a calendar event

---

## Calendar Access

**Calendar ID:**
```
be1ac89bbe6867d17b30c19680c17dabe0d9c18d4f14b05a69a647998df079c6@group.calendar.google.com
```

The Google account running the script must have **"Make changes to events"** (Editor) permission on this calendar:

1. Open **Google Calendar**
2. Find the calendar → click ⋮ → **Settings and sharing**
3. Under **Share with specific people**, add the script account's email with **"Make changes to events"**

---

## What Gets Created

Each form submission creates a calendar event with:

| Calendar field | Source |
|----------------|--------|
| Title | `Job / Service – Name` |
| Start | Date + Start Time from form |
| End | Date + End Time from form |
| Location | Address |
| Description | All form fields |
| Guest | Submitter's email (they get a calendar invite) |

A confirmation email is also sent to the submitter automatically.

---

## Configuration Options

Edit the `CONFIG` block at the top of `Code.gs`:

| Key | Default | Description |
|-----|---------|-------------|
| `calendarId` | *(your calendar)* | Target Google Calendar |
| `defaultDurationMinutes` | `60` | Duration when End Time is missing |
| `sendConfirmationEmail` | `true` | Email submitter after booking |
| `confirmationEmailSubject` | `"Appointment Confirmed – D9 Calendar"` | Email subject |
| `organizationName` | `"D9"` | Sign-off name in confirmation email |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Calendar not found" | Share the calendar with the Apps Script account (Editor role) |
| Fields are empty | Run `debugSheetHeaders()`, update `CONFIG.columns` to match |
| Trigger not firing | Run `installTrigger()` again; verify in Triggers tab (⏱ icon) |
| Wrong time on events | Change `"timeZone"` in `appsscript.json` (e.g. `"America/Chicago"`) |
| Permission errors | Delete all triggers, re-run `installTrigger()`, re-approve all scopes |

---

## Files

```
D9Calendar/
├── Code.gs           ← Apps Script (paste into the Sheet's script editor)
├── appsscript.json   ← Manifest with OAuth scopes and timezone
└── README.md         ← This file
```
