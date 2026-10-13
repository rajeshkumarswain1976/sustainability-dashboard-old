import { Building2, HeartPulse, Sparkles, Trees } from 'lucide-react';

// Stable sector and node IDs preserve saved selections; labels describe product features.
const feature = (id, code, name, summary, dashboardPage, description, solution, tools, subskills) => ({
  id, code, name, summary, dashboardPage, description, solution, tools,
  subskills: subskills.map(([name, detail]) => ({ name, detail })),
});

const collegeFeatures = [
  feature('ag-cmp-00', 'COL-01', 'Classroom, Lab & Hostel Use', 'Find capacity and occupancy gaps', 'overview',
    'Compare classroom, laboratory and hostel occupancy with their available capacity, alongside campus resource demand.',
    'Help administrators identify crowded spaces and underused facilities when planning campus operations.',
    ['Campus operations', 'Building and floor registry', 'Occupancy records'], [
      ['Classroom utilisation', 'Compare occupied classroom capacity across teaching buildings.'],
      ['Laboratory utilisation', 'Review laboratory occupancy and capacity by department.'],
      ['Hostel utilisation', 'Compare residential occupancy with hostel capacity and resource use.'],
    ]),
  feature('ag-cmp-01', 'COL-02', 'Campus Energy & Solar', 'Spot peaks and avoidable demand', 'energy',
    'Track building and floor energy use, HVAC demand, solar generation and grid imports with demand forecasts.',
    'Identify unusual consumption and peak demand so facilities teams can prioritise energy-saving work.',
    ['Energy readings', 'Solar generation', 'Occupancy and weather context'], [
      ['Building demand forecasts', 'Review expected consumption and demand peaks for campus buildings.'],
      ['HVAC and occupancy context', 'Compare equipment demand with occupied and empty spaces.'],
      ['Solar and grid balance', 'See how solar generation contributes to campus electricity needs.'],
    ]),
  feature('ag-cmp-02', 'COL-03', 'Campus Water & Leak Alerts', 'Protect supply and reduce losses', 'water',
    'Combine meter flow, consumption, line pressure, tank levels and water availability across campus buildings.',
    'Locate suspected leaks and low reserves early, with evidence for inspection and repair.',
    ['Water meters', 'Tank levels', 'Water resources'], [
      ['Leak detection', 'Flag unusual flow or pressure patterns and identify the affected building.'],
      ['Tank and pump monitoring', 'Review storage levels and pump status before supply becomes constrained.'],
      ['Water stress outlook', 'Estimate available supply and highlight areas needing conservation.'],
    ]),
  feature('ag-cmp-03', 'COL-04', 'Campus Waste & Recycling', 'Prevent overflow and improve diversion', 'waste',
    'Track campus bin fill, waste weight, collection delays and diversion across academic and residential areas.',
    'Prioritise collections before bins overflow and show where segregation and recycling need attention.',
    ['Bin readings', 'Collection records', 'Waste categories'], [
      ['Overflow forecasts', 'Highlight bins likely to fill before their next collection.'],
      ['Pickup delay tracking', 'Identify missed or delayed collections by location.'],
      ['Diversion performance', 'Compare recycling and diversion trends across campus areas.'],
    ]),
  feature('ag-cmp-04', 'COL-05', 'Campus Parking & Mobility', 'Reduce gate queues and parking pressure', 'mobility',
    'Compare campus parking capacity and occupancy with gate vehicle counts, traffic density and delays.',
    'Help campus teams plan access and parking around busy teaching and residential periods.',
    ['Campus parking', 'Gate vehicle counts', 'Traffic and delay records'], [
      ['Parking utilisation', 'Highlight capacity pressure and available parking by zone.'],
      ['Gate congestion', 'Review vehicle counts and delays at campus entrances.'],
      ['Mobility demand trends', 'Compare busy periods to support access and transport planning.'],
    ]),
  feature('ag-cmp-05', 'COL-06', 'Campus Safety & Climate', 'Prioritise exposed places and equipment', 'climate',
    'Connect heat and flood risk, air quality, safety incidents and equipment condition with campus locations.',
    'Focus inspections and response work on vulnerable buildings, outdoor areas and critical assets.',
    ['Climate and air data', 'Safety incidents', 'Asset maintenance records'], [
      ['Heat and rain readiness', 'Review exposed zones, drainage context and backup-resource readiness.'],
      ['Air and wellbeing indicators', 'Track pollutant levels and environmental conditions around campus.'],
      ['Safety and asset follow-up', 'Use incident and maintenance evidence to prioritise inspections.'],
    ]),
];

