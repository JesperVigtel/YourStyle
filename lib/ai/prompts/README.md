# Prompts

One file per AI task. Each exports a `system` string and a `user(...)` builder that returns the text
part of the request (images are attached separately by the task in `lib/ai/tasks/`).

Tuning tips:

- The response shape is enforced by the schema in `lib/ai/schemas.ts` (structured outputs). You don't
  need to describe the JSON format here; describe _judgement_ instead.
- Item ids are short aliases (`i1`, `i2`, …) mapped back to real ids after the response. Ids the model
  invents are dropped automatically.
- Keep the system prompts stable (no dates or per-request data) so prompt caching can kick in later.
