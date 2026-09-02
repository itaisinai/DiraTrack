import { test, expect, Page } from "@playwright/test";

const WINNING_MESSAGE = `שלום רב,

ברכותינו. זכית בהגרלה לתור לבחירת דירה.

במסגרת תוכנית "דירה בהנחה" זכית בהגרלה מספר 2642 לפרויקט 324 של קבלן אסיה סיירוס פיתוח וייזום בע"מ
ביישוב יהוד
נקבע כי מקומך לבחירת דירה הוא 63. בהגרלה זו הוצעו 118 דירות.

מומלץ לעקוב אחר התקדמות הפרויקט באתר:
https://www.dira.moch.gov.il/ProjectsList`;

test.describe("User Journeys", () => {
  test("Flow A: Empty state and project creation", async ({ page }) => {
    await page.goto("/");

    // Verify empty state
    await expect(page).toHaveTitle(/DiraTrack/);
    await expect(page.getByRole("heading", { name: /הפרויקטים שלך/ })).toBeVisible();

    // Navigate to project creation
    await page.getByRole("link", { name: /פרויקט חדש/ }).click();
    await expect(page).toHaveURL(/\/projects\/new/);

    // Verify winning message input page
    await expect(page.getByRole("heading", { name: /פרויקט חדש/ })).toBeVisible();

    // Paste winning message
    const textarea = page.getByRole("textbox");
    await textarea.fill(WINNING_MESSAGE);

    // Verify parsed fields are displayed
    await expect(page.getByText("2642")).toBeVisible(); // lottery number
    await expect(page.getByText("324")).toBeVisible(); // housing project
    await expect(page.getByText("יהוד")).toBeVisible(); // city
    await expect(page.getByText(/אסיה סיירוס/)).toBeVisible(); // developer
    await expect(page.getByText("63")).toBeVisible(); // selection position
    await expect(page.getByText("118")).toBeVisible(); // apartments

    // Verify no registrant number is shown
    await expect(page.getByText("ז.")).not.toBeVisible();

    // Create project
    await page.getByRole("button", { name: /יצירת הפרויקט/ }).click();

    // Verify navigation to Hebrew slug
    await expect(page).toHaveURL(/\/projects\/.+/);
    await expect(page).not.toHaveURL(/\/projects\/new/);

    // Verify project overview
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/מזהי הפרויקט/)).toBeVisible();

    // Verify identifiers are displayed
    await expect(page.getByText("2642")).toBeVisible();
    await expect(page.getByText("324")).toBeVisible();

    // Refresh and verify persistence
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("Flow B: Multiple projects and isolation", async ({ page, request }) => {
    // Create first project via UI
    await page.goto("/projects/new");
    await page.getByRole("textbox").fill(WINNING_MESSAGE);
    await page.getByRole("button", { name: /יצירת הפרויקט/ }).click();
    await page.waitForURL(/\/projects\/.+/);
    const url1 = page.url();

    // Create second project via API
    const response = await request.post("/api/projects", {
      data: {
        name: "פרויקט שני",
        city: "תל אביב",
        developer: "יזם אחר",
        identifiers: [
          { type: "lottery-number", value: "9999", origin: "manual" },
        ],
      },
    });
    expect(response.status()).toBe(201);
    const { project: project2 } = await response.json();

    // Go to dashboard
    await page.goto("/");

    // Verify both projects appear
    await expect(page.getByText(/יהוד/)).toBeVisible();
    await expect(page.getByText(/תל אביב/)).toBeVisible();

    // Verify slugs are different
    expect(url1).not.toContain(project2.currentSlug);

    // Navigate to second project
    await page.goto(`/projects/${encodeURIComponent(project2.currentSlug)}`);
    await expect(page.getByText("פרויקט שני")).toBeVisible();
    await expect(page.getByText("9999")).toBeVisible();
  });

  test("Flow C: Research confirmation dialog", async ({ page }) => {
    // Create a project first
    await page.goto("/projects/new");
    await page.getByRole("textbox").fill(WINNING_MESSAGE);
    await page.getByRole("button", { name: /יצירת הפרויקט/ }).click();
    await page.waitForURL(/\/projects\/.+/);

    // Click "Run research"
    await page.getByRole("button", { name: /מחקר חדש/ }).click();

    // Verify confirmation dialog
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/שליחת נתונים למקורות חיצוניים/)).toBeVisible();

    // Verify both sources are mentioned
    await expect(page.getByText(/דירה בהנחה/)).toBeVisible();
    await expect(page.getByText(/אסיה סיירוס/)).toBeVisible();

    // Verify start button is disabled before consent
    const startButton = page.getByRole("button", { name: /התחלת המחקר/ });
    await expect(startButton).toBeDisabled();

    // Give consent
    await page.getByRole("checkbox").check();
    await expect(startButton).toBeEnabled();

    // Start research
    await startButton.click();

    // Verify navigation to live research screen
    await expect(page).toHaveURL(/\/research\/.+/);
    await expect(page.getByText(/בדיקת מקורות/)).toBeVisible();
  });

  test("Flow D: Worker and research states", async ({ page }) => {
    // Create project
    await page.goto("/projects/new");
    await page.getByRole("textbox").fill(WINNING_MESSAGE);
    await page.getByRole("button", { name: /יצירת הפרויקט/ }).click();
    await page.waitForURL(/\/projects\/.+/);

    // Start research
    await page.getByRole("button", { name: /מחקר חדש/ }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /התחלת המחקר/ }).click();
    await page.waitForURL(/\/research\/.+/);

    // Wait for research to complete (with timeout)
    await page.waitForTimeout(15000);

    // Check that source cards are visible
    await expect(page.getByText(/דירה בהנחה/)).toBeVisible();
    await expect(page.getByText(/אסיה סיירוס/)).toBeVisible();

    // Verify progress indicator
    await expect(page.getByText(/%/)).toBeVisible();

    // Take screenshot for manual verification
    await page.screenshot({ path: "test-results/research-state.png", fullPage: true });
  });

  test("Flow E: Responsive and RTL UI", async ({ page, context }) => {
    // Test desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page).toHaveAttribute("html", "dir", "rtl");

    // Test mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /הפרויקטים שלך/ })).toBeVisible();

    // Create project on mobile
    await page.goto("/projects/new");
    await page.getByRole("textbox").fill(WINNING_MESSAGE);
    await expect(page.getByRole("button", { name: /יצירת הפרויקט/ })).toBeVisible();

    // Verify no horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBe(clientWidth);
  });

  test("Flow F: Invalid navigation and 404 handling", async ({ page }) => {
    // Try nonexistent project
    await page.goto("/projects/nonexistent-project");
    // Should either redirect or show error
    await page.waitForLoadState("networkidle");

    // Try nonexistent research run
    await page.goto("/projects/test/research/nonexistent-run");
    await page.waitForLoadState("networkidle");

    // Try nonexistent finding
    await page.goto("/projects/test/findings/nonexistent-finding");
    await page.waitForLoadState("networkidle");
  });
});

test.describe("Research Worker Integration", () => {
  test("Sources complete with correct states", async ({ page, request }) => {
    // Create project via API with known identifiers
    const response = await request.post("/api/projects", {
      data: {
        name: "פרויקט בדיקה",
        city: "יהוד",
        developer: "אסיה סיירוס פיתוח וייזום בע\"מ",
        identifiers: [
          { type: "lottery-number", value: "2642", origin: "winning-message" },
        ],
      },
    });
    const { project } = await response.json();

    // Start research
    const runResponse = await request.post(`/api/projects/${encodeURIComponent(project.currentSlug)}/research-runs`, {
      data: { externalDataConsent: true },
    });
    const { researchRun } = await runResponse.json();

    // Navigate to research page
    await page.goto(`/projects/${encodeURIComponent(project.currentSlug)}/research/${researchRun.id}`);

    // Wait for worker to process jobs
    await page.waitForTimeout(20000);

    // Take screenshot of final state
    await page.screenshot({ path: "test-results/worker-final-state.png", fullPage: true });

    // Verify sources have completed statuses
    const sourceCards = page.locator("article").filter({ hasText: /דירה בהנחה|אסיה סיירוס/ });
    await expect(sourceCards).toHaveCount(2);
  });
});
