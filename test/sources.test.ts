import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createRelay } from "../server/relay.mjs";
import { createDashboard, createSource, manualSource, pollingSource, type Entity } from "../src/core";

const entities: Entity[] = [
  { id: "PT-1", name: "Pressure", type: "PT", category: "process", group: "A", unit: "psi", limits: { hi: [100, 150] } },
];
const cats = [{ key: "process", label: "Process", code: "P", shape: "square" as const }];

describe("relay", () => {
  const relay = createRelay({ prefix: "/api", entities, token: "t0k" });
  let server: http.Server, base = "";
  beforeAll(async () => {
    server = http.createServer(async (req, res) => { if (!(await relay.handle(req, res))) { res.writeHead(404); res.end(); } });
    await new Promise<void>(r => server.listen(0, "127.0.0.1", () => r()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });
  afterAll(() => server.close());

  const post = (body: unknown, token = "t0k") => fetch(`${base}/webhook`, {
    method: "POST", headers: { "content-type": "application/json", "x-webhook-token": token }, body: JSON.stringify(body),
  });

  it("rejects webhooks without the token", async () => {
    expect((await post({ entityId: "PT-1", value: 1 }, "nope")).status).toBe(401);
  });

  it("accepts records and CloudEvents, computes severity, and raises alerts", async () => {
    expect((await post([{ entityId: "PT-1", value: 160 }, { entityId: "PT-1", value: 120 }])).status).toBe(202);
    await post({ specversion: "1.0", id: "e1", source: "ci", type: "deployment.finished", subject: "svc-a", data: { status: "failed" } });
    const page = await (await fetch(`${base}/records?after=0`)).json();
    expect(page.records.map((r: any) => r.severity)).toEqual(["alarm", "warning", "alarm"]);
    expect(page.alerts.map((a: any) => a.entityId).sort()).toEqual(["PT-1", "svc-a"]);
    const snap = await (await fetch(`${base}/snapshot`)).json();
    expect(snap.entities.map((e: any) => e.id)).toContain("svc-a"); // auto-created
  });

  it("feeds a dashboard through the polling source, with server-managed acks", async () => {
    const d = createDashboard({ source: pollingSource({ baseUrl: base, intervalMs: 20, managesAlerts: true }), categories: cats });
    await d.start();
    expect(d.getState().alerts.length).toBeGreaterThan(0);
    relay.ingest({ entityId: "PT-1", value: 90 });
    await new Promise(r => setTimeout(r, 80));
    expect(d.getState().latest["PT-1"].value).toBe(90);
    const id = d.getState().alerts.find(a => a.entityId === "svc-a")!.id;
    await d.acknowledge(id);
    expect(relay.alerts().find((a: any) => a.id === id).acked).toBe(true);
    d.stop();
  });
});

describe("manual and factory sources", () => {
  it("pushes records from app code, buffering until subscribed", async () => {
    const src = manualSource({ entities });
    src.push([{ entityId: "PT-1", value: 120, severity: "warning" }]);
    const d = createDashboard({ source: src, categories: cats });
    await d.start();
    expect(d.getState().latest["PT-1"].value).toBe(120);
    src.push([{ entityId: "PT-1", value: 50, severity: "normal" }]);
    expect(d.getState().latest["PT-1"].value).toBe(50);
    expect(d.getState().alerts[0].state).toBe("rtn");
  });

  it("builds every kind from a spec", () => {
    expect(createSource({ kind: "simulator", entities: [] }).load).toBeTypeOf("function");
    expect(createSource({ kind: "polling", baseUrl: "/api" }).managesAlerts).toBeFalsy();
    expect(createSource({ kind: "webhook", baseUrl: "/api" }).managesAlerts).toBe(true);
    expect(createSource({ kind: "manual", entities: [] }).subscribe).toBeTypeOf("function");
  });
});
