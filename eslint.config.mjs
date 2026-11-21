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
];

export default eslintConfig;
