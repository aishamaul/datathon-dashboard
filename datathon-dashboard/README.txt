DOSM DATATHON 2026 SUBMISSION
TEAM SENYIH — ISLAND TOURISM POLICY ENGINE DASHBOARD

5.1 SOFTWARE NAME AND VERSION USED

Runtime and framework:
  - Node.js            v20.9.0 or later (v20 LTS or v22 LTS recommended)
  - Next.js             v16.3.5
  - React               v19.2.8
  - React DOM           v19.2.8
  - TypeScript          v5.9.3

Key libraries:
  - Recharts            v3.8.0   (charting library used for all visualisations)
  - Lucide React         v1.47.0  (icon set used throughout the interface)
  - Tailwind CSS         v4.3.3   (styling)
  - next-themes          v0.4.6   (light / dark theme switching)
  - SheetJS xlsx          v0.18.5  (reads the source .xlsx workbook in-browser)

Package manager:
  - npm (as shipped with Node.js v20.9.0 or later)

No database, backend server, or external API is used. The dashboard is a
single Next.js application that reads its source workbook directly in the
browser.


5.2 STEP-BY-STEP INSTRUCTIONS TO OPEN AND NAVIGATE THE DASHBOARD

Opening instructions:
  1. Extract the submission archive to a folder of your choice.
  2. Open a terminal (Command Prompt, PowerShell, or a Unix shell) and
     navigate into the extracted project folder — the folder that
     contains the file package.json.
  3. Install dependencies by running:
         npm install
  4. Start the local development server by running:
         npm run dev
  5. Open a web browser and go to:
         http://localhost:3000
  6. The dashboard will load automatically. On first load it reads the
     bundled workbook (data_new.xlsx, included in the submission's
     public folder) and runs the full analysis engine before rendering
     the charts; this normally takes well under a second.

Navigation instructions:
  The dashboard is organised into two primary views, selected using the
  pill-shaped buttons in the top navigation bar:

    - "Macro Anchor · Langkawi"  — the island-level policy overview,
      including tourist arrival trends, revenue regressions, the policy
      catalyst analysis, and the Pareto-optimal quota recommendations.

    - "Micro Stress-Test · Tioman" — the ecological stress-test view
      centred on the Disturbance Management Simulator.

  Within the Langkawi view, use the dropdown in the "Tourist arrivals
  trend" card to switch between the Yearly Overview and a specific
  year's Monthly breakdown.

  Within the Tioman view, use the Disturbance Management Simulator
  slider (or the three preset buttons above it — Optimal, Current, and
  Crisis) to change the assumed disturbance level. Moving the slider
  re-runs the full scenario search live in the browser and immediately
  recalculates the recommended visitor cap, target length of stay, and
  ecological health index shown on screen.

  A light/dark theme toggle is available in the top-right corner of the
  header at all times.


5.3 ADDITIONAL REQUIREMENTS SUCH AS PLUGINS OR ADD-ONS

  - An active internet connection is required only during Step 3
    (npm install) to download the project's dependencies, and during
    the first run of Step 4 to fetch and self-host the interface fonts.
    Once installed, the dashboard itself makes no external network
    calls: all data is read from the workbook bundled inside the
    submission's public folder, and no internet connection is required
    to operate or evaluate the dashboard afterwards.
  - No database, API keys, or commercial plugins are required.
  - A modern evergreen web browser is required (see Section 5.4 for the
    recommended browser and resolution).


5.4 NOTES ON LIMITATIONS, ASSUMPTIONS, OR SPECIAL CONSIDERATIONS

  - The SARIMAX forecasting model and the Ridge-regression / Pareto
    optimisation engine originally developed in Python have been fully
    re-implemented in TypeScript and run natively in the browser at
    runtime. Every regression, forecast, and the underlying scenario
    search are computed live from the bundled workbook on each page
    load, and moving the Disturbance Management Simulator slider
    triggers a genuine live re-run of the scenario search rather than
    displaying a pre-recorded result. This removes any dependency on a
    local Python environment for evaluation, while preserving full
    interactivity for the judges.
  - This dashboard is presented as a Proof of Concept. The SARIMAX
    forecasting and Pareto optimisation rely on limited historical
    panel data (n = 6 for Langkawi) and should be interpreted as
    structural signals rather than production-ready governance caps.
  - The dashboard is optimised for Google Chrome at a 1920x1080 display
    resolution. The layout is responsive down to tablet widths, but
    evaluation on a standard desktop monitor is recommended for the
    clearest view of all charts.
  - All figures shown are computed directly from the bundled workbook
    at runtime; no results are hard-coded.

