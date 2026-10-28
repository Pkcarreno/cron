import type { ExpoConfig } from "@expo/config";
import type {
  AndroidConfig,
  ExportedConfigWithProps,
} from "@expo/config-plugins";

import Env from "../env";
import { setProfileableManifest, withProfileable } from "./with-profileable";

const createBaseManifest = (options?: {
  debuggable?: string;
  hasExistingProfileable?: boolean;
}): AndroidConfig.Manifest.AndroidManifest => ({
  manifest: {
    $: {
      "xmlns:android": "http://schemas.android.com/apk/res/android",
    },
    application: [
      {
        $: {
          "android:name": ".MainApplication",
          ...(options?.debuggable
            ? { "android:debuggable": options.debuggable }
            : {}),
        },
        ...(options?.hasExistingProfileable
          ? {
              profileable: [
                {
                  $: {
                    "android:shell": "true",
                  },
                },
              ],
            }
          : {}),
      },
    ],
    queries: [],
  },
});

type ManifestModFunction = (props: {
  modResults: AndroidConfig.Manifest.AndroidManifest;
}) => Promise<{ modResults: AndroidConfig.Manifest.AndroidManifest }>;

describe("withProfileable config plugin", () => {
  describe("setProfileableManifest", () => {
    it("injects profileable tag with android:shell='true' when enabled is true", () => {
      const initialManifest = createBaseManifest();
      const updatedManifest = setProfileableManifest(initialManifest, true);

      const application = updatedManifest.manifest.application?.[0] as Record<
        string,
        unknown
      >;
      const profileable = application.profileable as {
        $: { "android:shell": string };
      }[];

      expect(profileable).toBeDefined();
      expect(profileable).toHaveLength(1);
      expect(profileable[0].$["android:shell"]).toBe("true");
    });

    it("ensures android:debuggable is never true when enabled is true", () => {
      const initialManifest = createBaseManifest({ debuggable: "true" });
      const updatedManifest = setProfileableManifest(initialManifest, true);

      const application = updatedManifest.manifest.application?.[0];
      expect(application?.$["android:debuggable"]).not.toBe("true");
    });

    it("does not duplicate profileable tag if already present and enabled is true", () => {
      const initialManifest = createBaseManifest({
        hasExistingProfileable: true,
      });
      const updatedManifest = setProfileableManifest(initialManifest, true);

      const application = updatedManifest.manifest.application?.[0] as Record<
        string,
        unknown
      >;
      const profileable = application.profileable as {
        $: { "android:shell": string };
      }[];

      expect(profileable).toHaveLength(1);
      expect(profileable[0].$["android:shell"]).toBe("true");
    });

    it("removes profileable tag when enabled is false", () => {
      const initialManifest = createBaseManifest({
        hasExistingProfileable: true,
      });
      const updatedManifest = setProfileableManifest(initialManifest, false);

      const application = updatedManifest.manifest.application?.[0] as Record<
        string,
        unknown
      >;
      expect(application.profileable).toBeUndefined();
    });

    it("keeps manifest unchanged without profileable when enabled is false and none existed", () => {
      const initialManifest = createBaseManifest();
      const updatedManifest = setProfileableManifest(initialManifest, false);

      const application = updatedManifest.manifest.application?.[0] as Record<
        string,
        unknown
      >;
      expect(application.profileable).toBeUndefined();
    });

    it("safely handles manifest application when debuggable attribute is absent", () => {
      const initialManifest = createBaseManifest();
      expect(
        initialManifest.manifest.application?.[0].$["android:debuggable"]
      ).toBeUndefined();

      const updatedManifest = setProfileableManifest(initialManifest, true);

      const application = updatedManifest.manifest.application?.[0] as Record<
        string,
        unknown
      >;
      const appAttributes = application.$ as Record<string, string | undefined>;
      const profileable = application.profileable as {
        $: { "android:shell": string };
      }[];

      expect(appAttributes["android:debuggable"]).toBeUndefined();
      expect(profileable).toBeDefined();
      expect(profileable[0].$["android:shell"]).toBe("true");
    });
  });

  describe("withProfileable plugin wrapper", () => {
    it("modifies config android manifest mod when enabled via options", async () => {
      const baseConfig: ExpoConfig = {
        name: "test-app",
        slug: "test-app",
      };

      const configured = withProfileable(baseConfig, { enabled: true });
      const manifestMod = (
        configured as ExportedConfigWithProps<AndroidConfig.Manifest.AndroidManifest>
      ).mods?.android?.manifest as unknown as ManifestModFunction;

      expect(manifestMod).toBeDefined();

      const initialManifest = createBaseManifest();
      const modResult = await manifestMod({
        modResults: initialManifest,
      });

      const application = modResult.modResults.manifest
        .application?.[0] as Record<string, unknown>;
      const profileable = application.profileable as {
        $: { "android:shell": string };
      }[];

      expect(profileable).toBeDefined();
      expect(profileable[0].$["android:shell"]).toBe("true");
    });

    it("defaults enabled state to preview app environment when options omitted", async () => {
      const baseConfig: ExpoConfig = {
        name: "test-app",
        slug: "test-app",
      };

      const configured = withProfileable(baseConfig);
      const manifestMod = (
        configured as ExportedConfigWithProps<AndroidConfig.Manifest.AndroidManifest>
      ).mods?.android?.manifest as unknown as ManifestModFunction;

      expect(manifestMod).toBeDefined();

      const initialManifest = createBaseManifest();
      const modResult = await manifestMod({
        modResults: initialManifest,
      });

      const application = modResult.modResults.manifest
        .application?.[0] as Record<string, unknown>;
      const expectedEnabled = Env.EXPO_PUBLIC_APP_ENV === "preview";

      if (expectedEnabled) {
        expect(application.profileable).toBeDefined();
      } else {
        expect(application.profileable).toBeUndefined();
      }
    });
  });
});
