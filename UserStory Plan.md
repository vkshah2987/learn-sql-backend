Overview
This document contains a detailed sprint plan and user stories (US) for backend development of the AI-driven Learn SQL Web App. It focuses on Node.js (recommended NestJS), PostgreSQL schema interactions, AI orchestration endpoints, validator adapters, and admin utilities. Each user story includes description, acceptance criteria, API contract (request/response), DB tables involved, and implementation notes.
Sprint Plan (MVP-focused)
Sprint length: 2 weeks (recommended). Suggested 3 sprints for backend MVP.
Sprint 1 - Core API + Auth + Lessons
•	- Project scaffolding (NestJS or Express)
•	- Auth (register/login) with JWT
•	- Postgres schema creation (users, lessons, exercises)
•	- Lessons endpoints: GET /lessons, GET /lessons/:slug
•	- Admin endpoints to seed initial lessons (protected)
Sprint 2 - Practice & Evaluation (Stub AI + Validator)
•	- Implement /practice/evaluate endpoint that orchestrates evaluation (initially with stubbed AI)
•	- Attempts and progress tables (attempts, progress)
•	- Validator adapter using lightweight SQLite or sandbox Postgres schema
•	- Store attempts and basic feedback
Sprint 3 - AI Integration + Adaptive Logic + Admin Tools
•	- Integrate Ollama/local LLM via AI adapter
•	- Adaptive difficulty logic and learning_events table
•	- Tutor chat endpoint /tutor/chat
•	- Admin reset/seed utilities and rate-limiting
•	- Metrics/logging and basic observability
User Stories (Backend)
US-Auth-001 - User Registration API
Description: Allow new users to register with email and password, storing secure password hash and returning JWT.
Acceptance Criteria:
•	- POST /auth/register returns 201 with user object and JWT when valid details are provided.
•	- Password hashed using bcrypt (or argon2) before storing.
•	- Email uniqueness enforced; duplicate returns 409.
•	- Invalid input returns 400 with validation errors.
API Contract / Adapter:
Endpoint: POST /api/v1/auth/register
Request schema / example:
{'email': 'string (valid email)', 'password': 'string (min 8 chars)', 'displayName': 'string (optional)'}
Response schema / example:
N/A
DB Tables Involved: users
Implementation Notes: Use class-validator (NestJS) or Joi/Zod. Use bcrypt with salt rounds >= 10.
US-Auth-002 - User Login API
Description: Authenticate user with email/password and issue JWT access token and optional refresh token.
Acceptance Criteria:
•	- POST /auth/login returns 200 with token and user on valid credentials.
•	- Invalid credentials return 401.
•	- Account lockout after configurable failed attempts (optional)
API Contract / Adapter:
Endpoint: POST /api/v1/auth/login
Request schema / example:
{'email': 'string', 'password': 'string'}
Response schema / example:
{'user': {'id': 'uuid', 'email': 'string'}, 'token': 'jwt-token'}
DB Tables Involved: users
Implementation Notes: Implement JWT with expiry (e.g., 15m) and refresh token if desired.
US-Lessons-001 - List Lessons API
Description: Return ordered list of active lessons with basic metadata.
Acceptance Criteria:
•	- GET /lessons returns 200 and array of lessons ordered by order_index.
•	- Only active lessons returned by default.
•	- Supports query param ?includeDrafts=true for admin.
API Contract / Adapter:
Endpoint: GET /api/v1/lessons
Request schema / example:
N/A
Response schema / example:
[{'id': 'uuid', 'slug': 'string', 'title': 'string', 'summary': 'string', 'order_index': 1, 'tags': ['select']}]
DB Tables Involved: lessons
Implementation Notes: Paginate if list grows; cache responses with short TTL.
US-Lessons-002 - Get Lesson Detail API
Description: Return lesson content and its exercises.
Acceptance Criteria:
•	- GET /lessons/:slug returns lesson content JSONB and exercises ordered by order_index.
•	- 404 when slug not found.
API Contract / Adapter:
Endpoint: GET /api/v1/lessons/{slug}
Request schema / example:
N/A
Response schema / example:
{'lesson': {'id': 'uuid', 'slug': 'string', 'title': 'string', 'content': 'jsonb'}, 'exercises': [{'id': 'uuid', 'prompt': 'text', 'difficulty': 'intro'}]}
DB Tables Involved: lessons, exercises
Implementation Notes: Strip any admin-only fields from response. Ensure content JSON schema validation on write.
US-Practice-001 - Evaluate SQL Submission (Initial Stub)
Description: Endpoint to receive SQL submissions; initially return stubbed evaluation until AI/validator available.
Acceptance Criteria:
•	- POST /practice/evaluate accepts {exerciseId, sql, mode} and returns 200 with isCorrect:false and helpful feedback (mock).
•	- Request validated; missing params return 400.
API Contract / Adapter:
Endpoint: POST /api/v1/practice/evaluate
Request schema / example:
{'exerciseId': 'uuid', 'sql': 'string', 'mode': 'evaluate|explain'}
Response schema / example:
{'isCorrect': False, 'feedback': 'This is a stub response. Replace with AI evaluation.'}
DB Tables Involved: attempts, exercises
Implementation Notes: Useful for frontend integration; persist attempts with is_correct=false and feedback stub.
US-Practice-002 - Validator Adapter (SQLite/Postgres sandbox)
Description: Implement validator that can execute submitted SQL in isolated environment and return normalized results or errors.
Acceptance Criteria:
•	- Validator.run(sql) returns {error:null, result:{columns:[], rows:[]}} for valid queries.
•	- For disallowed operations (DROP, ALTER) it returns an error with code FORBIDDEN.
•	- Execution timeouts handled and return error.
API Contract / Adapter:
Adapter: internal service method validator.run(sql, options)
Request schema / example:
N/A
Response schema / example:
{'error': None, 'result': {'columns': ['id', 'name'], 'rows': [[1, 'A']]}}
DB Tables Involved: sandbox (seeded schemas)
Implementation Notes: Prefer SQLite in-memory for fast unit tests; use Postgres sandbox for feature parity. Enforce statement whitelist.
US-Practice-003 - Full Evaluate: AI + Validator Orchestration
Description: Implement full evaluation flow: pre-checks, validator execution, compare to expected, call AI for feedback, persist attempt and return result.
Acceptance Criteria:
•	- Valid submission returns 200 with isCorrect true/false, feedback, resultPreview, and nextSuggestion when applicable.
•	- If SQL has syntax/runtime error, return isCorrect=false with AI explanation.
•	- Result comparison uses canonical normalization and checksum.
API Contract / Adapter:
Endpoint: POST /api/v1/practice/evaluate
Request schema / example:
{'exerciseId': 'uuid', 'sql': 'string', 'mode': 'evaluate|explain'}
Response schema / example:
{'isCorrect': True, 'feedback': 'Good job! You selected required columns and ordering.', 'resultPreview': {'columns': ['name', 'age'], 'rows': [['Alice', 30], ['Bob', 25]]}, 'nextSuggestion': {'type': 'difficulty_up', 'suggestedExerciseId': 'uuid'}}
DB Tables Involved: attempts, exercises, progress, learning_events
Implementation Notes: Cache AI feedback for identical submissions by hash. Implement rate-limiting and async retries to LLM.
US-Progress-001 - Track Progress & Mark Complete
Description: Update user's lesson progress after successful exercise completion or manual marking.
Acceptance Criteria:
•	- POST /progress/complete marks lesson as completed for the user and returns updated progress.
•	- Progress uniqueness enforced (user_id + lesson_id).
•	- Score aggregated from attempts stored.
API Contract / Adapter:
Endpoint: POST /api/v1/progress/complete
Request schema / example:
{'lessonId': 'uuid', 'scoreDelta': 'int'}
Response schema / example:
{'lessonId': 'uuid', 'status': 'completed', 'score': 45}
DB Tables Involved: progress, attempts
Implementation Notes: Consider storing per-exercise scores for more granular analytics.
US-AI-001 - Tutor Chat Endpoint (AI)
Description: Provide chat-like tutoring using the LLM for contextual Q&A related to lessons and queries.
Acceptance Criteria:
•	- POST /tutor/chat returns coherent reply and references if applicable.
•	- Context parameter (lessonId, lastSql) improves answer relevance.
•	- Reject or safely handle harmful/invalid prompts.
API Contract / Adapter:
Endpoint: POST /api/v1/tutor/chat
Request schema / example:
{'message': 'string', 'context': {'lessonId': 'uuid', 'lastSql': 'string'}}
Response schema / example:
{'reply': 'string', 'references': ['lesson_slug_or_id'], 'followups': ['Try this query...']}
DB Tables Involved: learning_events, attempts (optional)
Implementation Notes: Implement system prompt, temperature control, and token limits. Sanitize user-provided SQL from injection before sending to AI.
US-Admin-001 - Admin Seed & Reset Utilities
Description: Admin endpoints to seed initial lessons/exercises and reset sandbox validator schemas.
Acceptance Criteria:
•	- POST /admin/seed seeds lessons and exercises (idempotent).
•	- POST /admin/validator/reset resets sandbox to known state.
•	- Access restricted to admin role.
API Contract / Adapter:
Endpoint: POST /api/v1/admin/seed
Request schema / example:
N/A
Response schema / example:
{'status': 'ok', 'seededLessons': 5}
DB Tables Involved: lessons, exercises, sandbox schemas
Implementation Notes: Protect with admin JWT claim and implement audit logging.
Non-Functional Requirements
•	- Latency: /practice/evaluate should aim for < 2s (stub) and < 5s with AI in typical cases.
•	- Scalability: Design stateless Node.js API for horizontal scaling; keep AI layer stateless where possible.
•	- Security: Sanitize inputs, rate-limit AI endpoints, use HTTPS, store credentials hashed.
•	- Observability: Structured logs, request tracing for AI calls, metrics on AI error rates.
•	- Cost: Cache AI responses for identical submissions to reduce LLM calls.
