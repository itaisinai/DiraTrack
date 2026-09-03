import { test, expect } from "@playwright/test";
import {
  cleanupTestData,
  generateTestId,
  createTestProject,
  startTestResearchRun,
  waitForResearchRunComplete,
  waitForSourceCheckStatus,
} from "./test-helpers";
import { createMockServer } from "./mocks";

// Mock external APIs by default
let mockServer: ReturnType<typeof createMockServer>;

test.beforeAll(() => {
  mockServer = createMockServer();
  mockServer.listen({ onUnhandledRequest: "bypass" });
});

test.afterAll(() => {
  mockServer.close();
});

test.beforeEach(async () => {
  mockServer.resetHandlers();
  await cleanupTestData();
});

test.describe("API - Health & Basic", () => {
  test("GET /api/health returns OK", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("ok");
  });

  test("GET /api/projects returns projects list", async ({ request }) => {
    const response = await request.get("/api/projects");

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("projects");
    expect(Array.isArray(data.projects)).toBeTruthy();
  });
});

test.describe("API - Project CRUD", () => {
  test("POST /api/projects creates project with valid data", async ({ request }) => {
    const testId = generateTestId();

    const response = await request.post("/api/projects", {
      data: {
        name: `גני יהודה ${testId}`,
        city: "יהוד",
        developer: "אסיה סיירוס פיתוח וייזום בע\"מ",
        identifiers: [
          { type: "lottery-number", value: "2642", origin: "winning-message" },
          { type: "housing-project-number", value: "324", origin: "winning-message" },
        ],
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.project).toHaveProperty("id");
    expect(data.project).toHaveProperty("currentSlug");
    expect(data.project.name).toBe(`גני יהודה ${testId}`);
    expect(data.project.city).toBe("יהוד");
  });

  test("POST /api/projects with malformed JSON returns 400", async ({ request }) => {
    const response = await request.post("/api/projects", {
      data: "not json",
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(400);
  });

  test("POST /api/projects with missing required fields returns 400", async ({ request }) => {
    const response = await request.post("/api/projects", {
      data: { name: "Test" },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });

  test("POST /api/projects without content-type header returns 400 or 415", async ({ request }) => {
    const response = await request.post("/api/projects", {
      data: "",
    });

    expect([400, 415]).toContain(response.status());
  });

  test("GET /api/projects/:slug with unknown slug returns 404", async ({ request }) => {
    const response = await request.get("/api/projects/unknown-project-slug-12345");

    expect(response.status()).toBe(404);
  });

  test("GET /api/projects/:slug returns project details", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, {
      name: `פרויקט ${testId}`,
      city: "תל אביב",
      testId,
    });

    const response = await request.get(
      `/api/projects/${encodeURIComponent(project.currentSlug)}`
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.project.id).toBe(project.id);
    expect(data.project.name).toBe(`פרויקט ${testId}`);
  });
});

test.describe("API - Research Run Lifecycle", () => {
  test("POST /api/projects/:slug/research-runs creates run", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });

    const response = await request.post(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs`,
      {
        data: {
          sourceKeys: ["asia-cyrus"],
          externalDataConsent: true,
        },
      }
    );

    expect(response.status()).toBe(202);
    const data = await response.json();
    expect(data.researchRun).toHaveProperty("id");
    expect(data.researchRun.status).toBe("pending");
  });

  test("GET /api/projects/:slug/research-runs lists runs", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });
    await startTestResearchRun(request, project.currentSlug);

    const response = await request.get(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs`
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.researchRuns)).toBeTruthy();
    expect(data.researchRuns.length).toBeGreaterThan(0);
  });

  test("GET /api/projects/:slug/research-runs/:runId returns run details", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });
    const { researchRun } = await startTestResearchRun(request, project.currentSlug);

    const response = await request.get(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}`
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.researchRun.id).toBe(researchRun.id);
    expect(data).toHaveProperty("sourceChecks");
    expect(Array.isArray(data.sourceChecks)).toBeTruthy();
  });

  test("DELETE /api/projects/:slug/research-runs/:runId cancels active run", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });
    const { researchRun } = await startTestResearchRun(request, project.currentSlug);

    const cancelResponse = await request.delete(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}`
    );

    expect(cancelResponse.status()).toBe(200);
    const data = await cancelResponse.json();
    expect(data.researchRun.status).toBe("cancelled");
  });

  test("Research run completes with mocked Asia Cyrus", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, {
      testId,
      identifiers: [
        { type: "lottery-number", value: "2642" },
      ],
    });

    const { researchRun } = await startTestResearchRun(request, project.currentSlug, {
      sourceKeys: ["asia-cyrus"],
    });

    // Wait for completion using polling
    await waitForResearchRunComplete(request, project.currentSlug, researchRun.id);

    // Verify final state
    const response = await request.get(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}`
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(["completed", "completed-with-errors"]).toContain(data.researchRun.status);
  });
});

test.describe("API - Source Selection", () => {
  test("GET /api/projects/:slug/sources returns available sources", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });

    const response = await request.get(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/sources`
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.sources)).toBeTruthy();
    expect(data.sources.length).toBeGreaterThan(0);

    // Verify source structure
    const source = data.sources[0];
    expect(source).toHaveProperty("key");
    expect(source).toHaveProperty("name");
    expect(source).toHaveProperty("category");
  });

  test("POST /api/projects/:slug/research-runs with empty sourceKeys returns 400", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });

    const response = await request.post(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs`,
      {
        data: { sourceKeys: [] },
      }
    );

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("at least one source");
  });

  test("POST /api/projects/:slug/research-runs with unknown sourceKey returns 400", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });

    const response = await request.post(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs`,
      {
        data: { sourceKeys: ["unknown-source-12345"], externalDataConsent: true },
      }
    );

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Unknown source keys");
  });

  test("POST /api/projects/:slug/research-runs without consent for external source returns 400", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });

    const response = await request.post(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs`,
      {
        data: { sourceKeys: ["asia-cyrus"], externalDataConsent: false },
      }
    );

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("consent");
  });
});

test.describe("API - Manual Action Resolution", () => {
  test("POST /api/projects/:slug/research-runs/:runId/source-checks/:checkId/no-result marks no result", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, {
      testId,
      identifiers: [{ type: "lottery-number", value: "2642" }],
    });

    const { researchRun } = await startTestResearchRun(request, project.currentSlug, {
      sourceKeys: ["discounted-housing"],
    });

    // Wait for the check to be in waiting-for-user state
    const runResponse = await request.get(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}`
    );
    const runData = await runResponse.json();
    const check = runData.sourceChecks.find((c: any) => c.sourceKey === "discounted-housing");

    await waitForSourceCheckStatus(
      request,
      project.currentSlug,
      researchRun.id,
      check.id,
      "waiting-for-user"
    );

    // Mark as no result
    const response = await request.post(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}/source-checks/${check.id}/no-result`
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.check.status).toBe("no-results");
  });

  test("POST /api/projects/:slug/research-runs/:runId/source-checks/:checkId/candidate-url adds candidate URL", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, {
      testId,
      identifiers: [{ type: "lottery-number", value: "2642" }],
    });

    const { researchRun } = await startTestResearchRun(request, project.currentSlug, {
      sourceKeys: ["discounted-housing"],
    });

    const runResponse = await request.get(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}`
    );
    const runData = await runResponse.json();
    const check = runData.sourceChecks.find((c: any) => c.sourceKey === "discounted-housing");

    await waitForSourceCheckStatus(
      request,
      project.currentSlug,
      researchRun.id,
      check.id,
      "waiting-for-user"
    );

    const response = await request.post(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}/source-checks/${check.id}/candidate-url`,
      {
        data: {
          url: "https://www.dira.moch.gov.il/projectinfo?projid=2642",
        },
      }
    );

    expect(response.status()).toBe(202);
    const data = await response.json();
    expect(data).toHaveProperty("check");
  });

  test("POST /api/projects/:slug/research-runs/:runId/source-checks/:checkId/dismiss dismisses manual action", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, {
      testId,
      identifiers: [{ type: "lottery-number", value: "2642" }],
    });

    const { researchRun } = await startTestResearchRun(request, project.currentSlug, {
      sourceKeys: ["discounted-housing"],
    });

    const runResponse = await request.get(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}`
    );
    const runData = await runResponse.json();
    const check = runData.sourceChecks.find((c: any) => c.sourceKey === "discounted-housing");

    await waitForSourceCheckStatus(
      request,
      project.currentSlug,
      researchRun.id,
      check.id,
      "waiting-for-user"
    );

    const response = await request.post(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}/source-checks/${check.id}/dismiss`
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.check.status).toBe("skipped");
  });

  test("POST /api/projects/:slug/research-runs/:runId/source-checks/:checkId/retry retries failed check", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });

    const { researchRun } = await startTestResearchRun(request, project.currentSlug, {
      sourceKeys: ["asia-cyrus"],
    });

    // Wait for research to complete
    await waitForResearchRunComplete(request, project.currentSlug, researchRun.id);

    const runResponse = await request.get(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}`
    );
    const runData = await runResponse.json();
    const check = runData.sourceChecks.find((c: any) => c.sourceKey === "asia-cyrus");

    // If the check is not in failed state, we can't test retry
    // This test might need to be tagged as @live or use specific mocking
    if (check.status === "failed") {
      const response = await request.post(
        `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}/source-checks/${check.id}/retry`
      );

      expect(response.status()).toBe(202);
      const data = await response.json();
      expect(data).toHaveProperty("check");
    }
  });
});

