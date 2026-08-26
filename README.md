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