const municipalFeatures = [
  feature('ag-civ-01', 'MUN-01', 'Flood & Heat Readiness', 'Prioritise vulnerable service areas', 'climate',
    'Bring rainfall, heat, drainage capacity, low-lying areas and critical infrastructure into a civic risk view.',
    'Help municipal teams prepare inspections and response priorities for exposed neighbourhoods and facilities.',
    ['Weather context', 'Climate vulnerability', 'Service-area registry'], [
      ['Flood exposure', 'Combine rainfall with drainage capacity and low-lying locations.'],
      ['Heat exposure', 'Identify outdoor activity and infrastructure vulnerable to high temperatures.'],
      ['Readiness assessment', 'Review backup water, power and critical-asset context before disruption.'],
    ]),
  feature('ag-civ-02', 'MUN-02', 'Civic Water Infrastructure', 'Locate losses and supply pressure', 'water',
    'Organise water consumption, flow, pressure, storage and infrastructure condition by municipal service area.',
    'Support leak inspections, supply planning and maintenance of shared civic water assets.',
    ['Water infrastructure', 'Meter and tank records', 'Service areas'], [
      ['Network loss indicators', 'Flag unusual flow or pressure that warrants a leak inspection.'],
      ['Supply availability', 'Review reserves and water stress for each service area.'],
      ['Infrastructure follow-up', 'Link affected water assets with maintenance and inspection work.'],
    ]),
  feature('ag-civ-03', 'MUN-03', 'Waste Routes & Collections', 'Identify missed pickups and overflow', 'waste',
    'Connect waste routes, collection vehicles, schedules and route distances with bin and collection records.',
    'Help sanitation teams prioritise overdue collections and review service coverage.',
    ['Municipal waste routes', 'Collection schedules', 'Bin and vehicle records'], [
      ['Route coverage', 'Review collection routes, vehicles and the service areas they cover.'],
      ['Missed collection alerts', 'Compare collection records with scheduled pickups.'],
      ['Overflow priorities', 'Use fill levels and collection delays to identify urgent pickups.'],
    ]),
  feature('ag-civ-04', 'MUN-04', 'Civic Asset Maintenance', 'Keep public infrastructure serviceable', 'assets',
    'Track civic asset status, availability, downtime and maintenance needs across municipal facilities.',
    'Give field teams a location-based list of equipment and infrastructure requiring attention.',
    ['Civic asset registry', 'Equipment performance', 'Maintenance records'], [
      ['Asset condition', 'Review equipment status and performance by service area.'],
      ['Maintenance priorities', 'Identify overdue maintenance and recurring downtime.'],
      ['Service continuity', 'Highlight critical assets whose failure could interrupt public services.'],
    ]),
  feature('ag-civ-05', 'MUN-05', 'Public Traffic & Parking', 'Understand congestion and capacity', 'mobility',
    'Combine public traffic, vehicle counts, parking occupancy and delays across civic locations.',
    'Support traffic and parking planning with a shared view of congested and underused areas.',
    ['Public traffic records', 'Parking capacity', 'Service-area locations'], [
      ['Traffic pressure', 'Compare vehicle volumes and delays across public access points.'],
      ['Parking availability', 'Review occupied spaces against capacity at civic facilities.'],
      ['Service-area trends', 'Compare mobility demand across locations and reporting periods.'],
    ]),
  feature('ag-civ-06', 'MUN-06', 'Civic Emissions & Resources', 'Trace the footprint of public services', 'sustainability',
    'Derive emissions from electricity, mobility and waste activity, alongside municipal resource-performance scores.',
    'Help municipalities identify resource hotspots and explain the data behind sustainability indicators.',
    ['Energy, mobility and waste', 'Versioned emission factors', 'Sustainability indicators'], [
      ['Activity-based emissions', 'Calculate CO2e from operational activity and documented factors.'],
      ['Resource performance', 'Compare energy, water and waste indicators across civic facilities.'],
      ['Score traceability', 'Follow sustainability factors back to KPIs and underlying records.'],
    ]),
];

