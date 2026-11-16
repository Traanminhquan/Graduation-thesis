// Offline check: the lesson lists group by the five CEFR levels only when every item has one.
import { groupByLevel } from "../src/components/practice-list";
import { sharedMessages } from "../src/i18n/messages/shared";

const labels = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };
const toItem = (row: { id: string }) => ({ id: row.id, href: `/x/${row.id}`, title: row.id, facts: [], actionLabel: "Start" });
let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
}
const shape = (groups: { label: string; items: { id: string }[] }[]) =>
  groups.map((g) => `${g.label}:${g.items.map((i) => i.id).join(",")}`).join(" | ");

const labelled = [
  { id: "c", difficulty: "ADVANCED", cefr: "C1" },
  { id: "a", difficulty: "BEGINNER", cefr: "A1" },
  { id: "b", difficulty: "INTERMEDIATE", cefr: "B1" },
  { id: "a2", difficulty: "BEGINNER", cefr: "A2" },
];
const byCefr = shape(groupByLevel(labelled, labels, toItem));
const cefrGroups = groupByLevel(labelled, labels, toItem);
check("CEFR groups carry locale-independent keys", cefrGroups.map((g) => g.level).join() === "A1,A2,B1,C1");
check("Vietnamese CEFR labels come from the shared table", cefrGroups.map((g) => g.level ? sharedMessages.vi.levels[g.level] : g.label).join(" | ") === "A1 Mới bắt đầu | A2 Sơ cấp | B1 Trung cấp | C1 Cao cấp");
check("every item labelled: five CEFR groups in order, empty ones dropped", byCefr === "A1 Beginner:a | A2 Elementary:a2 | B1 Intermediate:b | C1 Advanced:c", byCefr);

const partly = [...labelled, { id: "n", difficulty: "BEGINNER", cefr: null }];
const byDifficulty = shape(groupByLevel(partly, labels, toItem));
check("one item unlabelled: falls back to the three difficulty groups", byDifficulty === "Beginner:a,a2,n | Intermediate:b | Advanced:c", byDifficulty);

const noField = shape(groupByLevel([{ id: "s", difficulty: "INTERMEDIATE" }], labels, toItem));
check("rows without a cefr field (conversation scenarios) keep difficulty groups", noField === "Intermediate:s", noField);
check("empty list gives no groups", groupByLevel([], labels, toItem).length === 0);

console.log(failures === 0 ? "PASS practice-list level grouping" : `FAIL ${failures}`);
if (failures > 0) process.exitCode = 1;
