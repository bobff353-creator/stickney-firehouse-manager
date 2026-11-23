export const competitors = [
  {
    name: "First Due",
    category: "Integrated fire RMS",
    url: "https://www.firstdue.com/products/preincidentplanning",
    strength:
      "Detailed mapping, occupancy data, contacts, hazardous materials, attachments and selectable levels. GIS and aerial integrations support rich plans.",
    offline:
      "Its official mobile release notes describe offline preplan levels. Validate the actual package and device configuration.",
    lesson: "Keep rich detail, but reveal it only when the task needs it.",
  },
  {
    name: "FlowMSP · ImageTrend",
    category: "Focused preplanning",
    url: "https://flowmsp.com/",
    strength:
      "Photo-led preplans, annotations, dispatch access, existing-property imports and mutual-aid sharing. Its home page now identifies it as an ImageTrend product.",
    offline:
      "Do not infer full offline coverage from mobile support; ask which data and attachments remain available.",
    lesson:
      "Make photos and time-to-first-use central. A vendor demo of a five-minute plan is not a measured comparison.",
  },
  {
    name: "APX Data · SmartCapture / SmartView",
    category: "Capture and response",
    url: "https://apxdata.com/smartcapture/",
    strength:
      "Separates mobile capture from response viewing, with image annotation, pick lists, customizable forms and sharing.",
    offline:
      "Vendor documents offline field collection and cloud synchronization when connectivity returns.",
    lesson:
      "Use two purpose-built views of the same information: collect deliberately, read immediately.",
  },
  {
    name: "StreetWise CADlink",
    category: "Response and preplanning",
    url: "https://www.streetwisecadlink.com/total-preplan-management",
    strength:
      "Field surveys with embedded photos, tabbed occupancy information, proximity ordering during response and cloud distribution.",
    offline:
      "Vendor explicitly documents selectively caching preplans on the device.",
    lesson:
      "Put the relevant plan close to the response task, with deliberate downloads and clear age labels.",
  },
  {
    name: "ESO Properties & Inspections",
    category: "Integrated fire RMS",
    url: "https://www.eso.com/fire/properties-and-inspections-software/",
    strength:
      "Property / building / occupant hierarchy, chemical and tank records, CAMEO information and configurable inspection checklists.",
    offline:
      "The reviewed product page did not establish complete offline preplan coverage.",
    lesson:
      "Support complex occupancies without asking a new firefighter to learn the database hierarchy.",
  },
  {
    name: "FIREHOUSE by ESO · Mobile Inspections",
    category: "Legacy product family",
    url: "https://www.firehousesoftware.com/products/inspections/",
    strength:
      "Field collection of premises, contacts and preplans, custom checklists, drawings, attachments and interactive synchronization.",
    offline:
      "The page describes synchronization; current product availability and exact offline behavior require vendor confirmation.",
    lesson:
      "Existing department drawings and records are migration assets. Do not count this as an independent vendor from ESO.",
  },
  {
    name: "ImageTrend Elite / Visual Pre Plans",
    category: "Integrated fire RMS",
    url: "https://www.imagetrend.com/plans/",
    strength:
      "Locations, occupants, inspections, hydrants and visual preplans appear within the Fire platform packages.",
    offline:
      "Official plan information lists offline fire inspections. That is not proof that every visual-preplan feature works offline.",
    lesson:
      "Link maintenance and response information, and state exactly which module is offline. FlowMSP and ImageTrend share a vendor family.",
  },
  {
    name: "Tablet Command",
    category: "Incident command / access",
    url: "https://www.tabletcommand.com/pre-plan",
    strength:
      "Fast access to preplans and GIS features through Esri, local files or integrations with First Due and Intterra.",
    offline:
      "Documents offline Esri maps / mobile map packages; direct public-cloud links require internet.",
    lesson:
      "A strong response viewer can consume another system’s plans. It is not the same job as easy field collection.",
  },
  {
    name: "Esri ArcGIS Pre-Incident Planning",
    category: "GIS solution",
    url: "https://doc.arcgis.com/en/arcgis-solutions/11.5/reference/introduction-to-pre-incident-planning.htm",
    strength:
      "A manager, Field Maps site-visit map, dashboard and viewer cover assignments, collection and program visibility.",
    offline:
      "Depends on the chosen ArcGIS deployment, data and Field Maps configuration. Test a fully downloaded area.",
    lesson:
      "Separate program management, collection and response roles while keeping one consistent record.",
  },
  {
    name: "Intterra",
    category: "Operational GIS",
    url: "https://support.intterragroup.com/knowledge",
    strength:
      "Official help covers operational maps, preplan workflows, disconnected field tools, ArcGIS sharing and administration.",
    offline:
      "Knowledge base explicitly provides a field-tool section for disconnected environments; per-feature behavior needs a demo.",
    lesson:
      "GIS interoperability and a disconnected field workflow deserve explicit acceptance tests.",
  },
  {
    name: "EPR Fireworks",
    category: "Integrated fire RMS",
    url: "https://eprfireworks.com/",
    strength:
      "Connects properties, hydrants, preplans and response with broader RMS tools. Its admin documentation covers assignments, review quality checks and review intervals.",
    offline:
      "Mobile product page advertises offline inspection documentation; verify preplan coverage separately.",
    lesson:
      "Review, correction and future reinspection are part of the product, not an extra spreadsheet.",
  },
  {
    name: "FireMapper",
    category: "Adjacent tactical mapping",
    url: "https://docs.firemapper.app/portal/index.html",
    strength:
      "Shared operational mapping, observations, photos, PDFs, geospatial exports, forms and integration tools. More a mapping benchmark than a like-for-like structural preplan RMS.",
    offline:
      "Enterprise documentation describes cached and bulk-downloaded base layers.",
    lesson:
      "Use labeled features and portable data; do not confuse cached basemaps with complete offline records.",
  },
  {
    name: "FireQ · Breton SmarTek",
    category: "Response and safety plans",
    url: "https://bretonsmartek.com/incident-management/",
    strength:
      "Safety plans and supplementary blueprints appear on the incident map; inspection reports have separate administrator-controlled permissions.",
    offline:
      "The reviewed page does not establish offline safety-plan availability.",
    lesson:
      "Protect inspection material and response information with deliberate access rules.",
  },
  {
    name: "Unified Solutions · Fire",
    category: "Emerging preplan product",
    url: "https://unified-solutions.io/fire-pre-plans",
    strength:
      "Describes aerial capture, hydrant layers, photo reuse, annotations and a review process ending in a frozen approved version.",
    offline:
      "No complete offline guarantee was established from the reviewed page.",
    lesson:
      "An approved snapshot must remain stable while the next revision is being edited.",
  },
];
export const sourceNotes = [
  {
    title: "Current preincident-planning standard family",
    url: "https://www.nfpa.org/codes-and-standards/nfpa-1660-standard-development/1660?l=31",
    text: "NFPA identifies NFPA 1660 (2024) as consolidating 1600, 1616 and 1620. Arrival does not claim NFPA certification or complete compliance.",
  },
  {
    title: "First Due mobile release notes",
    url: "https://apps.apple.com/us/app/first-due-mobile/id1300758445",
    text: "Official vendor app listing mentions offline preplan levels. Vendor release notes are evidence of an advertised capability, not an independent field test.",
  },
  {
    title: "ImageTrend inspection data sheet",
    url: "https://www.imagetrend.com/wp-content/uploads/2025/02/ImageTrend_EIiteFireInspections_2025.pdf",
    text: "Distinguishes locations / occupants and an optional offline inspection field product.",
  },
  {
    title: "Fireworks review and frequency configuration",
    url: "https://support.eprfireworks.com/portal/en/kb/articles/department-configuration",
    text: "Documents preplan QC options, map providers and recurring preplan intervals.",
  },
  {
    title: "FireMapper offline base layers",
    url: "https://docs.firemapper.app/enterprise/screens/properties/offline_base_layers/index.html",
    text: "Describes viewed-tile caching and area downloads; this is distinct from preplan package completeness.",
  },
];
