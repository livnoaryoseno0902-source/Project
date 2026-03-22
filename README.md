
+# Pollinations AI Executable Editor
+
+A browser-based AI coding studio that can generate, edit, and run small apps using Pollinations AI.
+
+## What it does
+
+- Maintains a real three-file project: `index.html`, `styles.css`, and `script.js`.
+- Lets you ask the AI to build something new, edit the current app, fix bugs, or explain the code.
+- Runs the current project instantly inside a live preview iframe.
+- Applies the latest AI-generated files directly into the editor.
+- Supports a configurable Pollinations endpoint plus an optional publishable API key for browser requests.
+
+## If the agent says "failed to fetch"
+
+- Keep the default endpoint set to `https://gen.pollinations.ai/v1/chat/completions`.
+- Add your Pollinations publishable key in the UI when using `gen.pollinations.ai`.
+- If that still fails, the app automatically falls back to the legacy endpoint `https://text.pollinations.ai/openai`.
+- Browser-level `Failed to fetch` errors usually mean a network, CORS, or provider-side issue rather than a code parsing problem.
+
+## Example prompts
+
+- `Build a snake game with score, restart, and mobile-friendly controls.`
+- `Turn this into a weather dashboard with animated cards.`
+- `Fix any bugs in the current app and make the layout responsive.`
+
+## Run locally
+
+Open `index.html` directly in a browser, or serve the project locally:
+
+```bash
+python3 -m http.server 8000
+```
+
+Then open <http://localhost:8000>.
+
+## Pollinations AI integration
+
+The app sends OpenAI-compatible chat requests and expects a structured response containing replacement contents for `index.html`, `styles.css`, and `script.js`.
+
+Endpoints used by the app:
+
+- Primary: `https://gen.pollinations.ai/v1/chat/completions`
+- Fallback: `https://text.pollinations.ai/openai`
