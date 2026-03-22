const DEFAULT_ENDPOINT = "https://gen.pollinations.ai/v1/chat/completions";
const LEGACY_ENDPOINT = "https://text.pollinations.ai/openai";
const STORAGE_KEY = "pollinations-executable-editor-settings";

const STARTER_FILES = {
  html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Neon Counter</title>
  </head>
  <body>
    <main class="app">
      <h1>Neon Counter</h1>
      <p>Live-edit this app or ask the AI to replace it.</p>
      <button id="incrementButton">Count: <span id="countValue">0</span></button>
    </main>
  </body>
</html>
`,
  css: `body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family: Inter, system-ui, sans-serif;
  background: radial-gradient(circle at top, #1f3b73, #08101f 55%);
  color: #f2f7ff;
}

.app {
  text-align: center;
  padding: 2rem;
  border-radius: 24px;
  background: rgba(8, 16, 31, 0.76);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}

button {
  margin-top: 1rem;
  padding: 0.9rem 1.3rem;
  border: 0;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}
`,
  js: `const countValue = document.getElementById("countValue");
const incrementButton = document.getElementById("incrementButton");

let count = 0;

incrementButton.addEventListener("click", () => {
  count += 1;
  countValue.textContent = count;
});
`
};

const PROMPT_TEMPLATES = {
  snake: {
    mode: "build",
    prompt:
      "Build a complete snake game with score tracking, keyboard controls, restart support, collision detection, responsive layout, and polished arcade styling."
  },
  landing: {
    mode: "build",
    prompt:
      "Build a modern landing page with a hero section, feature cards, pricing section, call-to-action buttons, and smooth reveal animations using only HTML, CSS, and JavaScript."
  },
  todo: {
    mode: "build",
    prompt:
      "Build a polished todo app with add, complete, delete, filter, and localStorage persistence. Keep the UI responsive and visually appealing."
  },
  debug: {
    mode: "fix",
    prompt:
      "Inspect the current project, identify likely bugs or broken behavior, fix them, and return the full updated files."
  }
};

const editor = document.querySelector("#codeEditor");
const lineNumbers = document.querySelector("#lineNumbers");
const previewFrame = document.querySelector("#previewFrame");
const messages = document.querySelector("#messages");
const statusText = document.querySelector("#statusText");
const goalInput = document.querySelector("#goalInput");
const endpointInput = document.querySelector("#endpointInput");
const apiKeyInput = document.querySelector("#apiKeyInput");
const modelSelect = document.querySelector("#modelSelect");
const modeSelect = document.querySelector("#modeSelect");
const runAgentButton = document.querySelector("#runAgentButton");
const applyChangesButton = document.querySelector("#applyChangesButton");
const copyFileButton = document.querySelector("#copyFileButton");
const resetExampleButton = document.querySelector("#resetExampleButton");
const runPreviewButton = document.querySelector("#runPreviewButton");
const openPreviewButton = document.querySelector("#openPreviewButton");
const clearChatButton = document.querySelector("#clearChatButton");
const activeFileLabel = document.querySelector("#activeFileLabel");
const fileTabs = [...document.querySelectorAll(".tab")];
const promptTemplateButtons = [...document.querySelectorAll("[data-template]")];
const messageTemplate = document.querySelector("#messageTemplate");

const fileLabels = {
  html: "index.html",
  css: "styles.css",
  js: "script.js"
};

const conversation = [];
const projectFiles = { ...STARTER_FILES };
let activeFile = "html";
let latestAssistantPayload = null;

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveSettings() {
  const payload = {
    endpoint: endpointInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
    model: modelSelect.value
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function hydrateSettings() {
  const saved = loadSettings();
  endpointInput.value = saved.endpoint || DEFAULT_ENDPOINT;
  apiKeyInput.value = saved.apiKey || "";
  if (saved.model) {
    modelSelect.value = saved.model;
  }
}

function getConfiguredEndpoints() {
  const configured = endpointInput.value.trim() || DEFAULT_ENDPOINT;
  const endpoints = [configured];

  if (configured !== LEGACY_ENDPOINT) {
    endpoints.push(LEGACY_ENDPOINT);
  }

  return endpoints;
}

function buildHeaders(endpoint, apiKey) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json"
  };

  if (apiKey && endpoint.includes("gen.pollinations.ai")) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

async function postChatCompletion(endpoint, body, apiKey) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: buildHeaders(endpoint, apiKey),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`${endpoint} responded with ${response.status}: ${details || "No response body."}`);
  }

  return response.json();
}

function getPreviewDocument(files = projectFiles) {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(files.html, "text/html");
  const styleTag = documentNode.createElement("style");
  const scriptTag = documentNode.createElement("script");

  styleTag.textContent = files.css;
  scriptTag.textContent = files.js;

  documentNode.head.append(styleTag);
  documentNode.body.append(scriptTag);

  return "<!doctype html>\n" + documentNode.documentElement.outerHTML;
}

function setStatus(message, type = "info") {
  statusText.textContent = message;
  statusText.style.color = type === "error" ? "#ff9c9c" : "#9eb2d1";
}

function updateLineNumbers() {
  const lineCount = editor.value.split("\n").length;
  lineNumbers.textContent = Array.from({ length: lineCount }, (_, index) => index + 1).join("\n");
}

function syncEditorToState() {
  projectFiles[activeFile] = editor.value;
}

function syncScroll() {
  lineNumbers.scrollTop = editor.scrollTop;
}

function switchFile(fileKey, shouldSync = true) {
  if (shouldSync) {
    syncEditorToState();
  }

  activeFile = fileKey;
  activeFileLabel.textContent = fileLabels[fileKey];
  editor.value = projectFiles[fileKey];
  updateLineNumbers();

  fileTabs.forEach((tab) => {
    const isActive = tab.dataset.file === fileKey;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
}

function runPreview() {
  syncEditorToState();
  previewFrame.srcdoc = getPreviewDocument();
  setStatus("Preview updated.");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMessageBody(text) {
  const segments = text.split(/```/g);

  return segments
    .map((segment, index) => {
      if (index % 2 === 1) {
        const cleaned = segment.replace(/^\w+\n/, "");
        return `<pre><code>${escapeHtml(cleaned)}</code></pre>`;
      }

      return escapeHtml(segment).replace(/\n/g, "<br>");
    })
    .join("");
}

