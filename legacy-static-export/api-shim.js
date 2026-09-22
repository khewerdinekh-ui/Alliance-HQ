/*
 * Alliance HQ standalone storage adapter.
 *
 * The original hosted app used private server endpoints. This adapter keeps the
 * same interface but stores alliance data in the visitor's browser, allowing
 * the exported app to run on an ordinary static host without ChatGPT sign-in.
 */
(() => {
  const nativeFetch = window.fetch.bind(window);
  const STORAGE_KEY = "alliance-hq-standalone-workspace-v1";
  const BUNDLE_URL = "./_next/static/chunks/page-BPyF9UxY.js";

  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

  const parseBundledMembers = async () => {
    try {
      const source = await nativeFetch(BUNDLE_URL).then((response) => response.text());
      const currentText = source.match(/var \$f=`([\s\S]*?)`,ep=/)?.[1] ?? "";
      const oldText = source.match(/,ep=`([\s\S]*?)`,tp=\$f\.trim/)?.[1] ?? "";

      const current = currentText.trim().split("\n").filter(Boolean).map((line, index) => {
        const [name, chiefId, alliance, allianceRank] = line.split("|");
        return {
          id: `sheet-current-${index}`,
          name,
          chiefId,
          alliance,
          allianceRank,
          power: "",
          allianceLevel: "",
          isCurrent: true,
          departureReason: "",
          dateLeft: "",
          aliases: [],
        };
      });

      const old = oldText.trim().split("\n").filter(Boolean).map((line, index) => {
        const [name, chiefId, alliance, power, allianceRank, dateLeft, departureReason] = line.split("|");
        return {
          id: `sheet-old-${index}`,
          name,
          chiefId,
          alliance,
          power,
          allianceLevel: "",
          allianceRank,
          isCurrent: false,
          departureReason,
          dateLeft,
          aliases: [],
        };
      });

      return [...current, ...old];
    } catch {
      return [];
    }
  };

  const newWorkspace = async () => ({
    onboarded: true,
    isAppOwner: false,
    alliance: {
      id: "local-alliance",
      name: "ICX",
      state: "686",
      subscriptionStatus: "active",
    },
    user: {
      userId: "local-owner",
      name: "Karina",
      role: "r5",
    },
    accessUsers: [{
      userId: "local-owner",
      name: "Karina",
      chiefId: "77624745",
      role: "r5",
    }],
    notifications: [],
    data: {
      members: await parseBundledMembers(),
      foundryEvents: [],
      canyonEvents: [],
      bearData: { times: ["", "", "", ""], events: [] },
    },
  });

  const loadWorkspace = async () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.onboarded && saved?.data) return saved;
    } catch {
      // Start with a clean local workspace if saved data is damaged.
    }
    const workspace = await newWorkspace();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    return workspace;
  };

  const saveWorkspace = (workspace) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    return workspace;
  };

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const path = new URL(url, window.location.href).pathname;
    const method = String(init.method || "GET").toUpperCase();

    if (path === "/api/workspace") {
      const workspace = await loadWorkspace();

      if (method === "GET") return jsonResponse(workspace);

      if (method === "PUT") {
        const body = JSON.parse(init.body || "{}");
        workspace.data = {
          members: body.members ?? workspace.data.members,
          foundryEvents: body.foundryEvents ?? workspace.data.foundryEvents,
          canyonEvents: body.canyonEvents ?? workspace.data.canyonEvents,
          bearData: body.bearData ?? workspace.data.bearData,
        };
        saveWorkspace(workspace);
        return jsonResponse({ ok: true });
      }

      if (method === "PATCH") {
        const body = JSON.parse(init.body || "{}");
        if (body.action === "settings") {
          if (typeof body.name === "string" && body.name.trim()) workspace.alliance.name = body.name.trim();
          if (typeof body.state === "string") workspace.alliance.state = body.state.trim();
        }
        if (body.action === "revealPassword") return jsonResponse({ password: "Stored locally—no password required" });
        saveWorkspace(workspace);
        return jsonResponse(workspace);
      }

      return jsonResponse(workspace);
    }

    if (path === "/api/analyze-foundry" && method === "GET") {
      return jsonResponse({ sharedApiConfigured: false });
    }

    if (path === "/api/analyze-foundry" || path === "/api/analyze-members") {
      return jsonResponse({
        error: "Automatic photo and video reading needs a server connection. CSV and manual entry still work in this standalone version.",
      }, 501);
    }

    if (path === "/api/contact") {
      return jsonResponse({ ok: true });
    }

    return nativeFetch(input, init);
  };
})();
