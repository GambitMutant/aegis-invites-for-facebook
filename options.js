const DEFAULTS = {
  delayMin: 1500,
  delayMax: 4500,
  dailyLimit: 2000,
  runLimit: 1000,
  maxPostsPerPage: 20,
  scanComments: true,
  onlyInviteNonFollowers: true,
  randomizeOrder: true,
  realTimeInterval: 5,
  multiPageUrls: []
};

function readForm() {
  const num = (id, fallback) => {
    const n = parseInt(document.getElementById(id).value, 10);
    return n > 0 ? n : fallback;
  };
  return {
    delayMin: num("delayMin", DEFAULTS.delayMin),
    delayMax: num("delayMax", DEFAULTS.delayMax),
    dailyLimit: num("dailyLimit", DEFAULTS.dailyLimit),
    runLimit: num("runLimit", DEFAULTS.runLimit),
    maxPostsPerPage: num("maxPosts", DEFAULTS.maxPostsPerPage),
    scanComments: document.getElementById("scanComments").checked,
    onlyInviteNonFollowers: document.getElementById("onlyNonFollowers").checked,
    randomizeOrder: document.getElementById("randomize").checked,
    realTimeInterval: num("rtInterval", DEFAULTS.realTimeInterval),
    multiPageUrls: document.getElementById("urls").value.split("\n").map((u) => u.trim()).filter(Boolean)
  };
}

function fillForm(s) {
  const src = Object.assign({}, DEFAULTS, s || {});
  document.getElementById("delayMin").value = src.delayMin;
  document.getElementById("delayMax").value = src.delayMax;
  document.getElementById("dailyLimit").value = src.dailyLimit;
  document.getElementById("runLimit").value = src.runLimit || 1000;
  document.getElementById("maxPosts").value = src.maxPostsPerPage;
  document.getElementById("scanComments").checked = src.scanComments !== false;
  document.getElementById("onlyNonFollowers").checked = src.onlyInviteNonFollowers !== false;
  document.getElementById("randomize").checked = src.randomizeOrder !== false;
  document.getElementById("rtInterval").value = src.realTimeInterval;
  document.getElementById("urls").value = (src.multiPageUrls || []).join("\n");
}

document.addEventListener("DOMContentLoaded", () => {
  const storage = (globalThis.chrome || globalThis.browser)?.storage?.local;
  if (!storage) {
    fillForm(DEFAULTS);
  } else {
    storage.get(["settings"], (res) => fillForm(res.settings));
  }

  document.getElementById("save").onclick = () => {
    const settings = readForm();
    const done = () => {
      const status = document.getElementById("status");
      status.textContent = "Settings saved";
      setTimeout(() => { status.textContent = ""; }, 2200);
    };
    if (!storage) {
      done();
      return;
    }
    storage.set({ settings }, done);
  };
});
