import { describe, expect, it } from "vitest";
import { indefiniteArticle, withArticle } from "@/lib/copy/articles";

describe("articles", () => {
  it("picks a/an and refuses instructions", () => {
    expect(withArticle("address at least one serious counterargument")).toBeNull();
    expect(withArticle("Include a Works Cited page")).toBeNull();
    expect(withArticle("Works Cited page")).toBe("a Works Cited page");
    expect(withArticle("abstract")).toBe("an abstract");
    expect(withArticle("annotated outline")).toBe("an annotated outline");
    expect(withArticle("one paragraph that answers a counterargument")).toBe("one paragraph that answers a counterargument");
    expect(withArticle("MLA heading")).toBe("an MLA heading");
    expect(withArticle("university library source")).toBe("a university library source");
    expect(withArticle("hour-long interview")).toBe("an hour-long interview");
    expect(indefiniteArticle("8–10")).toBe("an");
    expect(indefiniteArticle("11")).toBe("an");
    expect(indefiniteArticle("1,200–1,500")).toBe("a");
    expect(indefiniteArticle("800")).toBe("an");
    expect(indefiniteArticle("5–7")).toBe("a");
    expect(indefiniteArticle("APA")).toBe("an");
  });
});