const hospitalFeatures = [
  feature('ag-hsp-00', 'HOS-01', 'Bed, ICU & Theatre Capacity', 'Reveal pressure on care facilities', 'overview',
    'Bring bed occupancy, ICU capacity, operating-theatre use, patient throughput and waiting time into one facility view.',
    'Help hospital operations teams identify capacity pressure and underused care facilities.',
    ['Hospital operations', 'Department registry', 'Capacity and occupancy records'], [
      ['Bed and ICU utilisation', 'Compare occupied beds with available general and ICU capacity.'],
      ['Operating-theatre utilisation', 'Review theatre usage against available capacity.'],
      ['Throughput and waiting time', 'Track patient flow and waiting-time indicators by department.'],
    ]),
  feature('ag-hsp-01', 'HOS-02', 'Critical Power Readiness', 'Plan continuity for essential care', 'energy',
    'Track hospital energy demand, backup-power availability and critical-asset exposure to power disruption.',
    'Support power-readiness reviews and maintenance priorities for essential hospital services.',
    ['Energy records', 'Backup-power context', 'Critical asset registry'], [
      ['Critical-load demand', 'Review energy demand in departments with essential equipment.'],
      ['Backup readiness', 'Assess backup-power context and maintenance needs.'],
      ['Disruption exposure', 'Identify care facilities and assets most exposed to power loss.'],
    ]),
  feature('ag-hsp-02', 'HOS-03', 'Hospital Water Continuity', 'Identify leaks and reserve shortfalls', 'water',
    'Track hospital water use, tank reserves, supply availability and leak indicators by building or department.',
    'Help facilities teams protect water availability and prioritise suspected supply losses.',
    ['Water meters and tanks', 'Department locations', 'Backup-water context'], [
      ['Department water use', 'Compare consumption patterns across care and support areas.'],
      ['Leak inspection alerts', 'Flag unusual meter flow or pressure for investigation.'],
      ['Reserve readiness', 'Review storage and backup-water context for service continuity.'],
    ]),
  feature('ag-hsp-03', 'HOS-04', 'Care Environment & Air', 'Highlight environmental conditions', 'air',
    'Review air pollutants, CO2, temperature, humidity and weather context around hospital facilities.',
    'Help facilities teams identify environmental changes that need inspection in occupied care spaces.',
    ['Air-quality records', 'Weather context', 'Hospital location registry'], [
      ['Air-quality indicators', 'Review pollutant levels, AQI categories and dominant pollutants.'],
      ['Comfort conditions', 'Track temperature and humidity alongside facility occupancy.'],
      ['Environmental follow-up', 'Locate abnormal conditions and prioritise facilities inspections.'],
    ]),
  feature('ag-hsp-04', 'HOS-05', 'Biomedical Waste Tracking', 'Follow segregation and collection', 'waste',
    'Use hospital-specific waste categories with bin fill, waste weight and collection records.',
    'Support segregation checks and timely collection of waste from care and diagnostic departments.',
    ['Sector-specific waste categories', 'Bin readings', 'Collection records'], [
      ['Waste category tracking', 'Separate hospital waste streams using the configured sector categories.'],
      ['Collection timeliness', 'Highlight delayed pickups and bins nearing capacity.'],
      ['Department waste trends', 'Compare waste generation across care and support departments.'],
    ]),
  feature('ag-hsp-05', 'HOS-06', 'Diagnostic Equipment Uptime', 'Prioritise equipment availability', 'assets',
    'Combine diagnostic-equipment usage with availability, downtime and maintenance status.',
    'Help biomedical and facilities teams identify equipment whose condition or downtime affects capacity.',
    ['Diagnostic equipment usage', 'Asset registry', 'Maintenance and downtime records'], [
      ['Equipment utilisation', 'Compare diagnostic equipment usage across departments.'],
      ['Downtime and availability', 'Identify unavailable equipment and recurring service interruptions.'],
      ['Maintenance follow-up', 'Prioritise inspections for critical or overdue equipment.'],
    ]),
];

