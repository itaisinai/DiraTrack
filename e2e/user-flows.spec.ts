import { test, expect, Page } from "@playwright/test";
import {
  cleanupTestData,
  generateTestId,
  createTestProject,
  WINNING_MESSAGE,
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

test.describe("User Flow - Project Creation", () => {
  test("Empty state shows dashboard and navigation", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/DiraTrack/);
    await expect(page.getByRole("heading", { name: /הפרויקטים שלך/ })).toBeVisible();

    // Verify new project link exists
    const newProjectLink = page.getByRole("link", { name: /פרויקט חדש/i });
    await expect(newProjectLink).toBeVisible();
  });

  test("Create project from winning message", async ({ page }) => {
    const testId = generateTestId();

    await page.goto("/projects/new");

    // Verify project creation page
    await expect(page.getByRole("heading", { name: /פרויקט חדש/i })).toBeVisible();

    // Fill winning message
    const textarea = page.getByRole("textbox").first();
    await textarea.fill(WINNING_MESSAGE);

    // Wait for parsing - use visibility of parsed fields
    await expect(page.getByText("2642")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("324")).toBeVisible();
    await expect(page.getByText("יהוד")).toBeVisible();
    await expect(page.getByText(/אסיה סיירוס/)).toBeVisible();

    // Create project
    const createButton = page.getByRole("button", { name: /יצירת הפרויקט/i });
    await createButton.click();

    // Wait for navigation to project page
    await page.waitForURL(/\/projects\/.+/, { timeout: 10000 });
    await expect(page).not.toHaveURL(/\/projects\/new/);

    // Verify project overview is visible
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Verify identifiers are displayed
    await expect(page.getByText("2642")).toBeVisible();
    await expect(page.getByText("324")).toBeVisible();

    // Verify persistence after reload
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("Create project with unique name via timestamp", async ({ page, request }) => {
    const testId = generateTestId();

    await page.goto("/projects/new");

    // Create minimal project
    const customMessage = `שלום,
זכית בהגרלה ${testId}.
פרויקט טסט ${testId}
יהוד`;

    await page.getByRole("textbox").first().fill(customMessage);

    // Wait for some parsing
    await page.waitForTimeout(500);

    const createButton = page.getByRole("button", { name: /יצירת הפרויקט/i });
    await createButton.click();

    await page.waitForURL(/\/projects\/.+/, { timeout: 10000 });
    const url1 = page.url();

    // Create another project with same pattern
    await page.goto("/projects/new");
    await page.getByRole("textbox").first().fill(customMessage);
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /יצירת הפרויקט/i }).click();
    await page.waitForURL(/\/projects\/.+/, { timeout: 10000 });
    const url2 = page.url();

    // URLs should be different (different slugs)
    expect(url1).not.toBe(url2);
  });
});

test.describe("User Flow - Project Dashboard", () => {
  test("Multiple projects appear in dashboard", async ({ page, request }) => {
    const testId1 = generateTestId();
    const testId2 = generateTestId();

    // Create two projects via API
    await createTestProject(request, {
      name: `פרויקט ${testId1}`,
      city: "יהוד",
      testId: testId1,
    });

    await createTestProject(request, {
      name: `פרויקט ${testId2}`,
      city: "תל אביב",
      testId: testId2,
    });

    // Navigate to dashboard
    await page.goto("/");

    // Wait for projects to load
    await expect(page.getByText("יהוד")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("תל אביב")).toBeVisible();
  });

  test("Navigate between projects", async ({ page, request }) => {
    const testId1 = generateTestId();
    const testId2 = generateTestId();

    const { project: project1 } = await createTestProject(request, {
      name: `פרויקט ${testId1}`,
      city: "יהוד",
      testId: testId1,
    });

    const { project: project2 } = await createTestProject(request, {
      name: `פרויקט ${testId2}`,
      city: "חיפה",
      testId: testId2,
    });

    // Visit first project
    await page.goto(`/projects/${encodeURIComponent(project1.currentSlug)}`);
    await expect(page.getByText(`פרויקט ${testId1}`)).toBeVisible();

    // Visit second project
    await page.goto(`/projects/${encodeURIComponent(project2.currentSlug)}`);
    await expect(page.getByText(`פרויקט ${testId2}`)).toBeVisible();
    await expect(page.getByText("חיפה")).toBeVisible();
  });
});

