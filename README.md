# INTERCOODE

An in-development technical interview workspace with a React client and a Node.js/Socket.IO server. The source explores collaborative editing, interview rooms, video signaling, and code execution integrations.

This is a **sanitized development snapshot**, based on the local `Intercoode Ready` checkout of [CodePulseDL](https://github.com/varunallagh21022002/CodePulseDL), itself a fork of [DakshL1/CodePulse](https://github.com/DakshL1/CodePulse). The upstream MIT notice is preserved in `LICENSE`. Contributions and prior history belong to their respective authors; this snapshot does not claim sole authorship. The source checkout and its unpublished changes were not modified.

## Run locally

Use Node.js 20 or newer. Install dependencies in `Server` and `client` separately. Run `node app.js` inside `Server`, then `npm run dev` inside `client`. The client expects a local Socket.IO server on port 3000.

The front-end build was checked with Vite and completed with a missing CSS warning; this does not establish that every interview workflow works. The server currently has permissive cross-origin configuration and room membership requires a security review. **Do not expose it publicly as-is.** Authentication and code execution use external integrations. Credentials are intentionally omitted: Judge0 requires a separately supplied local key module, and the AI integration is disabled. Never place service secrets in browser code. Video connectivity may require a properly configured TURN service.

## Scope and status

This snapshot documents an active project, not a production-ready service. The public GitHub repository can serve as source evidence; availability of a working hosted demo depends on safe server configuration and external services. A frontend-only build cannot provide real-time collaboration on GitHub Pages by itself.
