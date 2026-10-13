import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
function edit(relativePath, transform) {
  const filename = path.join(root, relativePath);
  if (!fs.existsSync(filename)) return;
  const before = fs.readFileSync(filename, 'utf8');
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(filename, after, 'utf8');
    console.log(relativePath);
  }
}

edit('src/components/LivingYggdrasil.jsx', text => {
  const start = text.indexOf('export const SECTORS = {');
  const end = text.indexOf('export const ALL_NODES', start);
  if (start < 0 || end < 0) throw new Error('Sector data boundaries missing');
  text = text.slice(0, start) + "export { SECTORS } from '../data/sectorFeatures';\n\n" + text.slice(end);
  text = text.replace("import KnowledgeBase3D from './KnowledgeBase3D';", "import KnowledgeBase3D from './KnowledgeBase3D';\nimport { SECTORS } from '../data/sectorFeatures';");
  text = text.replaceAll('AGENTIC STEWARDSHIP', 'Agenexus')
    .replaceAll('Living Systems Operational Intelligence Mesh', 'Facility intelligence & sustainability')
    .replaceAll('Autonomous Jobs', 'Features & Solutions')
    .replaceAll('Central Intelligence & Autonomous Memory', 'Connected Data & Operational Context')
    .replaceAll('Search jobs, tools & capabilities (/)', 'Search features, data & solutions (/)')
    .replaceAll('No matching jobs found in network', 'No matching features found')
    .replaceAll('Search network...', 'Search features...')
    .replaceAll('Search sectors, jobs, SCADA tools, or capabilities...', 'Search sectors, features, data or solutions...')
    .replaceAll('Search jobs, tools,', 'Search features, data,')
    .replaceAll('{selectedNode.autonomy}', '{selectedNode.statusLabel}')
    .replaceAll('selectedNode.replaces', 'selectedNode.solution')
    .replaceAll('What this replaces:', 'Solution we provide:')
    .replaceAll('Connected Integration Protocols', 'Data used by this feature')
    .replaceAll('Sub-Features & Capabilities', 'Specific features')
    .replaceAll('THE FOUR SECTOR ROOT HUBS (CAMPUS, CIVIC, HOSPITAL, INTELLIGENCE)', 'THE FOUR SECTOR ROOT HUBS (COLLEGE, MUNICIPALITY, HOSPITAL, INTELLIGENCE)');
  text = text.replace(/\s*\{\/\* Live Telemetry & Baselines \*\/\}[\s\S]*?(?=\s*\{\/\* Interactive Specific features)/, '\n');
  text = text.replace('title={`Click to activate ${s.name} sector`}', 'role="button"\n                  tabIndex={0}\n                  aria-label={`Explore ${s.name} features`}\n                  onKeyDown={event => { if (event.key === \'Enter\' || event.key === \' \') { event.preventDefault(); event.currentTarget.click(); } }}\n                  title={`Explore ${s.name} features`}');
  text = text.replace('onMouseEnter={() => setHoveredNode(node)}', 'role="button"\n                    tabIndex={0}\n                    aria-label={`Explore ${node.name}`}\n                    title={`${node.name}: ${node.summary}`}\n                    onKeyDown={event => { if (event.key === \'Enter\' || event.key === \' \') { event.preventDefault(); event.currentTarget.click(); } }}\n                    onMouseEnter={() => setHoveredNode(node)}');
  text = text.replace(/<span className="text-\[11px\] font-semibold text-\[#F4F4F5\] whitespace-nowrap pr-1">\s*\{node.name\}\s*<\/span>/,
    '<span className="flex flex-col pr-1 whitespace-nowrap">\n                        <span className="text-[11px] font-semibold text-[#F4F4F5]">{node.name}</span>\n                        <span className="text-[9px] text-[#A5B1A5] mt-0.5">{node.summary}</span>\n                      </span>');
  text = text.replace('<aside className="w-full sm:w-[380px]', '<aside aria-label="Feature details" className="absolute inset-x-0 bottom-0 max-h-[65%] sm:static sm:max-h-none w-full sm:w-[380px]');
  return text;
});

edit('src/pages/WelcomeJourney.jsx', text => {
  text = text.replace(/const worlds = \[[\s\S]*?\n\];/, `const worlds = Object.values(DOMAINS).map(sector => ({
  id: sector.id,
  name: sector.name,
  descriptor: sector.subtitle,
  detail: sector.subtitle,
  icon: sector.icon,
  color: sector.color,
}));`);
  text = text.replace(/const worldDetails = \{[\s\S]*?\n\};/, `const worldDetails = {
  campus: {
    eyebrow: 'College operations',
    title: 'Make campus resources work better.',
    text: 'Connect classroom, lab and hostel utilisation with energy, water, waste, parking and campus risk. Identify capacity gaps, resource losses and work that needs attention.',
    signals: ['Classroom, lab & hostel use', 'Energy, water & waste', 'Parking, safety & climate'],
  },
  enterprise: {
    eyebrow: 'Municipal services',
    title: 'Keep public services moving.',
    text: 'Bring waste routes, collection schedules, civic water infrastructure, public traffic and asset condition into one service-area view. Plan maintenance and climate readiness with evidence.',
    signals: ['Waste routes & pickups', 'Water & civic assets', 'Traffic & flood readiness'],
  },
  hospital: {
    eyebrow: 'Hospital operations',
    title: 'Understand the facilities behind care.',
    text: 'Connect bed, ICU and operating-theatre utilisation with diagnostic equipment, critical power, water, air and biomedical waste. Highlight capacity pressure and facilities requiring attention.',
    signals: ['Bed, ICU & theatre use', 'Critical power & water', 'Equipment & biomedical waste'],
  },
  intelligence: {
    eyebrow: 'Shared facility intelligence',
    title: 'Turn connected data into useful action.',
    text: 'Normalise source data, replay historical readings, forecast demand and flag anomalies. Connect evidence to reviewed decisions, assigned work and explainable sustainability indicators.',
    signals: ['Historical data replay', 'Forecasts & alert evidence', 'Tracked actions & scores'],
  },
};`);
  text = text.replace(/      const code = nodeOrSector.code \|\| '';[\s\S]*?      else setCurrentPage\('overview'\);/, "      setCurrentPage(nodeOrSector.dashboardPage || 'overview');");
  text = text.replace(/  const worldName = selectedWorld === 'enterprise'[\s\S]*?    : 'Campus A';/, '  const worldName = activeWorld.name;');
  text = text.replaceAll('Yggdrasil Stewardship Systems', 'Agenexus')
    .replaceAll('Hello Yggdrasil Team', 'Hello Agenexus Team')
    .replaceAll('Agentic Stewardship Systems', 'Agenexus')
    .replaceAll('Yggdrasil Living Systems · Autonomous Operational Intelligence', 'Facility intelligence & sustainability')
    .replaceAll('AGENTIC CORE', 'Agenexus')
    .replaceAll('Stewardship systems', 'Facility intelligence')
    .replaceAll('Agentic Orchestration Engine with multi-domain sensor mesh', 'Agenexus sector features and solutions')
    .replaceAll('Enter the agentic system', 'Enter Agenexus')
    .replaceAll('02 / Why an Agentic System', '02 / Why Agenexus')
    .replaceAll('Our agentic system brings', 'Agenexus brings')
    .replaceAll('Distributed agent clusters · live signal paths', 'Connected domains · shared location context')
    .replaceAll('Autonomous memory', 'Shared operational context')
    .replaceAll('Cross-sector telemetry', 'Cross-sector data')
    .replaceAll('Real-time stewardship', 'Historical data replay')
    .replaceAll('Select a sector node from the Mind Tree to inspect its live autonomous jobs and capabilities.', 'Select a sector to explore its specific features and the solutions Agenexus provides.')
    .replaceAll('Live Autonomous Features · {activeSectorNodes.length} Active Agents', 'Features & Solutions · {activeSectorNodes.length} Features')
    .replaceAll('Sign in to your stewardship workspace while autonomous features stream live.', 'Sign in to your Agenexus workspace to explore these features and solutions.')
    .replaceAll('Streaming {worldName} Capabilities', '{worldName} Features & Solutions')
    .replaceAll('Active Mind-Tree Sector', 'Agenexus Sector');
  text = text.replace(/const description = world.id === 'enterprise'[\s\S]*?                  : world.detail;/, 'const description = world.detail;');
  text = text.replace('from campuses to cities to care environments.', 'for colleges, hospitals and municipalities.');
  text = text.replace('activeWorld={selectedWorld}\n            heroBelowHeader=', 'activeWorld={selectedWorld}\n            onSelectSectorNode={onSelectWorld}\n            heroBelowHeader=');
  return text;
});

edit('src/context/DashboardContext.jsx', text => text
  .replace(/'Hospital Network' : (?:selectedWorld === 'intelligence' \? 'Intelligence' : )?'Campus A'/, "'Hospital' : selectedWorld === 'intelligence' ? 'Intelligence' : 'College'")
  .replace('document.title = `${organizationName} · Stewardship Systems`;', 'document.title = `Agenexus · ${organizationName}`;'));
edit('src/components/Sidebar.jsx', text => text
  .replace('{organizationName} <span', 'Agenexus <span')
  .replace('Operations & Sustainability</div>', '{organizationName} · Operations</div>'));
edit('src/components/Header.jsx', text => text.replace(/\{organizationName\}(\s*<\/span>)/, 'Agenexus$1'));
edit('src/components/Footer.jsx', text => text.replace('<span>{organizationName}', '<span>Agenexus · {organizationName}'));
edit('src/pages/LoginPage.jsx', text => text.replaceAll('Campus A · Sustainability OS v2.0', 'Agenexus · Facility intelligence').replace('Campus A <span', 'Agenexus <span'));
edit('index.html', text => text.replace(/<title>.*?<\/title>/, '<title>Agenexus · Facility Intelligence</title>')
  .replace('href="/yggdrasil.svg"', 'href="/agenexus.svg"')
  .replace('<meta name="viewport" content="width=device-width, initial-scale=1.0" />', '<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <meta name="description" content="Agenexus connects college, hospital and municipal operations with facility data, forecasts, alerts and sustainability insights." />'));
edit('package.json', text => text.replace('"name": "sustainability-dashboard"', '"name": "agenexus"'));
edit('package-lock.json', text => text.replaceAll('"name": "sustainability-dashboard"', '"name": "agenexus"'));
edit('app/main.py', text => text.replace('title="Sustainability Dashboard API"', 'title="Agenexus API"'));
edit('README.md', text => text.replace(/^# Yggdrasil Stewardship Systems/m, '# Agenexus')
  .replace('Enter the animated Yggdrasil welcome scene.', 'Enter the Agenexus welcome scene.')
  .replace('Choose Campus A, Company / Municipality, or Hospital Network.', 'Choose College, Hospital, Municipality, or Intelligence.')
  .replace(/The landing page places an animated, wide-canopied Yggdrasil[^\n]*/, 'The landing page presents an animated knowledge tree with College, Hospital, Municipality and Intelligence hubs. Each hub contains six specific features with a short outcome on the graph and a detailed solution, data inputs and supporting capabilities on click. College and Intelligence use the dataset prototype; Hospital and Municipality are sector previews. Feature links open the relevant dashboard.')
  .replace('builds and animates the Three.js world tree.', 'renders the interactive sector and feature tree.'));