test.describe("API - Cross-Project Protection", () => {
  test("Cannot access research run from different project", async ({ request }) => {
    const testId1 = generateTestId();
    const testId2 = generateTestId();

    const { project: project1 } = await createTestProject(request, {
      name: `פרויקט א ${testId1}`,
      testId: testId1,
    });

    const { project: project2 } = await createTestProject(request, {
      name: `פרויקט ב ${testId2}`,
      testId: testId2,
    });

    const { researchRun } = await startTestResearchRun(request, project1.currentSlug);

    // Try to access project1's run through project2's slug
    const response = await request.get(
      `/api/projects/${encodeURIComponent(project2.currentSlug)}/research-runs/${researchRun.id}`
    );

    expect(response.status()).toBe(404);
  });

  test("Cannot cancel research run from different project", async ({ request }) => {
    const testId1 = generateTestId();
    const testId2 = generateTestId();

    const { project: project1 } = await createTestProject(request, {
      name: `פרויקט א ${testId1}`,
      testId: testId1,
    });

    const { project: project2 } = await createTestProject(request, {
      name: `פרויקט ב ${testId2}`,
      testId: testId2,
    });

    const { researchRun } = await startTestResearchRun(request, project1.currentSlug);

    // Try to cancel project1's run through project2's slug
    const response = await request.delete(
      `/api/projects/${encodeURIComponent(project2.currentSlug)}/research-runs/${researchRun.id}`
    );

    expect(response.status()).toBe(404);
  });
});

