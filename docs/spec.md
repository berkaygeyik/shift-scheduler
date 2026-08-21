# Shift Scheduler — Product & Technical Specification

## 1. Goals and Scope

A weekly shift-scheduling tool for businesses with shift-based staff, such as cafes and restaurants. It supports multiple branches, branch-specific shift templates, employee availability / experience / key-holder information, and both automatic and manual assignment.

**Out of scope (v1):** multi-organization/tenancy, payments/billing, employee accounts/login, native mobile apps. The architecture should be able to grow into these, but none of them are implemented in v1.

**The most important scope decision for v1:** the only role that can sign in is **manager**. Employees (`Employee`) are plain data objects created and edited by managers — they have no accounts, no login, and no in-app approvals. Read-only accounts for employees may be added later ("Phase 3+"), and the design must not prevent that.

**Portfolio / privacy note:** the public demo must not use real coworkers' names or availability data. The public demo runs on fake/anonymous seed data; real usage happens on a private instance.

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Monorepo | pnpm workspaces | Shared types between frontend and backend (`shared-types` package) for end-to-end type safety. Nothing exotic — just the standard way to keep two projects in one repo and share types. |
| Frontend | React + TypeScript + Vite | Fast development, familiar tooling |
| **Styling** | **Tailwind + CSS Modules** | Combines separate `.css` files per component with Tailwind's design system (details below) |
| Server state | TanStack Query (React Query) | Like Redux, but dedicated to server state (caching, refetching, invalidation come for free) |
| Grid/drag-drop | dnd-kit | Modern, accessible, actively maintained |
| Backend | **NestJS** | Modular structure (each domain — branch, employee, schedule — lives in its own module), dependency injection, decorator-based routing. A steeper learning curve than Express, but it demonstrates "real architecture" more convincingly. |
| ORM | **Prisma** | Best fit for PostgreSQL + TypeScript: migrations are managed automatically, the schema becomes TS types, and `schema.prisma` doubles as readable documentation. Alternatives (TypeORM/Drizzle) exist, but Prisma is the least surprising and has the largest community. |
| DB | PostgreSQL (Neon/Supabase managed) | Relational data; the free tier is enough |
| Auth | JWT (short-lived access) + refresh token (httpOnly cookie, rotated) | Only **managers** log in in v1, so the auth surface is small — less code, less risk |
| Deploy | Frontend: Vercel · Backend: Railway/Render/Fly.io · DB: Neon/Supabase | All start on free tiers |
| Test | Vitest/Jest, especially for the scheduling engine | Required — see section 9 |

### Styling approach (details)
Every component gets its own `Component.module.css` file next to it (CSS Modules). Tailwind is not used as long `className="flex items-center px-4..."` strings inside JSX; instead it is used through `@apply` directives inside those `.css` files:

```css
/* ScheduleCell.module.css */
.cell {
  @apply flex items-center justify-center rounded-md text-sm font-medium;
}
.cellLocked {
  @apply border-2 border-amber-400;
}
```

This keeps Tailwind's consistent design system (color palette, spacing scale), keeps JSX clean, and lets styles live in their own file next to each component. CSS-in-JS (styled-components etc.) and inline `style={{}}` are not used.

---

## 3. Roles and Authorization (v1 — simplified)

**The only type that can log in in v1 is `User` (role: manager).** An organization can have several managers (e.g. two shift leads), each assigned to specific branch(es).

- **Sign-up flow:** simple — a manager creates their own account (or the organization owner invites other managers by email). There is **no** invite/sign-up flow for employees.
- **Employee:** cannot log in and has no account. All of their data (name, employment type, availability, experience) is entered and edited by a manager.
- **Authorization — two layers:**
  1. Role-based: with a single role in v1 this layer is simple for now, but the code is structured around role-check middleware so an `employee-viewer` role can be added later.
  2. Resource (branch) based: a manager can only access data for the branch(es) they are assigned to.
