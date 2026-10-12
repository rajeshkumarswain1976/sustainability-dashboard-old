# Yggdrasil Stewardship Systems

A React 19 and Vite dashboard for sustainability and facilities operations. The welcome journey lets users choose a public or private institution, enter one of three operational worlds, and sign in to the shared dashboard experience.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Run locally

```sh
npm install
npm run dev
```

Vite prints the local development URL after startup. Build and preview the production bundle with:

```sh
npm run build
npm run preview
```

Run the configured Oxlint checks with `npm run lint`.

## Welcome journey

1. Enter the animated Yggdrasil welcome scene.
2. Choose Government / Public or Private institution.
3. Choose Campus A, Company / Municipality, or Hospital Network.
4. Select a role and sign in.

The landing page places an animated, wide-canopied Yggdrasil at the center of the hero. Clickable branch markers select Campus A, Company / Municipality, or Hospital Network and update the sector overview below. The tree camera moves between root, canopy, and trunk views; its trunk, roots, branches, shoots, foliage, and institutional landscapes are animated.

The landing page continues with the operational problems the platform addresses, shared dashboard capabilities, the five-person development team, and a contact form preview. About, Platform, Team, and Contact navigation links scroll to their sections. Each world has its own accent color. The light/dark preference is shared across welcome and dashboard screens and saved in browser local storage.

## Demo accounts

Select a role preset on the sign-in screen to fill in its demo credentials:

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@campusa.edu` | `admin` |
| Department Head | `head.science@campusa.edu` | `head` |
| Staff | `staff.facilities@campusa.edu` | `staff` |

These are demonstration credentials, not production authentication.

The contact form currently shows a local confirmation only. Connect an email or form service before using it to deliver real enquiries.

## Project structure

- `src/main.jsx` mounts the React application and imports its styles.
- `src/App.jsx` provides the authenticated dashboard shell and module routing.
- `src/pages/WelcomeJourney.jsx` implements institution, world, and role selection.
- `src/components/LivingYggdrasil.jsx` builds and animates the Three.js world tree.
- `src/context/DashboardContext.jsx` stores authentication, world selection, theme, filters, and dashboard state.
- `src/journey.css` styles the welcome journey and light-mode overrides.
- `index.html` is Vite's application mount document; UI and behavior are implemented in React components.

Dashboard telemetry and operational records are illustrative sample data. No production backend or live authentication service is configured.
