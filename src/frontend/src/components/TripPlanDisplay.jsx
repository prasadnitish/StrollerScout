// Trip-plan presenter:
// - Displays AI itinerary details + weather context.
// - Lets users select approved activities before regenerating packing lists.
// - Keeps selection state local so parent page only handles final approval.
import { useState, useEffect } from "react";

export default function TripPlanDisplay({ tripPlan, weather, onApprove, isVisible }) {
  const [selectedActivities, setSelectedActivities] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isItineraryOpen, setIsItineraryOpen] = useState(false);

  // Initialize selected activities whenever a new plan arrives.
  useEffect(() => {
    if (tripPlan?.suggestedActivities) {
      setSelectedActivities(new Set(tripPlan.suggestedActivities.map((a) => a.id)));
    }
  }, [tripPlan]);

  // Resolve activity IDs in dailyItinerary to their display names.
  const activityNameMap = Object.fromEntries(
    (tripPlan.suggestedActivities || []).map((a) => [a.id, a.name]),
  );

  // Toggle activities used to regenerate the packing list.
  const toggleActivity = (activityId) => {
    const newSelected = new Set(selectedActivities);
    if (newSelected.has(activityId)) {
      newSelected.delete(activityId);
    } else {
      newSelected.add(activityId);
    }
    setSelectedActivities(newSelected);
  };

  const handleApprove = async () => {
    // Sends only approved activities upstream so packing regeneration stays intentional.
    const approved = tripPlan.suggestedActivities.filter((a) =>
      selectedActivities.has(a.id),
    );
    setIsSubmitting(true);
    try {
      await onApprove(approved);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryLabel = (category) => {
    // Friendly labels keep category taxonomy readable without exposing raw keys.
    const labels = {
      beach: "Beach",
      hiking: "Hiking",
      city: "City",
      museums: "Museums",
      parks: "Parks",
      dining: "Dining",
      shopping: "Shopping",
      sports: "Sports",
      water: "Water",
      wildlife: "Wildlife",
      theme_park: "Theme park",
      camping: "Camping",
    };
    return labels[category] || "Activity";
  };

  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted">
          Trip plan
        </p>
        <h3 className="text-xl font-semibold text-paper mt-2">
          Your itinerary
        </h3>
        <p className="text-sm text-muted">{tripPlan.overview}</p>
      </div>

      <div>
        <button
          onClick={() => setIsItineraryOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm uppercase tracking-[0.2em] text-muted transition hover:border-white/30"
        >
          <span>Detailed itinerary</span>
          <span className="text-xs text-muted">
            {isItineraryOpen ? "Hide" : "Show"}
          </span>
        </button>

        {isItineraryOpen && (
          <div className="mt-4 space-y-3">
            {tripPlan.dailyItinerary && tripPlan.dailyItinerary.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-paper mb-3">
                  Suggested Itinerary
                </h4>
                <div className="space-y-3">
                  {tripPlan.dailyItinerary.map((day, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <h5 className="font-semibold text-paper mb-2">
                        {day.day}
                      </h5>
                      {day.activities && day.activities.length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm text-muted">
                            {day.activities
                              .map((id) => activityNameMap[id] || id)
                              .join(", ")}
                          </p>
                        </div>
                      )}
                      {day.meals && (
                        <p className="text-sm text-muted">
                          Meals: {day.meals}
                        </p>
                      )}
                      {day.notes && (
                        <p className="text-xs text-muted mt-2 italic">
                          {day.notes}
                        </p>
                      )}
                      {weather?.forecast?.[index] && (
                        // UI pairs itinerary day and forecast by index from generated outputs.
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted mt-3 pt-2 border-t border-white/10">
                          <span className="text-paper font-medium">
                            {weather.forecast[index].high}° /{" "}
                            {weather.forecast[index].low}°
                          </span>
                          <span>{weather.forecast[index].condition}</span>
                          {weather.forecast[index].precipitation > 0 && (
                            <span className="text-sky-200">
                              {weather.forecast[index].precipitation}% rain
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tripPlan.tips && tripPlan.tips.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-paper mb-3">
                  Helpful Tips
                </h4>
                <ul className="space-y-2">
                  {tripPlan.tips.map((tip, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-muted"
                    >
                      <span className="text-primary-500">●</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {isVisible && (
        <div>
          <h4 className="text-lg font-semibold text-paper mb-4">
            Customize activities
            <span className="text-sm font-normal text-muted ml-2">
              ({selectedActivities.size} selected)
            </span>
          </h4>
          <p className="text-sm text-muted mb-4">
            Select the activities you want to include. We'll regenerate the
            packing list based on your picks.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tripPlan.suggestedActivities.map((activity) => {
              const isSelected = selectedActivities.has(activity.id);

              return (
                <label
                  key={activity.id}
                  className={`cursor-pointer border rounded-2xl p-4 transition-all ${
                    isSelected
                      ? "border-primary-500 bg-primary-500/10"
                      : "border-white/10 bg-white/5 hover:border-white/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleActivity(activity.id)}
                      className="mt-1 h-5 w-5 text-primary-500 rounded focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs uppercase tracking-[0.2em] text-muted">
                            {getCategoryLabel(activity.category)}
                          </span>
                          <h5 className="font-semibold text-paper">
                            {activity.name}
                          </h5>
                        </div>
                        {activity.kidFriendly && (
                          <span className="text-xs bg-emerald-400/20 text-emerald-200 px-2 py-1 rounded-full">
                            Kid-Friendly
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted mt-2">
                        {activity.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted">
                        <span>{activity.duration}</span>
                        {activity.weatherDependent && (
                          <span className="bg-sky-500/20 text-sky-100 px-2 py-0.5 rounded-full">
                            Weather-dependent
                          </span>
                        )}
                      </div>
                      {activity.bestDays && activity.bestDays.length > 0 && (
                        <p className="text-xs text-muted mt-1">
                          Best: {activity.bestDays.join(", ")}
                        </p>
                      )}
                      <p className="text-xs text-muted mt-2 italic">
                        {activity.reason}
                      </p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {isVisible && (
        <>
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleApprove}
              disabled={selectedActivities.size === 0 || isSubmitting}
              className="flex-1 rounded-full bg-primary-500 px-6 py-3 text-sm font-semibold text-ink transition hover:bg-primary-600 disabled:opacity-60"
            >
              {isSubmitting
                ? "Generating Packing List..."
                : `Update Packing List (${selectedActivities.size} activities)`}
            </button>
          </div>

          {selectedActivities.size === 0 && (
            <p className="text-sm text-red-200 text-center">
              Please select at least one activity to continue
            </p>
          )}
        </>
      )}
    </div>
  );
}