- **Hashing:** bcrypt, at least 10 salt rounds.

**Later (Phase 3+, not now):** read-only accounts for employees (seeing only their own weekly schedule). Adding an `employee_id` reference to `User` and a `role: employee-viewer` would be enough — the current design does not rule it out, but it is not part of v1.

---

## 4. Data Model

```
Organization (a single row in v1, can be multiplied later)
  id, name

User  (MANAGERS ONLY — the only type that can log in in v1)
  id, organization_id, full_name, email, password_hash, role (manager)

UserBranch (junction) -- which manager manages which branches
  user_id, branch_id

Branch
  id, organization_id, name, timezone

ShiftTemplate
  id, branch_id, name (e.g. "Morning"), start_time, end_time,
  required_staff_count, requires_key_holder (bool),
  is_opening (bool), is_closing (bool), active (bool)
  -- each branch defines its own number of shifts, hours, and head count

Employee   (NO LOGIN — a plain data object created/edited by a manager)
  id, organization_id, full_name, phone (optional),
  employment_type (enum: minijob / parttime / fulltime),
  start_date,                       -- seniority (in months) is derived from this
  can_work_alone (bool),            -- whether they can work a shift alone
  experience_score (1-10),          -- assigned by the manager; can_work_alone,
                                     -- seniority and employment_type are shown in the UI
                                     -- as "suggestions", but the final call is the
                                     -- manager's subjective judgment
  is_key_holder (bool),
  target_shifts_per_week (int, nullable),
  is_default_roster_member (bool),  -- part of the routine schedule or not
  status (active/inactive)

EmployeeBranch (junction, many-to-many)
  employee_id, branch_id, is_home_branch (bool)
  -- moving between branches is modeled here

EmployeeAvailability
  id, employee_id, week_start_date (nullable -> null means a recurring "every week" rule),
  day_of_week, shift_template_id (nullable -> whole day),
  status (available / unavailable),
  note (optional -- e.g. "told me verbally / via WhatsApp")
  entered_by_user_id            -- which manager entered it
  -- recurring rules and week-specific overrides live in the same table;
  -- a week-specific record overrides the recurring rule
  -- in v1 these records are ALWAYS entered by a manager (employees cannot enter them)

WeeklyRosterOverride
  id, branch_id, week_start_date, employee_id, action (add_temporary / exclude)
  -- for "add an extra person this week" or "remove from the default roster this week";
  -- with no record, employee.is_default_roster_member applies

ShiftAssignment
  id, branch_id, week_start_date, day_of_week, shift_template_id,
  employee_id (nullable -> empty slot),
  is_key_holder_for_shift (bool),
  locked (bool),                    -- manually touched / a slot auto-fill must not overwrite
  needs_key_handover (bool, computed) -- true if the previous closing key holder differs
                                        -- from this opening key holder (hand-over needed)
  understaffed (bool, computed)     -- true if required_staff_count could not be met
  created_by (manual / auto)

AuditLog (v3 / optional)
  id, actor_user_id, action, entity, entity_id, timestamp, diff
```

**Relationship summary:** Branch 1—N ShiftTemplate · Branch N—M Employee (via EmployeeBranch) · Employee 1—N EmployeeAvailability · Branch+Week 1—N ShiftAssignment · User N—M Branch (UserBranch)

---

## 5. Feature List → Phase Mapping