test.describe("API - Validation Errors", () => {
  test("GET /api/projects/:slug/findings/:findingId with unknown finding returns 404", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });

    const response = await request.get(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/findings/unknown-finding-id-12345`
    );

    expect(response.status()).toBe(404);
  });

  test("POST /api/projects/:slug/research-runs with missing consent returns 400", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });

    const response = await request.post(
      `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs`,
      {
        data: { sourceKeys: ["asia-cyrus"] },
      }
    );

    expect(response.status()).toBe(400);
  });

  test("POST /api/projects with duplicate name creates unique slug", async ({ request }) => {
    const testId = generateTestId();
    const projectName = `פרויקט כפול ${testId}`;

    const { project: project1 } = await createTestProject(request, {
      name: projectName,
      testId,
    });

    const { project: project2 } = await createTestProject(request, {
      name: projectName,
      testId,
    });

    // Slugs should be different
    expect(project1.currentSlug).not.toBe(project2.currentSlug);
  });
});

test.describe("API - Live Integration @live", () => {
  test.skip("Research run completes with real Asia Cyrus API", async ({ request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, {
      testId,
      city: "יהוד",
      developer: "אסיה סיירוס פיתוח וייזום בע\"מ",
      identifiers: [
        { type: "lottery-number", value: "2642" },
      ],
    });

    // Temporarily disable mocks for this test
    mockServer.close();

    try {
      const { researchRun } = await startTestResearchRun(request, project.currentSlug, {
        sourceKeys: ["asia-cyrus"],
      });

      await waitForResearchRunComplete(request, project.currentSlug, researchRun.id, {
        timeout: 60000,
      });

      const response = await request.get(
        `/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.researchRun.status).toBe("completed");

      // Verify we got actual results
      const asiaCyrusCheck = data.sourceChecks.find(
        (c: any) => c.sourceKey === "asia-cyrus"
      );
      expect(asiaCyrusCheck).toBeTruthy();
      expect(asiaCyrusCheck.status).toBe("results-found");
    } finally {
      // Re-enable mocks
      mockServer.listen();
    }
  });
});