test.describe("User Flow - Source Selection", () => {
  test("Source selection dialog shows available sources", async ({ page, request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });

    await page.goto(`/projects/${encodeURIComponent(project.currentSlug)}`);

    // Click research button
    const researchButton = page.getByRole("button", { name: /מחקר חדש/i });
    await researchButton.click();

    // Verify dialog appears
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Verify sources are shown
    await expect(page.getByText(/דירה בהנחה/)).toBeVisible();
    await expect(page.getByText(/אסיה סיירוס/)).toBeVisible();
  });

  test("Cannot start research without selecting sources", async ({ page, request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });

    await page.goto(`/projects/${encodeURIComponent(project.currentSlug)}`);

    const researchButton = page.getByRole("button", { name: /מחקר חדש/i });
    await researchButton.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Uncheck all sources if any are checked
    const checkboxes = page.locator('input[type="checkbox"]').filter({ hasNotText: /הסכמה/ });
    const count = await checkboxes.count();

    for (let i = 0; i < count; i++) {
      const checkbox = checkboxes.nth(i);
      if (await checkbox.isChecked()) {
        await checkbox.uncheck();
      }
    }

    // Start button should be disabled
    const startButton = page.getByRole("button", { name: /התחלת המחקר/i });
    await expect(startButton).toBeDisabled();
  });
});

test.describe("User Flow - Consent Flow", () => {
  test("External source requires consent", async ({ page, request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });

    await page.goto(`/projects/${encodeURIComponent(project.currentSlug)}`);

    const researchButton = page.getByRole("button", { name: /מחקר חדש/i });
    await researchButton.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Verify consent checkbox exists
    const consentCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /הסכמה/ }).first();
    await expect(consentCheckbox).toBeVisible();

    // Start button disabled before consent
    const startButton = page.getByRole("button", { name: /התחלת המחקר/i });
    await expect(startButton).toBeDisabled();

    // Check consent
    await consentCheckbox.check();

    // Start button enabled after consent
    await expect(startButton).toBeEnabled();
  });

  test("Can start research after giving consent", async ({ page, request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });

    await page.goto(`/projects/${encodeURIComponent(project.currentSlug)}`);

    const researchButton = page.getByRole("button", { name: /מחקר חדש/i });
    await researchButton.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Give consent
    const consentCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /הסכמה/ }).first();
    await consentCheckbox.check();

    // Start research
    const startButton = page.getByRole("button", { name: /התחלת המחקר/i });
    await startButton.click();

    // Verify navigation to research page
    await page.waitForURL(/\/research\/.+/, { timeout: 10000 });

    // Verify research screen is visible
    await expect(page.getByText(/בדיקת מקורות/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("User Flow - Research Progress", () => {
  test("Research progress screen shows source checks", async ({ page, request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });

    await page.goto(`/projects/${encodeURIComponent(project.currentSlug)}`);

    // Start research
    const researchButton = page.getByRole("button", { name: /מחקר חדש/i });
    await researchButton.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    const consentCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /הסכמה/ }).first();
    await consentCheckbox.check();

    const startButton = page.getByRole("button", { name: /התחלת המחקר/i });
    await startButton.click();

    await page.waitForURL(/\/research\/.+/, { timeout: 10000 });

    // Wait for source cards to appear
    await expect(page.getByText(/דירה בהנחה|אסיה סיירוס/)).toBeVisible({ timeout: 10000 });

    // Verify at least one source card is present
    const sourceCards = page.locator("article, [data-testid*='source'], [class*='source']");
    await expect(sourceCards.first()).toBeVisible({ timeout: 5000 });
  });

  test("Research completes and shows summary", async ({ page, request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, {
      testId,
      identifiers: [{ type: "lottery-number", value: "2642" }],
    });

    await page.goto(`/projects/${encodeURIComponent(project.currentSlug)}`);

    // Start research
    const researchButton = page.getByRole("button", { name: /מחקר חדש/i });
    await researchButton.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    const consentCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /הסכמה/ }).first();
    await consentCheckbox.check();

    const startButton = page.getByRole("button", { name: /התחלת המחקר/i });
    await startButton.click();

    await page.waitForURL(/\/research\/.+/, { timeout: 10000 });

    // Wait for completion indicator using polling
    await expect(async () => {
      const statusText = await page.textContent("body");
      expect(
        statusText?.includes("הושלם") ||
        statusText?.includes("completed") ||
        statusText?.includes("100%")
      ).toBeTruthy();
    }).toPass({ timeout: 30000, intervals: [1000, 2000, 3000] });
  });
});

