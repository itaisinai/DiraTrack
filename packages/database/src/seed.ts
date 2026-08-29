import "dotenv/config";
import { closeDatabase, getDatabase } from "./index.ts";
import { createProject, ensureLocalUser, findProjectBySlug } from "./projects.ts";

const db = getDatabase();

try {
  const user = await ensureLocalUser(db, "Itai");
  const existing = await findProjectBySlug(db, user.id, "גני-יהודה-הגרלה-2642");

  if (!existing) {
    await createProject(db, user.id, {
      name: "גני יהודה — הגרלה 2642",
      city: "יהוד־מונוסון",
      developer: "אסיה סיירוס",
      identifiers: [{ type: "lottery-number", value: "2642", origin: "winning-message" }],
    });
    console.log("Seeded local DiraTrack project");
  } else {
    console.log("Local DiraTrack project already exists; nothing changed");
  }
} finally {
  await closeDatabase();
}
