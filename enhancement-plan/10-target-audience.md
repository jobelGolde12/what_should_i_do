# Who It's For — Target Audience & Use Cases

This document details the primary user personas for TaskMind and the concrete use cases each one faces.

---

## Core Value Proposition

TaskMind helps anyone who receives **confusing, dense, or action-heavy messages** — official notices, emails, group messages, announcements, memos, documents — by converting them into:
- Clear action items
- Concrete deadlines
- Urgency levels
- Confusion highlights (what's unclear + why)
- A single next-step recommendation
- Optional translation (e.g., to Tagalog)

---

## Personas & Use Cases

### 🎓 Students
| Scenario | Example | What TaskMind extracts |
|----------|---------|------------------------|
| School announcements | Class suspension notices, event schedules | Action: "No classes"; Deadline: "until lifted"; Urgency |
| Thesis & research instructions | Formatting guidelines, submission checklists | Actions checklist, deadlines, confusing rules |
| Group project messages | Task assignments over GC/Messenger | Who does what, when, next step |
| Assignment guidelines | Rubrics, submission portals | Deadlines, submission actions, unclear criteria |

### 💼 Professionals
| Scenario | Example | What TaskMind extracts |
|----------|---------|------------------------|
| Manager emails & directives | "Please submit the Q3 report by EOD Friday" | Submit action, deadline, urgency |
| HR notices & policy updates | Memos on benefits, compliance training | Required actions, dates, next step |
| Meeting invitations & minutes | "Mandatory meeting tomorrow 10 AM, please RSVP" | RSVP action, meeting time, deadline |
| Project requirement documents | SOW / PRD with multiple deliverables | Deliverable actions + dates, ambiguities |

### 👪 Everyday People
| Scenario | Example | What TaskMind extracts |
|----------|---------|------------------------|
| Bills & government letters | Utility bills, tax notices, LGU memos | Pay-by deadlines, amounts (via summary), next step |
| Barangay / municipal notices | Lost-and-found, road closures, advisories | Actions (bring item to lost-and-found), urgency, confusing details |
| Long chat messages | Facebook/WhatsApp group threads | Buried to-dos, time-sensitive items |
| Legal documents & contracts | Lease agreements, terms & conditions | Key action clauses, deadlines, confusing legalese |

---

## Geo/Context Considerations (Philippine context)

The fallback engine (`src/app/actions/analyzeText.ts`) has explicit Philippine-specific handling:
- Class-suspension announcements (e.g., Municipality of Bulan) → hardcoded action.
- Lost-and-found notices → Informational urgency + "bring to Lost and Found office".
- "until lifted", "effective <time>" phrases, "tropical cyclone", "heavy rainfall" → Urgent.
- Tagalog translation is the first non-English language offered.

This makes TaskMind especially well-suited for:
- Philippine students (school announcements, typhoon class suspensions).
- LGUs / government office staff (memos, advisories).
- Overseas Filipino workers (OFW) receiving mixed English/Tagalog instructions.

---

## Non-Goals (Who It Is NOT For)

- **Generic chatbots** — no free-form conversation or Q&A beyond the analysis.
- **Long-form document summarizers** — focuses on actions/deadlines, not abstractive summarization of novels/reports (though a summary is produced).
- **Legal/financial advice providers** — highlights confusing parts but does not interpret legality.

---

## Suggested Audience-Driven Enhancements

1. **Scenario templates:** quick-start chips ("Announcement", "Email", "Lost & Found", "Meeting") that pre-fill the prompt context for better extraction.
2. **Localization:** translate the *UI* (not just results) into Tagalog/Cebuano for broader adoption.
3. **Accessibility:** ensure urgency colors also carry text labels (colorblind-friendly).
4. **Onboarding examples:** sample messages per persona on the landing page.
5. **Export:** allow students/professionals to export the action plan to CSV/Markdown/Google Calendar.

