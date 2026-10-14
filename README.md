# MNP Mobile — Accountability

A working prototype of the Sailor accountability surface for MyNavy Portal: daily muster, family accountability, and short-duration absence ("sniv") requests.

One Sailor. One identity. One accountability experience.

## Run locally

```bash
npm install
npm test
npm run dev
```

Open http://localhost:5174. The dev server uses port 5174 so it does not collide with the PCS Calculator app on 5173.

Sign in with a demonstration identity. No password is used. This is mock authentication, not a CAC.

| Identity | Role to exercise |
| --- | --- |
| HM2 Alex J. Rivera | Sailor, four dependents, muster and sniv |
| IT1 Jordan Hale | Supervisor for Alex’s division |
| YN1 Casey Nguyen | Muster coordinator |
| LCDR Morgan Ellis | Command leadership |

All people, UICs, and family records are fictional.

## Demonstration flows

Use **Demonstration controls** (side panel on a wide screen, disclosure on a phone) to switch identity, simulate offline mode, and activate the hurricane.

**Daily muster.** Sign in as Alex. Accountability shows Not Mustered. Choose Muster Now, then Present. The dashboard updates to Awaiting Verification. Sign in as Jordan, open Team → roster → Alex, and confirm the muster. Sign back in as Alex. The status is Muster Confirmed.

**Family emergency.** Sign in as Casey or Morgan and activate Hurricane Lumen. Sign in as Alex. The banner opens family accountability for four dependents. Mark one Needs Assistance, answer the short needs questions, and submit. The screen says the report was recorded in the prototype and was not transmitted to NFAAS. Command roles see counts only.

**Sniv request.** As Alex, choose Request Time Away. Medical Appointment, 0900–1100 is the default; pick the date and submit. As Jordan, approve it under Team → Approvals. Alex gets an in-app notification, and the dashboard shows the approved window. That window does not complete muster.

**Offline submission.** Set connectivity to Offline, muster as Alex, and confirm the status says the command has not received it. Set connectivity to Online. The queued muster is received by the prototype service and still awaits verification. Submitting the same status again does not create a second record.

Reset demonstration data from the same control panel. Reset clears this browser’s copy of the prototype.

## Design system

Visual language is the MNP shell from the PCS Calculator project:

- Tokens and component patterns: `PCS Calculator/mnp`
- Status foreground colors and development shell: `PCS Calculator_MNP`

Tokens live in `src/styles/tokens.css`. Public Sans, the USWDS-derived navy palette, 10–12px radii, and the shared button, card, alert, input, and radio patterns are copied so this app builds on its own. Replace `src/styles/tokens.css` when an official token package is provided. The header and footer are a development shell. Production MyNavy Portal would own that chrome.

## Architecture

```
MNP Mobile UI
  → accountability service
    → domain rules
      → integration ports
        → future Navy systems
```

| Area | Location |
| --- | --- |
| Screens | `src/presentation` |
| Domain rules and types | `src/domain` |
| Fictional seed data | `src/data/seed.ts` |
| Service facade and browser storage | `src/services` |
| Ports for identity, NFAAS, and push | `src/domain/ports.ts` |

Screens do not call external systems. Identity, NFAAS, and push are explicit mock ports. No production API URLs are invented.

Business state is stored as codes such as `PENDING_APPROVAL` and `AWAITING_VERIFICATION`. Labels are separate. Submission, command verification, and source-system acknowledgment are separate fields. An offline entry stays `QUEUED_FOR_SUBMISSION` until sync, and sync never marks it verified or acknowledged by NFAAS.

Browser `localStorage` (`mnp-accountability-prototype-v1`) keeps the demo between refreshes. It is not approved storage for sensitive Navy information. The prototype does not store credentials.

## Authorization

Rules are enforced in the domain service, not only by hiding buttons.

- A Sailor cannot approve their own sniv request.
- Only the assigned supervisor can decide a request, and only after the service has received it.
- A denied, pending, or cancelled request is never an excused muster.
- An approved sniv informs the dashboard and does not complete muster. This command’s `snivSatisfiesMuster` policy is false.
- Family member details are visible only to the sponsor.
- Command views receive aggregate counts.
- Muster verification is limited to the direct supervisor or a muster coordinator, and never to the subject’s own record.
- A queued muster cannot be verified.

## Tests

`npm test` covers duplicate muster prevention, audit history on correction, no self-approval, denied and approved sniv requests not excusing muster, unauthorized family access, offline records staying unsynchronized, idempotent sync, conflict handling, and NFAAS remaining disconnected.

## Assumptions that need Navy validation

- NSA Meridian Point is fictional. Its muster deadline is 0900, with early and late reporting accepted until 2359 so the prototype can be demonstrated outside the primary window. Real commands will differ, including weekends, holidays, and overnight duty.
- A partial-day sniv does not satisfy daily muster unless a future, validated command policy says it does.
- Sailors may correct a muster until the command verifies or flags it.
- Supervisors verify their direct reports. Muster coordinators verify others in the command. Command leadership sees aggregates and does not verify by that role alone. LCDR Ellis is also the supervisor for the department heads.
- NFAAS read and write contracts do not exist in this prototype. Family submissions are labeled as not transmitted.
- Family record edits are review requests stored on the device. They are not sent to DEERS or NFAAS.
- Push notifications have no provider. In-app text omits family and medical details.
- Strong authentication, encrypted device storage, retention, and data-expiration policy are future production work.