function appendMessage(role, body) {
  const fragment = messageTemplate.content.cloneNode(true);
  fragment.querySelector(".message-meta").textContent = role === "user" ? "You" : "Pollinations Agent";
  fragment.querySelector(".message-body").innerHTML = formatMessageBody(body);
  messages.appendChild(fragment);
  messages.scrollTop = messages.scrollHeight;
}

function setBusy(isBusy) {
  runAgentButton.disabled = isBusy;
  promptTemplateButtons.forEach((button) => {
    button.disabled = isBusy;
  });
}

function projectSnapshot() {
  return {
    "index.html": projectFiles.html,
    "styles.css": projectFiles.css,
    "script.js": projectFiles.js
  };
}

function buildInstruction(goal) {
  const modes = {
    build: "Create a complete new app based on the request.",
    edit: "Modify the current app to satisfy the request while preserving working parts.",
    fix: "Audit the current app, identify bugs, and return corrected files.",
    explain: "Explain how the current app works. Only change files if a fix is absolutely necessary."
  };

  return [modes[modeSelect.value], goal].join(" ");
}

function extractJsonBlock(text) {
  const fencedJsonMatch = text.match(/```json\n([\s\S]*?)```/i);
  if (fencedJsonMatch) {
    return fencedJsonMatch[1].trim();
  }

  const genericMatch = text.match(/\{[\s\S]*"files"[\s\S]*\}/);
  return genericMatch ? genericMatch[0].trim() : "";
}

function extractCodeBlocksByLanguage(text) {
  const matches = [...text.matchAll(/```(html|css|javascript|js)\n([\s\S]*?)```/gi)];
  if (!matches.length) {
    return null;
  }

  const files = {};
  for (const match of matches) {
    const language = match[1].toLowerCase();
    const content = match[2].trim();

    if (language === "html") {
      files.html = content;
    } else if (language === "css") {
      files.css = content;
    } else {
      files.js = content;
    }
  }

  return Object.keys(files).length ? files : null;
}

function normalizeAssistantPayload(text) {
  const jsonBlock = extractJsonBlock(text);

  if (jsonBlock) {
    try {
      const parsed = JSON.parse(jsonBlock);
      const files = parsed.files ?? parsed;
      return {
        summary: parsed.summary ?? "AI response parsed successfully.",
        files: {
          html: files["index.html"] ?? files.html ?? projectFiles.html,
          css: files["styles.css"] ?? files.css ?? projectFiles.css,
          js: files["script.js"] ?? files.js ?? projectFiles.js
        }
      };
    } catch (error) {
      console.warn("Failed to parse JSON payload", error);
    }
  }

  const languageFiles = extractCodeBlocksByLanguage(text);
  if (languageFiles) {
    return {
      summary: "AI returned code blocks.",
      files: {
        html: languageFiles.html ?? projectFiles.html,
        css: languageFiles.css ?? projectFiles.css,
        js: languageFiles.js ?? projectFiles.js
      }
    };
  }

  return null;
}

function applyAssistantPayload(payload) {
  projectFiles.html = payload.files.html;
  projectFiles.css = payload.files.css;
  projectFiles.js = payload.files.js;
  switchFile(activeFile, false);
  runPreview();
  setStatus("Applied the latest AI-generated files.");
}

function formatFetchFailure(errorMessages) {
  return [
    "The Pollinations request could not be completed.",
    ...errorMessages.map((message, index) => `${index + 1}. ${message}`),
    "Tips:",
    "- Check the endpoint URL.",
    "- If you are using gen.pollinations.ai, add a publishable API key.",
    "- If the browser still says 'Failed to fetch', it is usually a network, CORS, or provider-side issue."
  ].join("\n");
}

