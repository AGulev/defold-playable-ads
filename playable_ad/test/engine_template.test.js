const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const templatePath = path.join(__dirname, "..", "manifests", "web", "engine_template.html");
const template = fs.readFileSync(templatePath, "utf8");
const integrationStart = template.indexOf("      function getMraidApi() {");
const integrationEnd = template.indexOf("      // mraid Support", integrationStart);

assert(integrationStart >= 0, "CTA integration start was not found");
assert(integrationEnd > integrationStart, "CTA integration end was not found");

const integrationSource = template
  .slice(integrationStart, integrationEnd)
  .replace("{{playable_ad.app_store_url}}", "https://example.com/ios")
  .replace("{{playable_ad.google_play_url}}", "https://example.com/android");

function createPlayable(options = {}) {
  const calls = [];
  const window = {
    navigator: { userAgent: options.userAgent || "Android" },
    open(url, target) {
      calls.push(["browser", url, target]);
    },
  };

  if (options.facebook) {
    window.FbPlayableAd = {
      onCTAClick() {
        calls.push(["facebook"]);
      },
    };
  }
  if (options.mraid) {
    window.mraid = {
      open(url) {
        calls.push(["mraid", url]);
      },
    };
  }
  if (options.mintegral) {
    window.install = function () {
      calls.push(["mintegral"]);
    };
  }
  if (options.admob) {
    window.ExitApi = {
      exit() {
        calls.push(["admob"]);
      },
    };
  }

  const context = {
    console,
    window,
    FbPlayableAd: window.FbPlayableAd,
    ExitApi: window.ExitApi,
  };
  vm.runInNewContext(integrationSource, context);
  return { playable: window.Playable, calls };
}

function assertRoute(options, expected) {
  const { playable, calls } = createPlayable(options);
  playable.install();
  assert.deepStrictEqual(calls, [expected]);
}

assertRoute(
  { facebook: true, mraid: true, mintegral: true, admob: true },
  ["facebook"],
);
assertRoute(
  { mraid: true, mintegral: true, admob: true },
  ["mraid", "https://example.com/android"],
);
assertRoute(
  { mraid: true, mintegral: true, userAgent: "iPhone" },
  ["mraid", "https://example.com/ios"],
);
assertRoute(
  { mintegral: true, admob: true },
  ["mintegral"],
);
assertRoute(
  { admob: true },
  ["admob"],
);
assertRoute(
  {},
  ["browser", "https://example.com/android", "_blank"],
);

console.log("engine_template CTA routing tests passed");