const intelligenceFeatures = [
  feature('ag-int-00', 'INT-01', 'Unified Facility Data', 'Connect sources without losing context', 'insights',
    'Normalise heterogeneous source records around facility, zone, building, asset and timestamp identifiers.',
    'Give domain analytics a common location and time backbone while preserving sector-specific fields.',
    ['Source adapters', 'Location hierarchy', 'Sector configuration'], [
      ['Source normalisation', 'Map source columns, units and identifiers to the common data structure.'],
      ['Sector extensions', 'Retain college, hospital and municipal fields in their own domain tables.'],
      ['Data provenance', 'Keep source context and distinguish measured, synthetic and replayed records.'],
    ]),
  feature('ag-int-01', 'INT-02', 'Historical Data Replay', 'Turn dataset records into a stream', 'overview',
    'Replay historical facility readings progressively so dashboards, alerts and workflows react to incoming records.',
    'Demonstrate ongoing facility monitoring from datasets without manually entering each reading.',
    ['Historical facility data', 'Replay state', 'Event stream'], [
      ['Replay controls', 'Start, pause and inspect the progression of the dataset stream.'],
      ['Incoming-record updates', 'Update operational views as replayed readings become available.'],
      ['Source-aware timestamps', 'Keep dataset cutoff times and current weather context distinguishable.'],
    ]),
  feature('ag-int-02', 'INT-03', 'Forecasts & Anomaly Detection', 'See emerging demand and risk', 'insights',
    'Combine domain forecasts, unusual readings and location context to highlight emerging operational problems.',
    'Help teams investigate likely demand peaks, resource shortages and abnormal equipment behaviour.',
    ['Domain readings', 'Historical trends', 'Weather context'], [
      ['Domain forecasts', 'Review expected changes in energy, water, waste and other operational indicators.'],
      ['Anomaly evidence', 'Compare unusual readings with relevant history and thresholds.'],
      ['Location hotspots', 'Identify the zones and assets contributing to a problem.'],
    ]),
  feature('ag-int-03', 'INT-04', 'Alerts & Decision Review', 'Prioritise issues with supporting facts', 'alerts',
    'Combine domain signals, severity, sector rules and decision context in a shared alert and review queue.',
    'Help reviewers understand why an issue needs attention and where uncertain decisions require review.',
    ['Domain analytics', 'Sector thresholds', 'Decision records'], [
      ['Cross-domain context', 'Bring relevant resource, risk and occupancy signals together.'],
      ['Severity and evidence', 'Show the facts and location associated with each alert.'],
      ['Review routing', 'Keep uncertain recommendations visible for an authorised reviewer.'],
    ]),
  feature('ag-int-04', 'INT-05', 'Assigned Action Workflows', 'Turn verified issues into tracked work', 'actions',
    'Connect alerts with assigned actions, work orders, progress and resolution history.',
    'Give teams clear ownership and a way to track a facilities issue through completion.',
    ['Alerts', 'Action records', 'User roles and assigned locations'], [
      ['Ownership and assignment', 'Route work to the responsible team or authorised role.'],
      ['Progress tracking', 'Follow actions through their recorded status changes.'],
      ['Resolution history', 'Keep the original issue and follow-up work connected.'],
    ]),
  feature('ag-int-05', 'INT-06', 'Explainable Sustainability', 'Trace scores back to operational data', 'sustainability',
    'Derive emissions and sustainability scores from domain activity, KPIs and documented reference factors.',
    'Make performance indicators understandable by showing their contributing factors and source records.',
    ['Energy, mobility and waste', 'Emission factors', 'Domain factor scores'], [
      ['Derived emissions', 'Calculate energy, mobility and waste CO2e from activity data.'],
      ['Factor contributions', 'Review the domain factors contributing to overall sustainability.'],
      ['KPI-to-data traceability', 'Follow an indicator back to the operational records behind it.'],
    ]),
];

const sector = (metadata, features, positions, statusLabel) => ({
  ...metadata,
  badgeCount: features.length,
  nodes: features.map((item, index) => ({
    ...item, parentId: metadata.id, sectorId: metadata.id,
    x: positions[index][0], y: positions[index][1],
    status: statusLabel === 'Sector preview' ? 'in_dev' : 'deployed', statusLabel,
  })),
});

export const SECTORS = {
  campus: sector({
    id: 'campus', name: 'College', subtitle: 'Campus capacity, resources, mobility and wellbeing',
    color: '#69B88A', accentBg: '#1B2C21', borderColor: '#4E9369', glow: 'rgba(105, 184, 138, 0.35)',
    icon: Trees, hubX: -400, hubY: -210,
  }, collegeFeatures, [[-660, -330], [-510, -430], [-210, -380], [-690, -205], [-630, -80], [-240, -55]], 'Dataset prototype'),
  enterprise: sector({
    id: 'enterprise', name: 'Municipality', subtitle: 'Public services, infrastructure and civic resilience',
    color: '#D7A34B', accentBg: '#2C2314', borderColor: '#9E722C', glow: 'rgba(215, 163, 75, 0.35)',
    icon: Building2, hubX: 400, hubY: -210,
  }, municipalFeatures, [[210, -380], [510, -430], [660, -330], [690, -205], [630, -80], [240, -55]], 'Sector preview'),
  hospital: sector({
    id: 'hospital', name: 'Hospital', subtitle: 'Care capacity, critical resources and equipment readiness',
    color: '#54B8C1', accentBg: '#16282B', borderColor: '#39848C', glow: 'rgba(84, 184, 193, 0.35)',
    icon: HeartPulse, hubX: 400, hubY: 210,
  }, hospitalFeatures, [[240, 55], [630, 80], [690, 205], [660, 330], [510, 430], [210, 380]], 'Sector preview'),
  intelligence: sector({
    id: 'intelligence', name: 'Intelligence', subtitle: 'Connected data, forecasts, decisions and action workflows',
    color: '#A58AD6', accentBg: '#221C2C', borderColor: '#7555A6', glow: 'rgba(165, 138, 214, 0.35)',
    icon: Sparkles, hubX: -400, hubY: 210,
  }, intelligenceFeatures, [[-240, 55], [-630, 80], [-690, 205], [-660, 330], [-510, 430], [-210, 380]], 'Dataset prototype'),
};
