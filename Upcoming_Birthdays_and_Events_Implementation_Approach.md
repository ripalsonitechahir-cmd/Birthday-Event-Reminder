# Upcoming Birthdays & Events Web Application
## Implementation Approach — Technology Agnostic

## 1. Objective

Build a simple web application where users can save birthdays and other important events and immediately see **who or what is coming up soonest**.

The implementation should remain independent of any particular programming language, framework, database, cloud provider, or notification vendor.

---

## 2. Product Principle

The core product loop is:

**Capture → Calculate → Prioritize → Display → Remind → Maintain**

1. Capture people and events.
2. Calculate the next occurrence of recurring events.
3. Prioritize events chronologically.
4. Display the nearest upcoming event first.
5. Notify the user according to reminder preferences.
6. Allow the user to maintain, edit, or remove information.

The dashboard should answer the user's main question within seconds:

> **What is coming up next?**

---

## 3. Recommended High-Level Architecture

Use clear logical layers regardless of the technology selected:

```text
Presentation / Web UI
        |
Application / Use Cases
        |
Domain / Business Rules
        |
Data Access
        |
Persistent Storage
        |
Background Processing / Notifications
```

### Responsibilities

**Presentation**
- Pages/screens
- Forms
- Validation feedback
- Dashboard
- Calendar/list interactions

**Application**
- Create/update/delete event workflows
- Search/filter operations
- User preferences
- Reminder configuration

**Domain**
- Event rules
- Recurrence calculation
- Next-occurrence calculation
- Chronological ordering
- Date/time business rules

**Data Access**
- User records
- People
- Events
- Recurrence configuration
- Reminders
- Preferences

**Background Processing**
- Reminder evaluation
- Notification generation
- Retry handling
- Recurring-event maintenance where required

---

## 4. Core Data Model

A technology-neutral model can start with:

### User
- UserId
- DisplayName
- Email/AccountIdentifier
- TimeZone
- DateFormat
- FirstDayOfWeek
- NotificationPreferences
- CreatedAt
- UpdatedAt

### Person
- PersonId
- UserId
- Name
- Nickname
- Relationship
- ContactInformation
- Notes
- CreatedAt
- UpdatedAt

### Event
- EventId
- UserId
- PersonId (optional)
- CategoryId
- Title
- EventDate
- StartTime (optional)
- EndTime (optional)
- IsAllDay
- Description
- Location
- Recurrence information
- Status
- CreatedAt
- UpdatedAt

### Reminder
- ReminderId
- EventId
- RelativeOffset
- NotificationType
- Enabled
- LastProcessedOccurrence
- CreatedAt
- UpdatedAt

### Category
- CategoryId
- UserId/system ownership
- Name
- Description
- Active

The exact physical schema should be decided after the product decisions are confirmed.

---

## 5. Important Design Decision: Store the Event vs Store Occurrences

The preferred approach is to treat a recurring event as the **definition of an event series**, then calculate its next occurrence when needed.

For example:

```text
Event:
    Title = Mom Birthday
    Date = 15 March
    Recurrence = Yearly

Calculated occurrences:
    15 Mar 2027
    15 Mar 2028
    15 Mar 2029
    ...
```

Avoid creating thousands of future rows simply because an event repeats indefinitely.

Historical occurrences can be materialized only when there is a genuine product requirement for occurrence-level history.

---

## 6. Next Upcoming Event Algorithm

The central calculation should be isolated as a reusable business service.

Conceptually:

```text
Input:
    Current date/time
    User time zone
    User's active events

For each event:
    Determine next valid occurrence
    Ignore deleted/inactive events
    Validate recurrence rules

Sort:
    Next occurrence ascending
    Secondary ordering by event title or stable identifier

Return:
    First event = Next Upcoming Event
    Remaining events = Upcoming Timeline
```

This calculation must handle:

