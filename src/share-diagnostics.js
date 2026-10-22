/** These are local request attempts, never an estimate of Ecowitt's click balance. */
export function activitySensors(activity) {
  return [
    { key: "share_initializations", name: "Freigabe-Initialisierungen", value: activity.initializations },
    { key: "measurement_requests", name: "Messwertabfragen", value: activity.measurementRequests }
  ];
}
