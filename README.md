# DiraTrack

מערכת מקומית למעקב אחר פרויקט דירה בישראל, מהזכייה ועד למסירה.

## התחלה מהירה

דרישות: Node.js 22 ומעלה, npm 10 ומעלה ו־Docker Desktop.

```bash
cp .env.example .env
npm install
npm run db:up
npm run db:migrate
npm run dev
```

האתר עולה ב־http://localhost:3000 וה־Research Worker פועל כתהליך נפרד.

## מחקר חי

המערכת מחוברת ל־**שני מקורות**:

### מקורות אוטומטיים
- **אתר אסיה סיירוס** - חיפוש אוטומטי דרך API הציבורי של WordPress. לפני שליחת נתוני הפרויקט, הממשק דורש אישור מפורש. כל תוצאה נשמרת עם כתובת המקור ומסומנת `דורש בדיקה` ואינה משנה עובדות בפרויקט באופן אוטומטי.

### מקורות ידניים
- **דירה בהנחה (המקור הרשמי)** - המערכת מציגה הנחיות לחיפוש ידני באתר הרשמי עם מספר ההגרלה. האתר דורש אינטראקציה (CAPTCHA) ולכן אין אוטומציה מלאה.

חמשת מקורות ה־MVP האחרים עדיין אינם מחוברים ומתועדים בממשק כ־`טרם נתמך אוטומטית`.

## בדיקות

```bash
# בדיקות יחידה
npm test

# בדיקות E2E
npm run test:e2e

# בדיקות E2E במצב אינטראקטיבי
npm run test:e2e:ui

# דוח בדיקות
npm run test:e2e:report

# בדיקות חיות (מול API אמיתי)
npm run test:e2e:live
```

**הערה חשובה**: בדיקות ה־E2E משתמשות במסד נתונים נפרד (`diratrack_test`) ולא משפיעות על מסד הנתונים של הפיתוח.

## מבנה

```text
apps/
  web/
  research-worker/
packages/
  ai/
  database/
  document-processing/
  domain/
  shared-ui/
  source-adapters/
e2e/
  api.spec.ts
  user-flows.spec.ts
docs/
  ROADMAP.md
```

הנתונים והמסמכים המקומיים נשמרים תחת `data/` ואינם נכנסים ל־Git.