- One-time events
- Annual birthdays
- Monthly recurrence
- Weekly recurrence
- Today
- Tomorrow
- Month-end
- Year-end
- Leap years
- Leap-day birthdays
- Time-zone boundaries
- Events with times
- All-day events

---

## 7. Birthday-Specific Approach

A birthday is a special user experience but does not need a completely separate event engine.

Recommended model:

```text
Person
   |
   +---- Birthday Event
```

The birthday event can contain:

- Month
- Day
- Optional birth year
- Annual recurrence

The birth year should be optional because users may want to remember the birthday without storing age-related information.

If the product later calculates age, it should use the birth year only when available.

---

## 8. Dashboard Approach

The dashboard should have a clear hierarchy.

### Primary area

**Next Up**

Display:

- Person/event name
- Event type
- Date
- Relative time
- Optional reminder indicator

Example:

```text
NEXT UP

Mom's Birthday
Birthday
2 October
in 2 days
```

### Secondary area

**Upcoming**

```text
2 Oct   Mom's Birthday
5 Oct   Doctor Appointment
12 Oct  Anniversary
20 Oct  Team Meeting
```

### Quick actions

- Add Birthday
- Add Event
- Add Person
- View Calendar
- View All Upcoming

---

## 9. Event Creation Flow

Recommended flow:

```text
Choose:
    Birthday
    or
    Other Event

        ↓

Enter basic information

        ↓

Select date/time

        ↓

Optional:
    Person
    Category
    Recurrence
    Reminder
    Notes
    Location

        ↓

Validate

        ↓

Save

        ↓

Calculate next occurrence

        ↓

Return to upcoming list/dashboard
```

The user should receive immediate confirmation that the event was saved.

---

## 10. Edit/Delete Strategy

For a non-recurring event:

```text
Edit Event
Delete Event
```

For recurring events:

```text
Edit this occurrence
Edit entire series
Delete this occurrence
Delete entire series
```

If the first version does not support occurrence-level editing, explicitly state that editing applies to the entire recurring series.

Do not leave recurring-event behaviour ambiguous.

---

## 11. Search and Filtering

Search should be fast and predictable.

Minimum search targets:

- Person name
- Event title
- Category

Recommended filters:

- Date range
- Person
- Category
- Event type
- Recurring/non-recurring

Default result ordering should be chronological for future events.

---

## 12. Reminder Processing

Reminder processing should be separated from the normal page request.

Conceptual flow:

```text
Scheduled processing
       |
Find active reminders
       |
Calculate next occurrence
       |
Determine reminder time
       |
Is reminder due?
    /        \
  No          Yes
  |            |
Stop       Create/send notification
               |
          Record processing result
```

Important requirements:

- Prevent duplicate delivery.
- Respect the user's time zone.
- Retry temporary notification failures.
- Do not lose the event if notification delivery fails.
- Keep notification processing independent from dashboard rendering.

---

## 13. Time Zone Strategy

Time-zone handling is one of the most important technical-independent business decisions.

Recommended rule:

- Store an explicit event time zone where a timed event requires it.
- Otherwise use the user's configured time zone.
- Perform date calculations in the relevant event/user time zone.
- Convert only at the presentation or notification boundary.

Avoid performing all recurrence calculations using an implicit server time zone.

---

## 14. Validation Strategy

Validation should exist at multiple levels:

### UI validation
Immediate user feedback.

### Application validation
Protect business rules regardless of UI.

### Domain validation
Guarantee that invalid event states cannot be accepted.

### Persistence validation
Protect data integrity.

Examples:

- Missing event date → reject.
- End before start → reject.
- Invalid recurrence → reject.
- Reminder outside valid event context → reject.
- Unauthorized event access → reject.

---

## 15. Security Approach

Security should be designed from the beginning.

Minimum principles:

- Every event must have an owner.
- Every read/update/delete operation must verify ownership/authorization.
- Do not rely only on hidden UI controls for authorization.
- Protect account/session operations.
- Validate all incoming data.
- Avoid exposing personal information in logs.
- Apply rate limiting or equivalent protection to authentication-sensitive operations.
- Record security-relevant actions where appropriate.

