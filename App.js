const POLLINATIONS_ENDPOINT = "https://text.pollinations.ai/openai";
const DEFAULT_CODE = "function greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet(\"Pollinations AI\"));\n";

const editor = document.querySelector("#codeEditor");
const lineNumbers = document.querySelector("#lineNumbers");
const messages = document.querySelector("#messages");
const statusText = document.querySelector("#statusText");
const goalInput = document.querySelector("#goalInput");
const modelSelect = document.querySelector("#modelSelect");
const runAgentButton = document.querySelector("#runAgentButton");
const copyCodeButton = document.querySelector("#copyCodeButton");
const applyCodeButton = document.querySelector("#applyCodeButton");
const clearChatButton = document.querySelector("#clearChatButton");
const messageTemplate = document.querySelector("#messageTemplate");

const cannedPrompts = {
  review:
    "Review the code like a senior engineer. List strengths, bugs, and improvements. If a rewrite is needed, provide the full updated file in a fenced code block.",
  fix:
    "Find likely bugs or risky edge cases. Return a corrected full file in a fenced code block and explain the changes.",
  explain:
    "Explain what the current code does, its architecture, and the key tradeoffs in concise bullets.",
  tests:
    "Suggest practical test cases for this code, including edge cases and expected outcomes."
};

const conversation = [];
let latestCodeBlock = "";

function updateLineNumbers() {
  const lineCount = editor.value.split("\n").length;
  lineNumbers.textContent = Array.from({ length: lineCount }, (_, index) => index + 1).join("\n");
}

function syncScroll() {
  lineNumbers.scrollTop = editor.scrollTop;
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? "#ff9b9b" : "#93a4c3";
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

function extractCodeBlock(text) {
  const match = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
  return match ? match[1].trim() : "";
}

function appendMessage(role, body) {
  const fragment = messageTemplate.content.cloneNode(true);
  const messageNode = fragment.querySelector(".message");
  const metaNode = fragment.querySelector(".message-meta");
  const bodyNode = fragment.querySelector(".message-body");

  messageNode.dataset.role = role;
  metaNode.textContent = role === "user" ? "You" : "Pollinations Agent";
  bodyNode.innerHTML = formatMessageBody(body);
  messages.appendChild(fragment);
  messages.scrollTop = messages.scrollHeight;

  const codeBlock = extractCodeBlock(body);
  if (codeBlock) {
    latestCodeBlock = codeBlock;
    applyCodeButton.disabled = false;
  }
}

function setBusy(isBusy) {
  runAgentButton.disabled = isBusy;
  [...document.querySelectorAll("[data-prompt]")].forEach((button) => {
    button.disabled = isBusy;
  });
}

async function callPollinationsAgent(instruction) {
  const code = editor.value.trim();

  if (!code) {
    setStatus("Add some code before running the agent.", true);
    return;
  }

  const systemPrompt = [
    "You are an expert software engineering agent inside a browser code editor.",
    "Analyze the user's code carefully.",
    "If you provide revised code, return the complete file inside one fenced code block.",
    "Keep explanations actionable and concise."
  ].join(" ");

  const userPrompt = [
    `Goal: ${instruction}`,
    "Current file name: main.js",
    "Current code:",
    "```javascript",
    code,
    "```"
  ].join("\n");

  appendMessage("user", instruction);
  conversation.push({ role: "user", content: userPrompt });
  setBusy(true);
  setStatus("Calling Pollinations AI agent...");

  try {
    const response = await fetch(POLLINATIONS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelSelect.value,
        private: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...conversation
        ]
      })
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Pollinations request failed (${response.status}): ${details}`);
    }

    const payload = await response.json();
    const reply = payload?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error("Pollinations returned an empty response.");
    }

    conversation.push({ role: "assistant", content: reply });
    appendMessage("assistant", reply);
    setStatus("Agent response received.");
  } catch (error) {
    appendMessage("assistant", `Request failed.\n\n${error.message}`);
    setStatus(error.message, true);
  } finally {
    setBusy(false);
  }
}

function handlePromptShortcut(type) {
  const instruction = cannedPrompts[type];
  goalInput.value = instruction;
  callPollinationsAgent(instruction);
}

editor.value = DEFAULT_CODE;
updateLineNumbers();
applyCodeButton.disabled = true;
appendMessage(
  "assistant",
  "Ask the agent to review, explain, or rewrite the code. When the response includes a fenced code block, you can apply it directly to the editor."
);

editor.addEventListener("input", updateLineNumbers);
editor.addEventListener("scroll", syncScroll);

runAgentButton.addEventListener("click", () => {
  const instruction = goalInput.value.trim();
  if (!instruction) {
    setStatus("Add an agent goal first.", true);
    return;
  }

  callPollinationsAgent(instruction);
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => handlePromptShortcut(button.dataset.prompt));
});

copyCodeButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(editor.value);
    setStatus("Code copied to clipboard.");
  } catch (error) {
    setStatus(`Clipboard unavailable: ${error.message}`, true);
  }
});

applyCodeButton.addEventListener("click", () => {
  if (!latestCodeBlock) {
    setStatus("No code block available to apply.", true);
    return;
  }

  editor.value = latestCodeBlock;
  updateLineNumbers();
  setStatus("Latest AI code block applied to the editor.");
});

clearChatButton.addEventListener("click", () => {
  messages.innerHTML = "";
  conversation.length = 0;
  latestCodeBlock = "";
  applyCodeButton.disabled = true;
  appendMessage("assistant", "Conversation cleared. The editor content is unchanged.");
  setStatus("Conversation cleared.");
});
      
