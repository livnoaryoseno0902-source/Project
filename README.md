
+# Pollinations AI Code Studio
+
+A lightweight browser-based code editor with an integrated AI agent powered by Pollinations AI.
+
+## Features
+
+- Editable code workspace with synced line numbers.
+- Built-in AI agent actions for review, bug fixing, explanations, and test suggestions.
+- Custom prompt box for free-form coding tasks.
+- One-click apply flow for AI responses that include a fenced replacement code block.
+
+## Run locally
+
+Because this project is a static web app, you can open `index.html` directly in a browser or serve it with a simple local server.
+
+```bash
+python3 -m http.server 8000
+```
+
+Then open <http://localhost:8000>.
+
+## Pollinations AI integration
+
+The app sends chat completion requests to the Pollinations AI OpenAI-compatible endpoint:
+
+- `POST https://text.pollinations.ai/openai`
+
+The browser app submits the current editor contents plus your instruction, then renders the assistant reply in the conversation panel.
