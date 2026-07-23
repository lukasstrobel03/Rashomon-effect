export interface AnalyticsEvent {
    userId: string;
    experimentTag: "managementInsights" | "managementInsights2" | "predictionGame"
    commitHash: string;
    type: string;
    payload: object;
    group: string;
}

export async function sendAnalyticsEvent(analyticsEvent: AnalyticsEvent) {
    console.log("sendAnalyticsEvent called with event", analyticsEvent)
    try {
        const response = await fetch("/analytics", {
            method: "POST", body: JSON.stringify(analyticsEvent)
        })
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
    }
    catch (error) {
        console.error((error as Error).message);
  }
}