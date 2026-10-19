import { setTimeout } from "node:timers/promises";
import { HttpError } from "../http.mjs";

// New Community Hub returns a scoped job capability, then the actual answer
// in job.response. Keep that capability server-side and preserve cancellation.
export async function completeAssistantJob(payload, origin, signal) {
  if (!payload.job) return payload;
  const { id, status_token: token } = payload.job;
  if (typeof id !== "string" || !id || typeof token !== "string" || !token)
    throw new HttpError(502, "assistant_invalid_job");
  for (;;) {
    const job = payload.job;
    if (job?.id !== id) throw new HttpError(502, "assistant_invalid_job");
    if (job.status === "done") {
      if (!job.response || job.response.ok !== true)
        throw new HttpError(502, "assistant_upstream_failed");
      return job.response;
    }
    if (job.status === "failed")
      throw new HttpError(502, "assistant_upstream_failed");
    if (!["queued", "running"].includes(job.status))
      throw new HttpError(502, "assistant_invalid_job");
    await setTimeout(1500, undefined, { signal });
    const response = await fetch(`${origin}/api/intel/job-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }), signal,
    });
    if (!response.ok) throw new HttpError(502, "assistant_job_unavailable");
    payload = await response.json();
    if (payload.ok !== true) throw new HttpError(502, "assistant_job_unavailable");
  }
}
