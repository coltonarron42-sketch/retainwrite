import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Demo screens read localStorage after mount so server HTML can hydrate.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/server/hiddenDraft", "@/lib/server/hiddenDraft/*"],
              message:
                "Hidden-draft text stays in lib/server/hiddenDraft. Routes call lib/server/readback.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