test.describe("User Flow - Manual Action Resolution", () => {
  test("Manual action shows waiting state", async ({ page, request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, {
      testId,
      identifiers: [{ type: "lottery-number", value: "2642" }],
    });

    await page.goto(`/projects/${encodeURIComponent(project.currentSlug)}`);

    // Start research
    const researchButton = page.getByRole("button", { name: /מחקר חדש/i });
    await researchButton.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    const consentCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /הסכמה/ }).first();
    await consentCheckbox.check();

    const startButton = page.getByRole("button", { name: /התחלת המחקר/i });
    await startButton.click();

    await page.waitForURL(/\/research\/.+/, { timeout: 10000 });

    // Wait for discounted-housing to show manual action (waiting-for-user)
    await expect(async () => {
      const pageContent = await page.textContent("body");
      expect(pageContent?.includes("דירה בהנחה")).toBeTruthy();
      expect(
        pageContent?.includes("ממתין") ||
        pageContent?.includes("waiting") ||
        pageContent?.includes("פעולה נדרשת")
      ).toBeTruthy();
    }).toPass({ timeout: 30000, intervals: [1000, 2000] });
  });

  test("Can mark manual action as no result", async ({ page, request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, {
      testId,
      identifiers: [{ type: "lottery-number", value: "2642" }],
    });

    await page.goto(`/projects/${encodeURIComponent(project.currentSlug)}`);

    // Start research
    const researchButton = page.getByRole("button", { name: /מחקר חדש/i });
    await researchButton.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    const consentCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /הסכמה/ }).first();
    await consentCheckbox.check();

    const startButton = page.getByRole("button", { name: /התחלת המחקר/i });
    await startButton.click();

    await page.waitForURL(/\/research\/.+/, { timeout: 10000 });

    // Wait for manual action button to appear
    await expect(async () => {
      const noResultButton = page.getByRole("button", { name: /אין תוצאות|no result/i });
      await expect(noResultButton.first()).toBeVisible();
    }).toPass({ timeout: 30000, intervals: [1000, 2000] });

    // Click no result button
    const noResultButton = page.getByRole("button", { name: /אין תוצאות|no result/i }).first();
    await noResultButton.click();

    // Verify status changed
    await expect(page.getByText(/no-results|אין תוצאות/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("User Flow - 404 Handling", () => {
  test("Nonexistent project shows error", async ({ page }) => {
    await page.goto("/projects/nonexistent-project-12345");

    // Wait for page load
    await page.waitForLoadState("networkidle", { timeout: 10000 });

    // Verify either 404 message or redirect to home
    const bodyText = await page.textContent("body");
    const isError = bodyText?.includes("404") ||
                    bodyText?.includes("לא נמצא") ||
                    bodyText?.includes("not found") ||
                    page.url().includes("/?") ||
                    page.url() === "http://localhost:3000/";

    expect(isError).toBeTruthy();
  });

  test("Nonexistent research run shows error", async ({ page, request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });

    await page.goto(
      `/projects/${encodeURIComponent(project.currentSlug)}/research/nonexistent-run-12345`
    );

    await page.waitForLoadState("networkidle", { timeout: 10000 });

    const bodyText = await page.textContent("body");
    const isError = bodyText?.includes("404") ||
                    bodyText?.includes("לא נמצא") ||
                    bodyText?.includes("not found");

    expect(isError).toBeTruthy();
  });

  test("Nonexistent finding shows error", async ({ page, request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });

    await page.goto(
      `/projects/${encodeURIComponent(project.currentSlug)}/findings/nonexistent-finding-12345`
    );

    await page.waitForLoadState("networkidle", { timeout: 10000 });

    const bodyText = await page.textContent("body");
    const isError = bodyText?.includes("404") ||
                    bodyText?.includes("לא נמצא") ||
                    bodyText?.includes("not found");

    expect(isError).toBeTruthy();
  });
});

