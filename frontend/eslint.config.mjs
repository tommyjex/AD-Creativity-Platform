import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".next-acceptance/**",
      ".next-home-gallery-acceptance/**",
      ".next-home-gallery-acceptance-3003/**",
      ".next-home-gallery-acceptance-3004/**",
      "coverage/**",
      "next-env.d.ts",
      "node_modules/**"
    ]
  },
  ...nextCoreWebVitals,
  ...nextTypeScript
];

export default eslintConfig;
