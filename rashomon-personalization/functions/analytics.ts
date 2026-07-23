import {AnalyticsEvent} from "../src/Experiment/analytics";

interface Env {
    AnalyticsStore: D1Database;
}

export const onRequest : PagesFunction<Env>  = async ({request, env}): Promise<Response> => {
    try {
        const event: AnalyticsEvent = await request.json();
        const result = await env.AnalyticsStore.prepare(
            "INSERT INTO AnalyticsEvents (timestamp, userId, experimentTag, commitHash, type, payload, group) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(Date.now(), event.userId, event.experimentTag, event.commitHash, event.type, JSON.stringify(event.payload), event.group).run();

        return new Response("Analytics event inserted successfully!", { status: 201 });
    } catch (error) {
        return new Response(`Error inserting event: ${(error as Error).message}`, { status: 500 });
    }
}

export default {
  async fetch(request: any): Promise<Response> {
    if (request.method === "POST" && new URL(request.url).pathname === "/analytics") {
    }
    return new Response("Endpoint not found", { status: 404 });
  },
};