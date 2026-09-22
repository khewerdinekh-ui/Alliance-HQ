ALLIANCE HQ — STANDALONE WEBSITE

This folder is ready to upload to a static web host such as Netlify, Cloudflare
Pages, GitHub Pages, or an ordinary web-hosting account.

QUICK PUBLISH
1. Keep all files and folders together.
2. Upload the contents of this folder to your host's public/site folder.
3. Make sure index.html is at the top level.
4. Open the host's public URL.

HOW THIS COPY WORKS
- No ChatGPT sign-in is required.
- Members and event changes are stored in the browser on that device.
- The starting member list is included.
- CSV import and manual entry work.
- Automatic photo/video reading is not included because that feature requires
  a private server and API key.
- Data is not shared between different devices or browsers in this static copy.

FILES
- index.html: page entry point
- api-shim.js: local browser storage and no-login adapter
- favicon.svg: browser icon
- _next/: the app's JavaScript and CSS files

IMPORTANT
Do not rename or move files inside the _next folder. If you later want shared
accounts and data across devices, the app will need a database and server-side
authentication rather than static hosting alone.