---

## 16. API / Application Contract Approach

Even if the final application is server-rendered or uses another architecture, define clear use cases.

Example logical operations:

```text
CreatePerson
UpdatePerson
DeletePerson
GetPerson

CreateEvent
UpdateEvent
DeleteEvent
GetEvent

GetUpcomingEvents
GetNextEvent
SearchEvents
FilterEvents

CreateReminder
UpdateReminder
DeleteReminder

GetUserPreferences
UpdateUserPreferences
```

Keep these operations independent from screen-specific behaviour.

---

## 17. UI Component Strategy

Reusable UI components should include:

- Event card
- Person card
- Upcoming event row
- Date selector
- Recurrence selector
- Reminder selector
- Category selector
- Search box
- Filter panel
- Empty-state component
- Confirmation dialog
- Validation summary

This reduces inconsistent behaviour across screens.

---

## 18. Testing Strategy

Testing should be organized around business behaviour rather than only individual screens.

### Unit-level scenarios

Test:

- Next occurrence calculation
- Annual recurrence
- Monthly recurrence
- Weekly recurrence
- Leap years
- Leap-day birthdays
- Year boundaries
- Same-day events
- Time-zone transitions

### Integration scenarios

Test:

- Event creation → persistence → upcoming calculation
- Event update → dashboard refresh
- Recurring event → reminder generation
- Person deletion → linked event behaviour

### UI/UAT scenarios

Test:

- First-time user
- Add birthday
- Add event
- Edit event
- Delete event
- Search
- Filter
- Calendar navigation
- Reminder configuration
- Mobile layout

---

## 19. Test Data Matrix

Use deliberate boundary data.

| Scenario | Example |
|---|---|
| Today | Event occurring today |
| Tomorrow | Event one day ahead |
| Month end | 30/31st |
| Year end | December event |
| New year | January event |
| Leap day | 29 February |
| Multiple events | 5 events on same date |
| Recurring | Annual birthday |
| No events | New user |
| Past event | Yesterday |
| Far future | Event several years ahead |
| Timed event | 10:30 AM |
| All-day | Birthday |

---

## 20. Delivery Phases

### Phase 1 — Foundation

- Product decisions
- UX flows
- Domain model
- User/account lifecycle
- Basic people and event management

### Phase 2 — Core Upcoming Experience

- Next-event calculation
- Dashboard
- Upcoming list
- Search/filter
- Birthday recurrence

### Phase 3 — Reminders

- Reminder configuration
- Processing
- Notification delivery
- Retry and duplicate protection

### Phase 4 — Calendar & Advanced Recurrence

- Calendar view
- Advanced recurrence
- Series/occurrence editing
- Improved filtering

### Phase 5 — Expansion

Potential additions:

- Import/export
- Shared events
- Family groups
- Calendar integrations
- Additional notification channels
- Mobile applications

---

## 21. Definition of Done

A release should not be considered complete until:

- Core event CRUD works.
- Birthday recurrence works.
- Next-event calculation is correct.
- Dashboard ordering is correct.
- Search/filter works.
- Reminder processing is reliable.
- Authorization is enforced.
- Date/time edge cases are tested.
- Responsive behaviour is verified.
- Accessibility checks are completed.
- Error and empty states are covered.
- UAT acceptance criteria are passed.

---

## 22. Recommended Development Order

1. Confirm product decisions.
2. Finalize domain terminology.
3. Define event and recurrence rules.
4. Define data model.
5. Design primary user journeys.
6. Build people management.
7. Build event management.
8. Implement next-occurrence calculation.
9. Build dashboard/upcoming list.
10. Add search and filtering.
11. Add reminders.
12. Add calendar view.
13. Complete security and authorization review.
14. Perform edge-case and UAT testing.
15. Release MVP.
16. Use real user feedback to prioritize Phase 2.

---