### Phase 1 — Core Loop (MVP)
- [ ] Auth: manager login, JWT + refresh (no employee login)
- [ ] Branch CRUD (manager)
- [ ] ShiftTemplate CRUD — a different number of shifts/hours/head count per branch (**key feature #1**)
- [ ] Employee CRUD (by the manager, including employment_type/start_date/can_work_alone) + branch assignment
- [ ] Employee availability entry — **by the manager, manually, on the employee's behalf** (**#2**)
- [ ] Employee.target_shifts_per_week field and comparison with the actual count (**#3**)
- [ ] Manual schedule grid: days horizontally, people vertically, shift + time range in each cell (**#12**)
- [ ] Simple "fill empty slots" — without the rules engine, availability only

### Phase 2 — Business Rules
- [ ] experience_score (1-10) field + senior/junior pairing in auto-assign (**#4**)
- [ ] is_key_holder + requiring a key holder on opening/closing shifts (**#5**)
- [ ] needs_key_handover computation and a UI warning — the hand-over happens in person, the app only flags it (**#6**)
- [ ] Moving between branches — multiple EmployeeBranch records (**#7**)
- [ ] Full automatic assignment (auto-assign engine) (**#8**)
- [ ] Partial re-assignment: keep locked/filled slots, randomly re-fill the deleted ones (**#9**)
- [ ] Mixed manual + automatic filling mode (**#10**)
- [ ] Two modes: "fill empty slots" vs "randomly fill everything" (**#11**)
- [ ] Default roster vs temporary weekly additions (WeeklyRosterOverride) (**#13**)
- [ ] Night→morning minimum rest rule (hard constraint, manager can override) (**#14**)
- [ ] One shift per day rule (hard constraint) (**#15**)
- [ ] If `required_staff_count` cannot be met: the slot is marked `understaffed`, the manager is notified, and the system suggests alternative candidates (by relaxing a constraint or from another branch)

### Phase 3 — Polish / Differentiation
- [ ] Alternative implementation of the fairness algorithm with OR-Tools (CP-SAT) + a comparison write-up
- [ ] Email notifications (when a schedule is published, key hand-over reminders)
- [ ] PWA (installable)
- [ ] **Read-only employee account** (optional extension — seeing their own schedule)
- [ ] CI (GitHub Actions) + test coverage badge
- [ ] Visual polish (animations, empty states, loading skeletons)

---

## 6. Scheduling Engine Design

### Hard constraints (never violated)
1. An employee can take at most 1 shift per day.
2. An employee cannot be assigned to a day/shift that the manager has marked "unavailable" on their behalf.
3. A slot on an opening shift must have an employee with `is_key_holder=true` (same for closing).
4. An employee on a night closing shift cannot be assigned to the next morning's opening shift — unless the manager explicitly marks a "forced override" (the employee's consent is not sought through the app; that is the manager's verbal/external decision).
5. `required_staff_count` is attempted for every shift; if it cannot be met, the slot is marked `understaffed=true`, shown to the manager in the UI, and the system suggests alternative candidates (e.g. candidates with a relaxed constraint, or available staff from another branch).

### Soft constraints (optimized, scored)
1. Fairness: an employee's actual shift count should be close to `target_shifts_per_week`.
2. Seniority pairing: on 2-person shifts, at least one person with a high `experience_score` is preferred.
3. Balance with previous weeks (weighted by historical data in v3).

### Algorithm approach (v1 — Phase 2)
Greedy + randomized backtracking, implemented as pure TypeScript functions (independent of the NestJS service, easy to test):
1. Treat locked/filled slots as fixed.
2. For each empty slot, in order: among the candidates that pass the hard constraints, pick the best one by soft-constraint score (largest fairness gap + compatible seniority first).
3. Break ties between equally scored candidates randomly (this gives the "re-running yields a different but valid result" behavior — required for **#9**).
4. If a slot cannot be solved, leave it empty, mark it `understaffed=true`, log the reason (e.g. "nobody is available"), and produce a list of alternative candidates.

**Partial re-assignment (#9) pseudocode:**
```
function regenerate(weekAssignments, deletedSlotIds):
  locked = weekAssignments.filter(a => a.locked || (a.employeeId && !deletedSlotIds.includes(a.id)))
  emptySlots = weekAssignments.filter(a => deletedSlotIds.includes(a.id) || a.employeeId === null)
  for slot in shuffle(emptySlots):
    candidate = pickBestCandidate(slot, locked, hardConstraints, softConstraints)
    assign(slot, candidate)
    locked.push(slot)
```

**Key hand-over logic:** the hand-over itself (who gives the key to whom, and how) happens outside the app — the system does not track it. It only sets `needs_key_handover=true` and shows a UI warning when **the key holder on a closing shift differs from the key holder on the next opening shift**. A detailed hand-over flow (who handed it to whom) is out of scope for v1.

**v3 alternative:** the same problem can be modeled with Google OR-Tools CP-SAT in a Python microservice called from the Node backend — a good opportunity for a "simple heuristic vs. a real constraint solver" case study.

---

## 7. API Design (high level)

```
POST   /auth/login                    (managers only)
POST   /auth/refresh
POST   /auth/invite-manager           (the organization owner invites another manager)

GET    /branches
POST   /branches
PATCH  /branches/:id

GET    /branches/:id/shift-templates
POST   /branches/:id/shift-templates
PATCH  /shift-templates/:id

GET    /employees?branchId=
POST   /employees                     (including employment_type, start_date, can_work_alone, experience_score)
PATCH  /employees/:id
POST   /employees/:id/branches        (add/remove an EmployeeBranch)

GET    /availability?employeeId=&weekStart=
PUT    /availability                  (bulk upsert by the manager)

GET    /schedule?branchId=&weekStart=
POST   /schedule/auto-fill            (body: { mode: "fill_empty" | "randomize_all", weekStart, branchId })
PATCH  /schedule/assignments/:id      (manual edit, lock toggle)
DELETE /schedule/assignments/:id      (empty the slot)
GET    /schedule/assignments/:id/alternatives   (alternative candidate suggestions for an understaffed slot)

GET    /roster/weekly?branchId=&weekStart=
POST   /roster/weekly/override        (temporary add / removal)
```

---

## 8. Frontend Screens

1. **Login** (manager)
2. **Branch & shift template settings** (manager) — the list of shifts per branch, time ranges, required head count, key requirement
3. **Employee management** (manager) — CRUD, branch assignment, employment_type, seniority, can_work_alone, experience_score (a suggestion is shown, manually editable), key-holder flag, default roster membership
4. **Weekly availability entry** (manager, on the employee's behalf) — for each employee, mark which days/shifts they are available or unavailable that week
5. **Schedule grid** (manager, main screen) — days horizontally, people vertically, shift name + time in each cell; manual assignment by drag-and-drop; lock icon on slots; "Fill Empty Slots" and "Randomize All" buttons; warning + alternative suggestions on understaffed slots; a visual warning where a key hand-over is needed
6. **Weekly roster management** — remove from the default list / add temporarily

---

## 9. Testing Strategy

Yes, tests are worth writing — both as a good engineering habit and as concrete evidence to show in interviews:
- **Scheduling engine:** unit tests cover every hard constraint separately (night-to-morning clash, one shift per day, key-holder requirement, understaffed marking). This is where business-logic coverage is most visible, because there are many rules and many edge cases.
- **API:** NestJS e2e tests (auth flow, authorization boundaries — including a manager being unable to access another branch).
- **Frontend:** component tests for critical flows (auto-fill, manual assignment) — not a priority, added if time allows.

---

## 10. v1 Scope Decisions (settled)

1. **Experience score:** 1-10, assigned by the manager. `can_work_alone`, seniority (months), and `employment_type` are shown in the UI as "suggestions", but the final decision is always the manager's subjective judgment.
2. **Night→morning override approval:** the employee's consent is not sought through the app (there is no employee account anyway). The manager makes the call and, if needed, asks the employee outside the app (verbally/WhatsApp).
3. **Employee login:** not in v1. All data is entered by a manager. A read-only account may be added later (Phase 3+); the architecture does not rule it out.
4. **If `required_staff_count` cannot be met:** the slot is marked `understaffed`, the manager is notified, and the system suggests alternative candidates.
5. **Key hand-over:** happens physically, in person, outside the app. The system only flags a mismatch between the closing and opening key holders and does not track the hand-over process itself.
