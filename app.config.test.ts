import type { ConfigContext } from "@expo/config";

import appConfig from "./app.config";
import Env from "./env";

describe("appConfig", () => {
  it("registers with-abi-splits plugin with expected configuration", () => {
    const configContext: ConfigContext = {
      config: {
        name: "cron",
        slug: "cron",
      },
      packageJsonPath: "/mock/root/package.json",
      projectRoot: "/mock/root",
      staticConfigPath: null,
    };

    const evaluatedConfig = appConfig(configContext);

    expect(evaluatedConfig.plugins).toBeDefined();

    const abiSplitsPluginEntry = evaluatedConfig.plugins?.find((plugin) => {
      if (Array.isArray(plugin)) {
        return plugin[0] === "./plugins/with-abi-splits";
      }
      return plugin === "./plugins/with-abi-splits";
    });

    expect(abiSplitsPluginEntry).toBeDefined();
    expect(abiSplitsPluginEntry).toEqual([
      "./plugins/with-abi-splits",
      {
        architectures: ["arm64-v8a", "armeabi-v7a", "x86_64"],
        enabled: Env.EXPO_PUBLIC_APP_ENV === "production",
        universalApk: true,
      },
    ]);
  });
});
