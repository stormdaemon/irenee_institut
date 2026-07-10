import assert from "node:assert/strict";
import test from "node:test";
import { buildCourseJourney } from "./course-experience";

test("course preview keeps every module reachable without changing completed/current semantics", () => {
  const modules = [
    { id: "one", titre: "Un" },
    { id: "two", titre: "Deux" },
    { id: "three", titre: "Trois" },
  ];

  const journey = buildCourseJourney(modules, [
    { module_id: "one", progression: 100, complete: true },
    { module_id: "two", progression: 20, complete: false },
  ], { unlockAll: true });

  assert.equal(journey.completedCount, 1);
  assert.equal(journey.resumeModule?.id, "two");
  assert.deepEqual(journey.modules.map(item => item.state), ["complete", "current", "available"]);
});

test("course journey remains sequential unless unlockAll is explicitly enabled", () => {
  const modules = [{ id: "one" }, { id: "two" }, { id: "three" }];

  assert.deepEqual(
    buildCourseJourney(modules, []).modules.map(item => item.state),
    ["current", "locked", "locked"],
  );
  assert.deepEqual(
    buildCourseJourney(modules, [], { unlockAll: true }).modules.map(item => item.state),
    ["current", "available", "available"],
  );
});
