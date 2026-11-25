import { db } from "../src/lib/db";
import { resequenceAllProjects } from "../src/lib/sno";

async function main() {
  console.log("Resequencing tasks across all projects...");
  await db.$transaction(async (tx) => {
    const changed = await resequenceAllProjects(tx);
    console.log(`Resequencing complete: ${changed} tasks updated.`);
  });

  const tasks = await db.task.findMany({
    select: { id: true, sno: true, title: true, projectId: true },
    orderBy: [{ projectId: "asc" }, { sno: "asc" }],
  });

  console.log("\n--- Current tasks in database ---");
  tasks.forEach((t) => {
    console.log(`S.No: ${t.sno} | ${t.title}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
