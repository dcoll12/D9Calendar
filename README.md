# D9 Calendar – Google Form → Google Calendar Integration

Automatically creates a Google Calendar event every time your Google Form is submitted.

---

## How It Works

```
User submits form → Apps Script trigger fires → Event created on calendar → Confirmation email sent
```

---

## One-Time Setup (5 minutes)

### Step 1 – Open Apps Script from your Form

1. Open your Google Form: https://docs.google.com/forms/d/e/1FAIpQLSe-24aa0rfr0ObiDeiAn5TIivzObkJthbbbsRYta_9XHEoMaQ/viewform
2. Click **⋮ More options** (top-right) → **Script editor**
   *(Or: Extensions → Apps Script)*

### Step 2 – Paste the Code

1. Delete everything in the default `Code.gs` file
2. Copy the entire contents of `Code.gs` from this repo and paste it in
3. Click **Project Settings** (⚙️ gear icon, left sidebar)
4. Check **"Show 'appsscript.json' manifest file in editor"**
5. Open `appsscript.json` in the editor and replace its contents with the `appsscript.json` from this repo

### Step 3 – Match Field Titles

Open `Code.gs` and find the `CONFIG.fields` block:

```js
fields: {
  name:        "Name",
  email:       "Email",
  phone:       "Phone Number",
  address:     "Address",
  date:        "Date",
  startTime:   "Start Time",
  endTime:     "End Time",
  jobTitle:    "Job / Service",
  description: "Description",
  equipment:   "Equipment Needed",
  notes:       "Special Notes",
  extra:       "Additional Info"
}
```

**Each value must exactly match the question text in your form.**

To verify, run `debugFormFields()` (see below) after at least one test submission.

### Step 4 – Install the Trigger

1. In the Apps Script editor, select the function **`installTrigger`** from the dropdown
2. Click **▶ Run**
3. Approve all permission requests when prompted
4. The trigger is now installed – every future submission will create a calendar event automatically

---

## Testing

### Test event creation (no form submission needed)

1. Select **`testCreateEvent`** in the function dropdown
2. Click **▶ Run**
3. Check your calendar – a test event should appear for `2026-03-11 15:00–16:00`

### Debug field titles

1. Submit the form once (or use the pre-filled test URL)
2. Select **`debugFormFields`** and run it
3. The **Execution log** shows every question title → answer mapping
4. Update `CONFIG.fields` titles in `Code.gs` to match exactly

---

## Configuration Reference

| Key | Default | Description |
|-----|---------|-------------|
| `calendarId` | *(your calendar)* | ID of the target Google Calendar |
| `defaultDurationMinutes` | `60` | Fallback event duration when End Time is empty |
| `sendConfirmationEmail` | `true` | Email the submitter a confirmation |
| `confirmationEmailSubject` | `"Appointment Confirmed – D9 Calendar"` | Email subject line |
| `organizationName` | `"D9"` | Shown in confirmation email sign-off |

---

## Form Fields Identified

| Entry ID | Field |
|----------|-------|
| entry.2005620554 | Name |
| entry.1045781291 | Email |
| entry.1166974658 | Phone Number |
| entry.1065046570 | Address |
| entry.1740888052 | Date (YYYY-MM-DD) |
| entry.1388854476 | Start Time (HH:MM) |
| entry.1473712924 | End Time (HH:MM) |
| entry.1587085788 | Job / Service |
| entry.323554986 | Description |
| entry.439887738 | Equipment Needed |
| entry.533019475 | Special Notes |
| entry.839337160 | Additional Info |

---

## Target Calendar

**Calendar ID:**
```
be1ac89bbe6867d17b30c19680c17dabe0d9c18d4f14b05a69a647998df079c6@group.calendar.google.com
```

Make sure the Google account running the script has **"Make changes to events"** permission on this calendar.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Calendar not found" error | Share the calendar with the Google account running the script (Editor role) |
| Fields showing as empty | Run `debugFormFields()` to see exact question titles, update `CONFIG.fields` |
| Trigger not firing | Run `installTrigger()` again; check Triggers tab (⏱ icon) in Apps Script |
| Permission denied | Re-run `installTrigger()` and accept all OAuth scopes |
| Wrong timezone | Update `"timeZone"` in `appsscript.json` (e.g. `"America/New_York"`) |

---

## Files

```
D9Calendar/
├── Code.gs           ← Main Apps Script (copy into the editor)
├── appsscript.json   ← Project manifest with OAuth scopes & timezone
└── README.md         ← This file
```
