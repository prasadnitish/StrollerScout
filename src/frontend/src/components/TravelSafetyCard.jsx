// Safety guidance presenter:
// - Summarizes jurisdiction-level car seat guidance.
// - Surfaces per-child recommendation status with source transparency metadata.
// - Emphasizes that output is informational, not legal advice.
function statusClasses(status) {
  // Visual severity mapping for quick scanning of confidence/availability.
  if (status === "Verified") {
    return "border-emerald-400/40 bg-emerald-500/10 text-emerald-100";
  }

  if (status === "Needs review") {
    return "border-amber-400/40 bg-amber-500/10 text-amber-100";
  }

  return "border-red-400/40 bg-red-500/10 text-red-100";
}

function prettySeatPosition(seatPosition) {
  // Converts backend enum values into plain-language seat-position guidance.
  const labels = {
    rear_seat_required_if_available: "Rear seat required when available",
    rear_seat_required_under_8: "Rear seat required for children under 8",
    rear_seat_required_under_13: "Rear seat required for children under 13",
    rear_seat_recommended: "Rear seat recommended",
    rear_seat_preferred: "Rear seat preferred",
    not_found: "Not found in repo",
  };

  return labels[seatPosition] || seatPosition;
}

export default function TravelSafetyCard({ safetyGuidance }) {
  // Render nothing when safety guidance is absent to avoid empty UI chrome.
  if (!safetyGuidance) {
    return null;
  }

  const {
    status,
    jurisdictionCode,
    jurisdictionName,
    message,
    sourceUrl,
    effectiveDate,
    lastUpdated,
    results = [],
  } = safetyGuidance;

  return (
    <div className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            Travel safety
          </p>
          <h3 className="text-xl font-semibold text-paper mt-2">
            Car seat and booster guidance
          </h3>
          <p className="text-sm text-muted mt-1">
            Jurisdiction: {jurisdictionName || "Not found in repo"}
            {jurisdictionCode ? ` (${jurisdictionCode})` : ""}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${statusClasses(
            status,
          )}`}
        >
          {status || "Unavailable"}
        </span>
      </div>

      {message && (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted">
          {message}
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((result) => (
            <article
              key={result.childId}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="text-sm uppercase tracking-[0.2em] text-muted">
                  {result.childId}
                </h4>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${statusClasses(
                    result.status,
                  )}`}
                >
                  {result.status}
                </span>
              </div>

              <p className="mt-3 text-base font-semibold text-paper">
                {result.requiredRestraintLabel || "Not found in repo"}
              </p>

              <p className="mt-1 text-sm text-muted">
                {prettySeatPosition(result.seatPosition || "not_found")}
              </p>

              {typeof result.ageYears === "number" && (
                <p className="mt-1 text-xs text-muted">
                  Age: {result.ageYears} years
                  {Number.isFinite(result.weightLb)
                    ? `, Weight: ${result.weightLb} lb`
                    : ", Weight: Not found in repo"}
                  {Number.isFinite(result.heightIn)
                    ? `, Height: ${result.heightIn} in`
                    : ", Height: Not found in repo"}
                </p>
              )}

              <p className="mt-2 text-sm text-muted">{result.rationale}</p>
            </article>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-muted space-y-1">
        <p>Effective date: {effectiveDate || "Not found in repo"}</p>
        <p>Last updated: {lastUpdated || "Not found in repo"}</p>
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary-500 hover:text-primary-400"
          >
            Official source
          </a>
        ) : (
          <p>Official source: Not found in repo</p>
        )}
        <p>
          This is informational guidance. Verify legal requirements before
          travel.
        </p>
      </div>
    </div>
  );
}
