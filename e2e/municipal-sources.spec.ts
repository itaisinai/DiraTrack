import { expect, test } from "@playwright/test";
import { createTestProject, generateTestId, startTestResearchRun, waitForResearchRunComplete, waitForSourceCheckStatus } from "./test-helpers";

test.describe("Municipal sources", () => {
  test("local planning committee is exposed as an implemented manual source", async ({ request }) => {
    const { project } = await createTestProject(request, { testId: generateTestId(), city: "יהוד" });
    const response = await request.get(`/api/projects/${encodeURIComponent(project.currentSlug)}/sources`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    const source = body.sources.find((candidate: { key: string }) => candidate.key === "yehud-local-planning");
    expect(source).toMatchObject({
      isImplemented: true,
      requiresManualAction: true,
      sendsExternalData: false,
    });
  });

  test("worker creates and resolves a focused committee manual action", async ({ request }) => {
    const { project } = await createTestProject(request, {
      testId: generateTestId(),
      city: "יהוד",
      identifiers: [
        { type: "block", value: "6500" },
        { type: "parcel", value: "71" },
        { type: "parcel", value: "78" },
      ],
    });
    const { researchRun } = await startTestResearchRun(request, project.currentSlug, {
      sourceKeys: ["yehud-local-planning"],
      externalDataConsent: false,
    });

    const initialResponse = await request.get(`/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}`);
    const initialBody = await initialResponse.json();
    const sourceCheck = initialBody.sourceChecks.find((candidate: { source: { key: string } }) => candidate.source.key === "yehud-local-planning");
    expect(sourceCheck).toBeDefined();

    await waitForSourceCheckStatus(request, project.currentSlug, researchRun.id, sourceCheck.id, "waiting-for-user");

    const waitingResponse = await request.get(`/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}`);
    const waitingBody = await waitingResponse.json();
    const waitingCheck = waitingBody.sourceChecks.find((candidate: { id: string }) => candidate.id === sourceCheck.id);
    expect(waitingCheck.manualAction).toMatchObject({
      url: "https://yehud.bartech-net.co.il/",
      searchValue: "גוש 6500, חלקות 71, 78",
    });
    expect(waitingCheck.manualAction.description).toContain("אינה מוכיחה");

    const resolveResponse = await request.post(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}/source-checks/${sourceCheck.id}/no-result`,
    );
    expect(resolveResponse.status()).toBe(200);
    await waitForResearchRunComplete(request, project.currentSlug, researchRun.id);

    const completedResponse = await request.get(`/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}`);
    const completedBody = await completedResponse.json();
    expect(completedBody.researchRun.status).toBe("completed");
    expect(completedBody.findings).toHaveLength(0);
  });
});
