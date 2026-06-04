import test from "node:test";
import assert from "node:assert/strict";
import { mapBusinessToSector } from "../src/lib/marketData/hsCodeMapper.ts";

test("sector mapping uses relevant HS/activity codes", () => {
  assert.deepEqual(mapBusinessToSector("Кофейня").possibleHsCodes, []);
  assert.deepEqual(mapBusinessToSector("Производство игрушек").possibleHsCodes, ["9503"]);
  assert.deepEqual(mapBusinessToSector("Швейный цех").possibleHsCodes, ["61", "62", "63"]);
});