## 23. Key Risks

### Risk: Date/recurrence bugs
**Mitigation:** isolate recurrence logic and create extensive boundary tests.

### Risk: Duplicate notifications
**Mitigation:** maintain reminder processing state/idempotency.

### Risk: Incorrect time-zone behaviour
**Mitigation:** make time-zone rules explicit and test across zones.

### Risk: Recurring event edits become confusing
**Mitigation:** clearly distinguish series-level and occurrence-level actions.

### Risk: Dashboard becomes overloaded
**Mitigation:** keep the primary experience focused on the next event and upcoming timeline.

### Risk: Personal data exposure
**Mitigation:** enforce ownership/authorization at every application operation.

---

## 24. Final Product Shape

The simplest useful version should feel like:

```text
+------------------------------------------------+
|                  Upcoming                      |
+------------------------------------------------+
|                                                |
|  NEXT UP                                       |
|                                                |
|  🎂 Mom's Birthday                             |
|  2 October · in 2 days                        |
|                                                |
+------------------------------------------------+
|  UPCOMING                                      |
|                                                |
|  02 Oct   Mom's Birthday                      |
|  05 Oct   Doctor Appointment                  |
|  12 Oct   Anniversary                         |
|  20 Oct   Team Meeting                        |
|                                                |
+------------------------------------------------+
|  [Add Birthday]     [Add Event]               |
+------------------------------------------------+
```

The important product decision is to make **the next upcoming event the centre of the experience**, while still providing enough tools for users to manage the full collection of birthdays and events.


---

## 25. Bonus / Optional DevOps Deployment — Docker & Kubernetes

Docker and Kubernetes are **bonus implementation capabilities**, not mandatory requirements for the initial MVP.

### Docker

The application should, where practical:

- Build into a Docker image.
- Run independently from the developer's local machine configuration.
- Receive configuration through environment variables or external configuration.
- Keep secrets outside the image.
- Provide health/readiness checks.
- Write application logs to standard output/error.
- Avoid relying on the container's local filesystem for persistent business data.

A Docker Compose configuration can optionally be supplied for local development and integration testing.

### Kubernetes

As an optional deployment capability, the application should be deployable to Kubernetes.

Recommended capabilities:

- Deployment configuration.
- Service configuration.
- Configuration through ConfigMaps or equivalent.
- Secrets through Kubernetes Secrets or an equivalent secure mechanism.
- Liveness/readiness probes.
- CPU and memory requests/limits.
- Rolling updates.
- Support for multiple application instances where the application is designed for horizontal scaling.
- Externalized persistent storage for persistent data.

The exact Kubernetes distribution or cloud provider is intentionally not part of the product requirement.

### Optional CI/CD

As a further bonus:

```text
Source Control
      |
Automated Build
      |
Automated Tests
      |
Build Docker Image
      |
Publish Image
      |
Deploy to Environment
      |
Health Check
```

The pipeline may support separate development, UAT, and production deployment configurations.

### Bonus Acceptance Criteria

The optional deployment capability is considered complete when:

1. The application builds successfully as a Docker image.
2. The image can run without source-code modification.
3. Environment-specific settings can be supplied externally.
4. Health/readiness checks are available.
5. Persistent business data survives application-container restarts.
6. Container logs can be collected by the runtime environment.
7. A Kubernetes deployment can start the application successfully.
8. Multiple application instances can run where the application architecture supports horizontal scaling.
9. A new application version can be deployed through a rolling update.
10. Optional CI/CD can build, test, publish, and deploy the application.

### Priority

```text
MVP
 └── Core web application

Quality
 └── Security / Accessibility / Testing / Performance

Phase 2
 └── Calendar / Advanced recurrence / Import / Advanced notifications

BONUS
 ├── Docker
 ├── Docker Compose
 ├── Kubernetes
 └── CI/CD
```

Docker/Kubernetes should therefore be considered an **architectural and deployment bonus**, rather than a dependency of the core product functionality.
