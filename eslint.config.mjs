import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
	{
		ignores: [
			"**/.open-next/**",
			"**/.vercel/**",
			"**/.wrangler/**",
			"**/.next/**",
			"**/dist/**",
			"**/node_modules/**",
			"**/out/**",
			"env.d.ts",
		],
	},
	js.configs.recommended,
	{
		files: ["**/*.{ts,tsx}"],
		plugins: {
			"@typescript-eslint": tsPlugin,
			"@next/next": nextPlugin,
		},
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: "./tsconfig.json",
			},
		},
		rules: {
			...tsPlugin.configs.recommended.rules,
			...nextPlugin.configs.recommended.rules,
			...nextPlugin.configs["core-web-vitals"].rules,
			"no-undef": "off",
		},
	},
	{
		files: [
			"app/components/ClientTimestamp.tsx",
			"app/components/ProseContent.tsx",
			"app/components/ThemeToggle.tsx",
		],
		rules: {
			"react-hooks/set-state-in-effect": "off",
		},
	},
];
