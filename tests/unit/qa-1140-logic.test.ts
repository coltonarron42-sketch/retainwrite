import { it, expect } from "vitest";
import { contradictsThesis } from "@/lib/coaching/logicCheck";
it("x", () => {
  const n = "Transformational leadership is bad for change I guess, situational is way better, so Nadella probably did it wrong.";
  const r = contradictsThesis(n, "I'd pick transformational because it seems like it helps a team get through change, like when a coach rallies everyone");
  console.log(JSON.stringify(r));
  expect(r?.term).toBe("transformational");
  expect(contradictsThesis("Servant leadership is not about control.", "I'd pick transformational because people buy in")).toBeNull();
});