test.describe("User Flow - RTL Verification", () => {
  test("Page has RTL direction", async ({ page }) => {
    await page.goto("/");

    const htmlElement = page.locator("html");
    await expect(htmlElement).toHaveAttribute("dir", "rtl");
  });

  test("Hebrew text displays correctly", async ({ page }) => {
    await page.goto("/");

    // Verify Hebrew text is present
    await expect(page.getByText(/הפרויקטים שלך|פרויקט חדש/)).toBeVisible();
  });

  test("Text alignment is correct for RTL", async ({ page, request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, {
      name: `פרויקט ${testId}`,
      testId,
    });

    await page.goto(`/projects/${encodeURIComponent(project.currentSlug)}`);

    // Check that main content has RTL
    const main = page.locator("main, [role='main'], body > div").first();
    const direction = await main.evaluate((el) => {
      return window.getComputedStyle(el).direction;
    });

    expect(direction).toBe("rtl");
  });
});

test.describe("User Flow - Responsive @mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Dashboard is usable on mobile", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /הפרויקטים שלך/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /פרויקט חדש/i })).toBeVisible();
  });

  test("Project creation works on mobile", async ({ page }) => {
    await page.goto("/projects/new");

    const textarea = page.getByRole("textbox").first();
    await textarea.fill(WINNING_MESSAGE);

    await expect(page.getByText("2642")).toBeVisible({ timeout: 5000 });

    const createButton = page.getByRole("button", { name: /יצירת הפרויקט/i });
    await createButton.click();

    await page.waitForURL(/\/projects\/.+/, { timeout: 10000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("No horizontal scroll on mobile", async ({ page }) => {
    await page.goto("/");

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // Allow 1px tolerance
  });

  test("Research dialog is usable on mobile", async ({ page, request }) => {
    const testId = generateTestId();
    const { project } = await createTestProject(request, { testId });

    await page.goto(`/projects/${encodeURIComponent(project.currentSlug)}`);

    const researchButton = page.getByRole("button", { name: /מחקר חדש/i });
    await researchButton.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Verify dialog is not wider than viewport
    const dialog = page.getByRole("dialog");
    const dialogWidth = await dialog.evaluate((el) => el.getBoundingClientRect().width);
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    expect(dialogWidth).toBeLessThanOrEqual(viewportWidth);
  });
});

test.describe("User Flow - Desktop Viewport @chromium", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Dashboard uses desktop layout", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /הפרויקטים שלך/i })).toBeVisible();

    // Verify viewport size
    const width = await page.evaluate(() => window.innerWidth);
    expect(width).toBeGreaterThanOrEqual(1440);
  });

  test("Multiple columns on desktop", async ({ page, request }) => {
    const testId = generateTestId();

    // Create multiple projects
    for (let i = 0; i < 3; i++) {
      await createTestProject(request, {
        name: `פרויקט ${testId}-${i}`,
        city: `עיר ${i}`,
        testId: `${testId}-${i}`,
      });
    }

    await page.goto("/");

    // Wait for projects to load
    await expect(page.getByText(`פרויקט ${testId}-0`)).toBeVisible({ timeout: 5000 });

    // On desktop, content should have reasonable max width
    const mainContent = page.locator("main, [role='main']").first();
    if (await mainContent.isVisible()) {
      const contentWidth = await mainContent.evaluate((el) => el.getBoundingClientRect().width);
      // Should not span full 1440px width (reasonable max width should be set)
      expect(contentWidth).toBeLessThan(1400);
    }
  });
});
