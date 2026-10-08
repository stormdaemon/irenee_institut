import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Brand } from "../../components/Brand";
describe("Approved stained-glass identity", () => {
 test("brand exposes the full institute name and a real image emblem without redundant alt text", () => {
  const html=renderToStaticMarkup(<Brand />);
  expect(html).toContain("Institut Apostolos Saint Irénée");
  expect(html).toContain("/images/apostolos/vitrail/emblem.webp");
  expect(html).toContain('aria-hidden="true"');
 });
});

