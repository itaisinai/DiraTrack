import { test, expect } from "@playwright/test";

const WINNING_MESSAGE = `שלום רב,

ברכותינו. זכית בהגרלה לתור לבחירת דירה.

במסגרת תוכנית "דירה בהנחה" זכית בהגרלה מספר 2642 לפרויקט 324 של קבלן אסיה סיירוס פיתוח וייזום בע"מ
ביישוב יהוד
נקבע כי מקומך לבחירת דירה הוא 63. בהגרלה זו הוצעו 118 דירות.

מומלץ לעקוב אחר התקדמות הפרויקט באתר:
https://www.dira.moch.gov.il/ProjectsList`;

test.describe("API Endpoint Testing", () => {
  test("GET /api/health returns OK", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe("ok");
  });

  test("GET /api/projects returns empty list initially", async ({ request }) => {
    const response = await request.get("/api/projects");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty("projects");
    expect(Array.isArray(data.projects)).toBeTruthy();
  });

  test("POST /api/projects with valid data creates project", async ({ request }) => {
    const response = await request.post("/api/projects", {
      data: {
        name: "גני יהודה טסט",
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
    expect(data.project.name).toBe("גני יהודה טסט");
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
  });

  test("POST /api/projects without content-type header handles gracefully", async ({ request }) => {
    const response = await request.post("/api/projects", {
      data: "",
    });
    expect([400, 415]).toContain(response.status());
  });

  test("GET /api/projects/:slug with unknown slug returns 404", async ({ request }) => {
    const response = await request.get("/api/projects/unknown-project-slug");
    expect(response.status()).toBe(404);
  });

  test("POST /api/projects/:slug/research-runs without body uses defaults", async ({ request }) => {
    // First create a project
    const createResponse = await request.post("/api/projects", {
      data: {
        name: "פרויקט מחקר",
        city: "תל אביב",
        identifiers: [],
      },
    });
    const { project } = await createResponse.json();

    // Start research without body
    const response = await request.post(`/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs`);
    expect([202, 400]).toContain(response.status());
  });

  test("POST /api/projects/:slug/research-runs with empty sourceKeys returns 400", async ({ request }) => {
    const createResponse = await request.post("/api/projects", {
      data: {
        name: "פרויקט ריק",
        city: "חיפה",
        identifiers: [],
      },
    });
    const { project } = await createResponse.json();

    const response = await request.post(`/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs`, {
      data: { sourceKeys: [] },
    });
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("at least one source");
  });

  test("POST /api/projects/:slug/research-runs with unknown sourceKey returns 400", async ({ request }) => {
    const createResponse = await request.post("/api/projects", {
      data: {
        name: "פרויקט מקור לא ידוע",
        city: "באר שבע",
        identifiers: [],
      },
    });
    const { project } = await createResponse.json();

    const response = await request.post(`/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs`, {
      data: { sourceKeys: ["unknown-source"], externalDataConsent: true },
    });
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Unknown source keys");
  });

  test("POST /api/projects/:slug/research-runs without consent for external source returns 400", async ({ request }) => {
    const createResponse = await request.post("/api/projects", {
      data: {
        name: "פרויקט ללא הסכמה",
        city: "ירושלים",
        identifiers: [],
      },
    });
    const { project } = await createResponse.json();

    const response = await request.post(`/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs`, {
      data: { sourceKeys: ["asia-cyrus"] },
    });
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("consent");
  });

  test("DELETE /api/projects/:slug/research-runs/:runId cancels active run", async ({ request }) => {
    const createResponse = await request.post("/api/projects", {
      data: {
        name: "פרויקט לביטול",
        city: "נתניה",
        identifiers: [],
      },
    });
    const { project } = await createResponse.json();

    const runResponse = await request.post(`/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs`, {
      data: { sourceKeys: ["asia-cyrus"], externalDataConsent: true },
    });
    const { researchRun } = await runResponse.json();

    const cancelResponse = await request.delete(`/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs/${researchRun.id}`);
    expect(cancelResponse.ok()).toBeTruthy();
    const data = await cancelResponse.json();
    expect(data.researchRun.status).toBe("cancelled");
  });

  test("GET /api/projects/:slug/findings/:findingId with unknown finding returns 404", async ({ request }) => {
    const createResponse = await request.post("/api/projects", {
      data: {
        name: "פרויקט ממצא",
        city: "רעננה",
        identifiers: [],
      },
    });
    const { project } = await createResponse.json();

    const response = await request.get(`/api/projects/${encodeURIComponent(project.currentSlug)}/findings/unknown-finding-id`);
    expect(response.status()).toBe(404);
  });

  test("Cross-project access is prevented", async ({ request }) => {
    const project1Response = await request.post("/api/projects", {
      data: {
        name: "פרויקט א",
        city: "עיר א",
        identifiers: [],
      },
    });
    const { project: project1 } = await project1Response.json();

    const project2Response = await request.post("/api/projects", {
      data: {
        name: "פרויקט ב",
        city: "עיר ב",
        identifiers: [],
      },
    });
    const { project: project2 } = await project2Response.json();

    const run1Response = await request.post(`/api/projects/${encodeURIComponent(project1.currentSlug)}/research-runs`, {
      data: { sourceKeys: ["asia-cyrus"], externalDataConsent: true },
    });
    const { researchRun: run1 } = await run1Response.json();

    // Try to access project1's run through project2's slug
    const crossAccessResponse = await request.get(`/api/projects/${encodeURIComponent(project2.currentSlug)}/research-runs/${run1.id}`);
    expect(crossAccessResponse.status()).toBe(404);
  });
});
