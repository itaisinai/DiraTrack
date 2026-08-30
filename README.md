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

המקור החי הראשון הוא אתר אסיה סיירוס, דרך API החיפוש הציבורי של האתר. לפני שליחת שם הפרויקט, העיר או המזהים, הממשק דורש אישור מפורש ומציג אילו נתונים יישלחו. כל תוצאה נשמרת עם כתובת המקור ומסומנת `דורש בדיקה`; היא אינה משנה עובדות בפרויקט באופן אוטומטי.

ששת מקורות ה־MVP האחרים עדיין אינם מחוברים ומתועדים בממשק כ־`טרם נתמך אוטומטית`.

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
```

הנתונים והמסמכים המקומיים נשמרים תחת `data/` ואינם נכנסים ל־Git.