async function callPollinationsAgent(goal) {
  syncEditorToState();
  saveSettings();

  const instruction = buildInstruction(goal);
  const systemPrompt = [
    "You are an expert front-end coding agent working inside a live browser IDE.",
    "Always reason about a 3-file project made of index.html, styles.css, and script.js.",
    "When asked to build, edit, or fix code, return a JSON object inside one fenced json block.",
    'Use this shape: {"summary":"short summary","files":{"index.html":"...","styles.css":"...","script.js":"..."}}.',
    "Return complete file contents for every file when code changes are needed.",
    "For explain-only requests, you may omit changes, but still keep the explanation concise and useful."
  ].join(" ");

  const requestBody = {
    model: modelSelect.value,
    private: true,
    messages: [
      { role: "system", content: systemPrompt },
      ...conversation,
      {
        role: "user",
        content: [
          `Mode: ${modeSelect.value}`,
          `Goal: ${instruction}`,
          "Current project files:",
          "```json",
          JSON.stringify(projectSnapshot(), null, 2),
          "```"
        ].join("\n")
      }
    ]
  };

  appendMessage("user", `${modeSelect.options[modeSelect.selectedIndex].text}: ${goal}`);
  conversation.push(requestBody.messages.at(-1));
  setBusy(true);
  setStatus("Calling Pollinations AI agent...");

  const apiKey = apiKeyInput.value.trim();
  const endpoints = getConfiguredEndpoints();
  const attemptErrors = [];

  try {
    let payload;

    for (const endpoint of endpoints) {
      try {
        payload = await postChatCompletion(endpoint, requestBody, apiKey);
        break;
      } catch (error) {
        attemptErrors.push(error.message);
      }
    }

    if (!payload) {
      throw new Error(formatFetchFailure(attemptErrors));
    }

    const reply = payload?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error("Pollinations returned an empty response.");
    }

    conversation.push({ role: "assistant", content: reply });
    appendMessage("assistant", reply);

    latestAssistantPayload = normalizeAssistantPayload(reply);
    applyChangesButton.disabled = !latestAssistantPayload;
    setStatus(
      latestAssistantPayload
        ? "AI response received. Apply the generated files to update the editor and preview."
        : "AI response received. No structured file update was detected."
    );
  } catch (error) {
    appendMessage("assistant", `Request failed.\n\n${error.message}`);
    setStatus("Pollinations request failed. Check the endpoint and API key fields.", "error");
  } finally {
    setBusy(false);
  }
}

function loadStarterProject() {
  projectFiles.html = STARTER_FILES.html;
  projectFiles.css = STARTER_FILES.css;
  projectFiles.js = STARTER_FILES.js;
  switchFile(activeFile, false);
  runPreview();
  setStatus("Loaded the starter example project.");
}

editor.addEventListener("input", () => {
  syncEditorToState();
  updateLineNumbers();
  runPreview();
});
editor.addEventListener("scroll", syncScroll);

fileTabs.forEach((tab) => {
  tab.addEventListener("click", () => switchFile(tab.dataset.file));
});

[endpointInput, apiKeyInput].forEach((input) => {
  input.addEventListener("change", saveSettings);
  input.addEventListener("blur", saveSettings);
});
modelSelect.addEventListener("change", saveSettings);

runAgentButton.addEventListener("click", () => {
  const goal = goalInput.value.trim();
  if (!goal) {
    setStatus("Describe what the AI should build or fix first.", "error");
    return;
  }

  callPollinationsAgent(goal);
});

applyChangesButton.addEventListener("click", () => {
  if (!latestAssistantPayload) {
    setStatus("No AI-generated files are ready to apply.", "error");
    return;
  }

  applyAssistantPayload(latestAssistantPayload);
});

copyFileButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(editor.value);
    setStatus(`Copied ${fileLabels[activeFile]} to the clipboard.`);
  } catch (error) {
    setStatus(`Clipboard unavailable: ${error.message}`, "error");
  }
});

runPreviewButton.addEventListener("click", runPreview);

openPreviewButton.addEventListener("click", () => {
  syncEditorToState();
  const previewWindow = window.open();
  if (!previewWindow) {
    setStatus("Popup blocked. Allow popups to open the preview in a new tab.", "error");
    return;
  }

  previewWindow.document.write(getPreviewDocument());
  previewWindow.document.close();
});

resetExampleButton.addEventListener("click", loadStarterProject);

clearChatButton.addEventListener("click", () => {
  messages.innerHTML = "";
  conversation.length = 0;
  latestAssistantPayload = null;
  applyChangesButton.disabled = true;
  appendMessage(
    "assistant",
    "Conversation cleared. Your current project files remain in the editor and preview."
  );
  setStatus("Conversation cleared.");
});

promptTemplateButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const template = PROMPT_TEMPLATES[button.dataset.template];
    modeSelect.value = template.mode;
    goalInput.value = template.prompt;
    callPollinationsAgent(template.prompt);
  });
});

hydrateSettings();
switchFile("html");
appendMessage(
  "assistant",
  "Describe an app to build, like `make a snake game`, then apply the AI files and run the preview. If the request fails, try adding a publishable Pollinations key or switching endpoints."
);
runPreview();
      
