import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next*/**",
      "coverage/**",
      "next-env.d.ts",
      "node_modules/**",
      "tmp/**"
    ]
  },
  ...nextCoreWebVitals,
  ...nextTypeScript
];

export default eslintConfig;
