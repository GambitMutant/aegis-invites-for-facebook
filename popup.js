document.addEventListener("DOMContentLoaded", () => {
  const ext = globalThis.chrome || globalThis.browser;
  if (ext?.runtime?.sendMessage) {
    ext.runtime.sendMessage({ action: "getSettings" }, (res) => {
      if (res?.stats) {
        document.getElementById("today-count").textContent = res.stats.invitesToday || 0;
        document.getElementById("total-count").textContent = res.stats.totalInvites || 0;
      }
    });
  }

  document.getElementById("open-options").onclick = () => {
    const rt = (globalThis.chrome || globalThis.browser)?.runtime;
    if (rt?.openOptionsPage) {
      rt.openOptionsPage();
      window.close();
      return;
    }
    if (rt?.sendMessage) {
      rt.sendMessage({ action: "openOptions" });
      window.close();
      return;
    }
    location.href = "options.html";
  };

  document.getElementById("open-fb").onclick = () => {
    const tabs = (globalThis.chrome || globalThis.browser)?.tabs;
    if (tabs?.create) {
      tabs.create({ url: "https://www.facebook.com/" });
      window.close();
      return;
    }
    window.open("https://www.facebook.com/", "_blank", "noopener");
  };
});
