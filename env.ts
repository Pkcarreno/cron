import * as v from "valibot";

import packageJSON from "./package.json";

const getBuildNumber = (): number => {
  const [major, minor, patch] = packageJSON.version.split(".").map(Number);
  return major * 10_000 + minor * 100 + patch;
};

// Single unified environment schema
const envSchema = v.object({
  EXPO_PUBLIC_APP_ENV: v.picklist(["development", "preview", "production"]),
  EXPO_PUBLIC_BUILD_NUMBER: v.number(),
  EXPO_PUBLIC_BUNDLE_ID: v.string(),
  EXPO_PUBLIC_NAME: v.string(),
  EXPO_PUBLIC_PACKAGE: v.string(),
  EXPO_PUBLIC_SCHEME: v.string(),
  EXPO_PUBLIC_VERSION: v.string(),
});

type EnvValues = v.InferOutput<typeof envSchema>;

// Config records per environment
const EXPO_PUBLIC_APP_ENV = (process.env.EXPO_PUBLIC_APP_ENV ??
  "development") as EnvValues["EXPO_PUBLIC_APP_ENV"];

const BUNDLE_IDS = {
  development: "com.pkcarreno.cron.development",
  preview: "com.pkcarreno.cron.preview",
  production: "com.pkcarreno.cron",
} as const;

const PACKAGES = {
  development: "com.pkcarreno.cron.development",
  preview: "com.pkcarreno.cron.preview",
  production: "com.pkcarreno.cron",
} as const;

const SCHEMES = {
  development: "crn",
  preview: "crn.preview",
  production: "crn",
} as const;

const NAME = {
  development: "cron dev",
  preview: "cron preview",
  production: "cron",
} as const;

// Check if strict validation is required (before prebuild)
const STRICT_ENV_VALIDATION = process.env.STRICT_ENV_VALIDATION === "1";

// Build env object
const _env: EnvValues = {
  EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_BUILD_NUMBER: getBuildNumber(),
  EXPO_PUBLIC_BUNDLE_ID: BUNDLE_IDS[EXPO_PUBLIC_APP_ENV],
  EXPO_PUBLIC_NAME: NAME[EXPO_PUBLIC_APP_ENV],
  EXPO_PUBLIC_PACKAGE: PACKAGES[EXPO_PUBLIC_APP_ENV],
  EXPO_PUBLIC_SCHEME: SCHEMES[EXPO_PUBLIC_APP_ENV],
  EXPO_PUBLIC_VERSION: packageJSON.version,
};

const getValidatedEnv = (env: EnvValues) => {
  const parsed = v.safeParse(envSchema, env);

  if (parsed.success === false) {
    const fieldErrors = v.flatten(parsed.issues).nested;
    const errorMessage =
      `❌ Invalid environment variables:${JSON.stringify(
        fieldErrors,
        null,
        2
      )}\n❌ Missing variables in .env file for APP_ENV=${EXPO_PUBLIC_APP_ENV}` +
      `\n💡 Tip: If you recently updated the .env file, try restarting with -c flag to clear the cache.`;

    if (STRICT_ENV_VALIDATION) {
      console.error(errorMessage);
      throw new Error("Invalid environment variables");
    }
  } else {
    console.log("✅ Environment variables validated successfully");
  }

  return parsed.success ? parsed.output : env;
};

const Env = STRICT_ENV_VALIDATION ? getValidatedEnv(_env) : _env;

export default Env;
