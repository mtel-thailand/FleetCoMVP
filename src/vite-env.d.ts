/// <reference types="vite/client" />

// The app imports SVG and PNG files directly (Sidebar.tsx, LoginPage.tsx).
// Vite handles these at build time; this reference is what tells TypeScript
// they resolve to a URL string rather than failing as unknown modules.
