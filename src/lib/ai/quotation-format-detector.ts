/**
 * ICON TECH PRO ERP V9.2 — AI Quotation Format Detection Engine
 * 
 * Analyzes natural language salesperson inquiries, project briefs, and requirement notes
 * to automatically detect the appropriate Quotation Format and BOQ Section Structure.
 * 
 * Features:
 * 1. Intent Detection: Home Theater (5.1, 7.2.1, etc.), Conference Room, CCTV, Networking,
 *    Interactive Display, AV Projector, IT Hardware, and Mixed Custom Projects.
 * 2. Suggestion, NOT Lock: Returns recommendations that the salesperson can accept or change.
 * 3. Format-Product Independence: Any product can be added to any format or section.
 * 4. Extensible Registry: Data-driven template system for scalable commercial formats.
 */

import type { QuotationFormatType, ProjectSection, QuotationItem } from '@/types/erp';

export interface FormatDetectionResult {
  format: QuotationFormatType;
  formatLabel: string;
  configuration?: string;
  confidence: number;
  isMixed: boolean;
  detectedCategories: string[];
  suggestedSections: string[];
  explanation: string;
}

export interface QuotationFormatDefinition {
  type: QuotationFormatType;
  label: string;
  description: string;
  defaultSections: string[];
  iconName?: string;
}

export const QUOTATION_FORMAT_REGISTRY: Record<QuotationFormatType, QuotationFormatDefinition> = {
  STANDARD: {
    type: 'STANDARD',
    label: 'Standard Commercial',
    description: 'Standard single-table itemized quote for general AV/IT products and single orders.',
    defaultSections: ['COMMERCIAL PRODUCTS', 'SERVICES & IMPLEMENTATION'],
  },
  HOME_THEATER: {
    type: 'HOME_THEATER',
    label: 'Home Theater Project',
    description: 'High-end cinema project BOQ based on Srikanth reference structure (5.1, 7.2.1 Atmos, etc.).',
    defaultSections: [
      'HOME THEATER ROOM / CONFIGURATION',
      'AVR / PROTECTION / SCREEN',
      'ALL INTERCONNECTIVITIES',
      'VIDEO PROJECTOR',
      'INSTALLATION / DESIGN / TRANSPORT / COMMISSIONING',
    ],
  },
  CONFERENCE_ROOM: {
    type: 'CONFERENCE_ROOM',
    label: 'Conference Room Solution',
    description: 'Corporate boardroom & hybrid meeting room audio-visual collaboration package.',
    defaultSections: [
      'DISPLAY & INTERACTIVE FLAT PANEL',
      'PTZ CAMERA & AUTO-TRACKING SYSTEM',
      'MICROPHONES & AUDIO DSP SYSTEM',
      'CABLING & INFRASTRUCTURE',
      'INSTALLATION, INTEGRATION & COMMISSIONING',
    ],
  },
  CCTV_SURVEILLANCE: {
    type: 'CCTV_SURVEILLANCE',
    label: 'CCTV & Security Surveillance',
    description: 'Multi-camera IP surveillance system with NVR, storage, switching, and deployment.',
    defaultSections: [
      'HD / IP SURVEILLANCE CAMERAS',
      'NETWORK VIDEO RECORDER & SURVEILLANCE STORAGE',
      'POE SWITCHING & EQUIPMENT RACK',
      'STRUCTURED CABLING & CONDUITING',
      'INSTALLATION, MOUNTING & CONFIGURATION',
    ],
  },
  NETWORKING: {
    type: 'NETWORKING',
    label: 'Enterprise Networking',
    description: 'Structured network infrastructure, managed switches, routers, Wi-Fi, and racks.',
    defaultSections: [
      'CORE & ACCESS NETWORK SWITCHES',
      'ROUTER & WIRELESS ACCESS POINTS',
      'SERVER RACK & PATCH PANELS',
      'STRUCTURED CABLING & FIBER ACCESSORIES',
      'TESTING, LABELING & COMMISSIONING',
    ],
  },
  AV_PROJECTOR: {
    type: 'AV_PROJECTOR',
    label: 'AV & Commercial Projection',
    description: 'High-brightness commercial projector, motorized screen, mounts, and HDMI cabling.',
    defaultSections: [
      'HIGH-LUMENS COMMERCIAL PROJECTOR',
      'MOTORIZED / FIXED PROJECTION SCREEN',
      'CEILING MOUNT KIT & ACCESSORIES',
      '4K HDMI CABLING & TRANSMITTERS',
      'INSTALLATION, ALIGNMENT & TESTING',
    ],
  },
  INTERACTIVE_DISPLAY: {
    type: 'INTERACTIVE_DISPLAY',
    label: 'Interactive Flat Panel Solution',
    description: 'Commercial IFP interactive touch display, OPS Windows PC, and collaboration suite.',
    defaultSections: [
      'INTERACTIVE FLAT PANEL DISPLAY',
      'OPS PC MODULE & EMBEDDED OS',
      'WALL MOUNT / MOBILE HEAVY-DUTY STAND',
      'COLLABORATION ACCESSORIES & STYLUS',
      'INSTALLATION, SETUP & USER DEMO',
    ],
  },
  PRINTER_SOLUTION: {
    type: 'PRINTER_SOLUTION',
    label: 'Commercial Printing & MFP',
    description: 'Multifunction laser printer solution, consumables, and network deployment.',
    defaultSections: [
      'MULTIFUNCTION PRINTING SYSTEM',
      'CONSUMABLES & TONER CARTRIDGES',
      'NETWORK INTEGRATION & DRIVERS',
      'DELIVERY & OPERATOR TRAINING',
    ],
  },
  LAPTOP_DESKTOP: {
    type: 'LAPTOP_DESKTOP',
    label: 'Laptops & IT Hardware',
    description: 'Bulk enterprise laptops, workstations, peripherals, and operating systems.',
    defaultSections: [
      'ENTERPRISE COMPUTING HARDWARE',
      'MONITORS & ACCESSORIES',
      'SOFTWARE LICENSES & OS',
      'DELIVERY & INITIAL SETUP',
    ],
  },
  SERVER_STORAGE: {
    type: 'SERVER_STORAGE',
    label: 'Servers & Centralized Storage',
    description: 'Rackmount servers, NAS/SAN storage, RAID arrays, and server backup solutions.',
    defaultSections: [
      'RACKMOUNT SERVER PLATFORM',
      'STORAGE ARRAYS & ENTERPRISE DRIVES',
      'POWER REDUNDANCY & UPS',
      'DEPLOYMENT & OS CONFIGURATION',
    ],
  },
  ACCESS_CONTROL: {
    type: 'ACCESS_CONTROL',
    label: 'Access Control & Biometrics',
    description: 'Biometric fingerprint/facial access control, EM locks, and attendance software.',
    defaultSections: [
      'BIOMETRIC & RFID TERMINALS',
      'ELECTROMAGNETIC LOCKS & POWER SUPPLIES',
      'CABLING & INTEGRATION HARDWARE',
      'SOFTWARE SETUP & REGISTRATION',
    ],
  },
  AUDIO_SYSTEM: {
    type: 'AUDIO_SYSTEM',
    label: 'Commercial & Pro Audio',
    description: 'Ceiling speakers, amplifiers, zoning mixers, and background music solutions.',
    defaultSections: [
      'LOUDSPEAKERS & CEILING SPEAKERS',
      'COMMERCIAL POWER AMPLIFIERS',
      'AUDIO MIXER & SOURCE PLAYERS',
      'SPEAKER CABLING & HARDWARE',
      'SOUND TUNING & COMMISSIONING',
    ],
  },
  AV_SOLUTION: {
    type: 'AV_SOLUTION',
    label: 'Audio-Visual (AV) Solution',
    description: 'Professional commercial AV distribution, display, audio, and presentation integration.',
    defaultSections: [
      'DISPLAY & PROJECTION',
      'AUDIO SYSTEM',
      'CONTROL & SWITCHING',
      'MOUNTING & CABLING',
      'SERVICES & COMMISSIONING',
    ],
  },
  AV: {
    type: 'AV',
    label: 'AV Solution',
    description: 'Professional commercial AV distribution, display, audio, and presentation integration.',
    defaultSections: [
      'DISPLAY & PROJECTION',
      'AUDIO SYSTEM',
      'CONTROL & SWITCHING',
      'MOUNTING & CABLING',
      'SERVICES & COMMISSIONING',
    ],
  },
  CCTV: {
    type: 'CCTV',
    label: 'CCTV & Security Surveillance',
    description: 'Multi-camera IP surveillance system with NVR, storage, switching, and deployment.',
    defaultSections: [
      'HD / IP SURVEILLANCE CAMERAS',
      'NETWORK VIDEO RECORDER & SURVEILLANCE STORAGE',
      'POE SWITCHING & EQUIPMENT RACK',
      'STRUCTURED CABLING & CONDUITING',
      'INSTALLATION, MOUNTING & CONFIGURATION',
    ],
  },
  AMC_SERVICE: {
    type: 'AMC_SERVICE',
    label: 'AMC / Maintenance Service Contract',
    description: 'Annual Maintenance Contracts, preventive service visits, breakdown support, and SLAs.',
    defaultSections: [
      'PREVENTIVE MAINTENANCE SCHEDULE',
      'CALL-OUT & BREAKDOWN SUPPORT',
      'COMPONENT REPAIR & REPLACEMENT',
      'SERVICE LEVEL AGREEMENT & SLA',
    ],
  },
  CUSTOM_MIXED: {
    type: 'CUSTOM_MIXED',
    label: 'Custom / Mixed Turnkey Project',
    description: 'Multi-zone hybrid installation combining home theater, displays, CCTV, and networking.',
    defaultSections: [
      'ZONE 1 — PRIMARY SYSTEM',
      'ZONE 2 — AUXILIARY SYSTEM',
      'INTERCONNECTIVITY & INFRASTRUCTURE',
      'TURNKEY INSTALLATION & COMMISSIONING',
    ],
  },
  CUSTOM_PROJECT: {
    type: 'CUSTOM_PROJECT',
    label: 'Custom / Mixed Turnkey Project',
    description: 'Multi-zone hybrid installation combining home theater, displays, CCTV, and networking.',
    defaultSections: [
      'ZONE 1 — PRIMARY SYSTEM',
      'ZONE 2 — AUXILIARY SYSTEM',
      'INTERCONNECTIVITY & INFRASTRUCTURE',
      'TURNKEY INSTALLATION & COMMISSIONING',
    ],
  },
  DETAILED_PROJECT: {
    type: 'DETAILED_PROJECT',
    label: 'Detailed Project (Legacy)',
    description: 'Legacy sectioned project format maintained for backward compatibility.',
    defaultSections: [
      'SECTION A — EQUIPMENT',
      'SECTION B — INFRASTRUCTURE',
      'SECTION C — SERVICES',
    ],
  },
};

/**
 * Detect Quotation Format from natural language input
 */
export function detectQuotationFormat(input: string): FormatDetectionResult {
  const text = (input || '').trim();
  const lower = text.toLowerCase();

  const detectedCategories: string[] = [];

  // 1. Home Theater Detection & Channel Config
  const hasHT =
    /\b(?:home\s*theat(?:er|re)|cinema|surround\s*sound|dolby\s*atmos|av\s*receiver|avr|subwoofer|klipsch)\b/i.test(lower) ||
    /\b\d\.\d(?:\.\d)?\b/.test(lower);

  let htConfig = '';
  const htConfigMatch = lower.match(/\b([579]\.[124](?:\.[124])?)\b/);
  if (htConfigMatch) {
    htConfig = htConfigMatch[1];
  } else if (hasHT) {
    htConfig = '7.2.1';
  }

  if (hasHT) {
    detectedCategories.push('HOME_THEATER');
  }

  // 2. Conference Room
  const hasConf =
    /\b(?:conference|boardroom|meeting\s*room|video\s*conf|vc\s*room|speakerphone|ptz)\b/i.test(lower);
  let confCapacity = '';
  const confMatch = lower.match(/\b(\d{1,3}\s*(?:seater|seat|person|people))\b/i);
  if (confMatch) {
    confCapacity = confMatch[1];
  }
  if (hasConf) {
    detectedCategories.push('CONFERENCE_ROOM');
  }

  // 3. CCTV / Surveillance
  const hasCCTV =
    /\b(?:cctv|surveillance|nvr|dvr|dome|bullet|ip\s*camera|security\s*camera|hikvision|cp\s*plus)\b/i.test(lower) ||
    (/\b(?:cameras?)\b/i.test(lower) && !/\b(?:ptz|conference|webcam|meeting)\b/i.test(lower));
  let cctvCount = '';
  const cctvMatch = lower.match(/\b(\d{1,3}\s*(?:cameras?|ch|channel))\b/i);
  if (cctvMatch) {
    cctvCount = cctvMatch[1];
  }
  if (hasCCTV) {
    detectedCategories.push('CCTV_SURVEILLANCE');
  }

  // 4. Networking
  const hasNet =
    /\b(?:network(?:ing)?|switch(?:es)?|router|access\s*point|ap|wifi|rack|patch\s*panel)\b/i.test(lower);
  let netPorts = '';
  const netMatch = lower.match(/\b(\d{1,3}\s*ports?)\b/i);
  if (netMatch) {
    netPorts = netMatch[1];
  }
  if (hasNet) {
    detectedCategories.push('NETWORKING');
  }

  // 5. Interactive Display
  const hasIFP =
    /\b(?:interactive\s*(?:display|panel|screen|board)|ifp|viewboard|smart\s*board|touch\s*panel)\b/i.test(lower);
  let ifpSize = '';
  const ifpMatch = lower.match(/\b(\d{2,3}\s*(?:inch|")?)\b/i);
  if (ifpMatch && parseInt(ifpMatch[1]) >= 55) {
    ifpSize = ifpMatch[1].includes('inch') ? ifpMatch[1] : `${ifpMatch[1]} Inch`;
  }
  if (hasIFP) {
    detectedCategories.push('INTERACTIVE_DISPLAY');
  }

  // 6. AV Projector
  const hasProj =
    /\b(?:projector|projection\s*screen|lumens|ansi\s*lumens|throw\s*ratio|benq|epson)\b/i.test(lower) && !hasHT;
  if (hasProj) {
    detectedCategories.push('AV_PROJECTOR');
  }

  // 7. Laptops / IT Hardware
  const hasIT =
    /\b(?:laptops?|desktops?|workstations?|thinkpad|latitude|vostro|macbook|dell|hp|lenovo)\b/i.test(lower);
  let itCount = '';
  const itMatch = lower.match(/\b(\d{1,3}\s*(?:laptops?|desktops?|units?|pcs?|nos?))\b/i);
  if (itMatch) {
    itCount = itMatch[1];
  }
  if (hasIT) {
    detectedCategories.push('LAPTOP_DESKTOP');
  }

  // 8. Printer Solution
  const hasPrint = /\b(?:printer|copier|photocopier|mfp|canon\s*imageclass|brother\s*dcp)\b/i.test(lower);
  if (hasPrint) {
    detectedCategories.push('PRINTER_SOLUTION');
  }

  // 9. AMC / Maintenance Service
  const hasAMC = /\b(?:amc|maintenance|annual\s*maintenance|service\s*contract|sla|preventive\s*maintenance)\b/i.test(lower);
  if (hasAMC) {
    detectedCategories.push('AMC_SERVICE');
  }

  // 10. Commercial AV Solution
  const hasAV = /\b(?:audio[- ]?visual|pro\s*audio|commercial\s*sound|public\s*address|av\s*solution|av\s*system)\b/i.test(lower) && !hasHT && !hasConf;
  if (hasAV) {
    detectedCategories.push('AV_SOLUTION');
  }

  // ---------------------------------------------------------------------------
  // Mixed Project Resolution: When 2 or more distinct project categories coexist
  // ---------------------------------------------------------------------------
  if (detectedCategories.length >= 2) {
    const mixedSections: string[] = [];
    let secCounter = 1;

    if (hasHT) {
      mixedSections.push(`0${secCounter++} HOME THEATER ROOM ${htConfig ? `(${htConfig})` : ''}`.trim());
    }
    if (hasIFP || lower.includes('tv') || lower.includes('display')) {
      mixedSections.push(`0${secCounter++} COMMERCIAL DISPLAY / TELEVISION`);
    }
    if (hasCCTV) {
      mixedSections.push(`0${secCounter++} CCTV SURVEILLANCE SYSTEM ${cctvCount ? `(${cctvCount})` : ''}`.trim());
    }
    if (hasNet) {
      mixedSections.push(`0${secCounter++} NETWORKING INFRASTRUCTURE ${netPorts ? `(${netPorts})` : ''}`.trim());
    }
    if (hasIT) {
      mixedSections.push(`0${secCounter++} IT HARDWARE & COMPUTING`);
    }

    mixedSections.push(`0${secCounter++} TURNKEY INSTALLATION & COMMISSIONING`);

    return {
      format: 'CUSTOM_PROJECT',
      formatLabel: 'Custom Project (Multi-System)',
      configuration: 'Hybrid Multi-Zone',
      confidence: 0.95,
      isMixed: true,
      detectedCategories,
      suggestedSections: mixedSections,
      explanation: `Detected mixed multi-system requirements (${detectedCategories.join(' + ')}). Suggested a Custom Project layout with dedicated sections for each zone.`,
    };
  }

  // ---------------------------------------------------------------------------
  // Single Category Matching
  // ---------------------------------------------------------------------------
  if (hasHT) {
    const configTitle = htConfig ? ` (${htConfig} ATMOS)` : '';
    return {
      format: 'HOME_THEATER',
      formatLabel: `Home Theater ${htConfig || 'Project'}`,
      configuration: htConfig || '7.2.1',
      confidence: 0.96,
      isMixed: false,
      detectedCategories: ['HOME_THEATER'],
      suggestedSections: [
        `01 HOME THEATER ROOM / CONFIGURATION${configTitle}`,
        '02 AVR / PROTECTION / SCREEN',
        '03 ALL INTERCONNECTIVITIES',
        '04 VIDEO PROJECTOR',
        '05 INSTALLATION / DESIGN / TRANSPORT / COMMISSIONING',
      ],
      explanation: `Detected Home Theater acoustic layout intent with ${htConfig || 'surround sound'} configuration. Suggesting Srikanth project BOQ format.`,
    };
  }

  if (hasConf) {
    return {
      format: 'CONFERENCE_ROOM',
      formatLabel: `Conference Room ${confCapacity ? `(${confCapacity})` : 'Solution'}`,
      configuration: confCapacity || 'Standard Seater',
      confidence: 0.92,
      isMixed: false,
      detectedCategories: ['CONFERENCE_ROOM'],
      suggestedSections: [
        '01 DISPLAY & INTERACTIVE FLAT PANEL',
        '02 PTZ CAMERA & AUTO-TRACKING SYSTEM',
        '03 MICROPHONES & AUDIO DSP SYSTEM',
        '04 CABLING & INFRASTRUCTURE',
        '05 INSTALLATION, INTEGRATION & COMMISSIONING',
      ],
      explanation: `Detected Conference Room collaboration requirement${confCapacity ? ` for ${confCapacity}` : ''}. Suggesting Conference Room format.`,
    };
  }

  if (hasCCTV) {
    return {
      format: 'CCTV_SURVEILLANCE',
      formatLabel: `CCTV Surveillance ${cctvCount ? `(${cctvCount})` : ''}`,
      configuration: cctvCount || 'Multi-Camera',
      confidence: 0.94,
      isMixed: false,
      detectedCategories: ['CCTV_SURVEILLANCE'],
      suggestedSections: [
        `01 HD / IP SURVEILLANCE CAMERAS${cctvCount ? ` (${cctvCount})` : ''}`,
        '02 NETWORK VIDEO RECORDER & SURVEILLANCE STORAGE',
        '03 POE SWITCHING & EQUIPMENT RACK',
        '04 STRUCTURED CABLING & CONDUITING',
        '05 INSTALLATION, MOUNTING & CONFIGURATION',
      ],
      explanation: `Detected CCTV surveillance project intent${cctvCount ? ` (${cctvCount})` : ''}. Suggesting CCTV/Surveillance BOQ layout.`,
    };
  }

  if (hasNet) {
    return {
      format: 'NETWORKING',
      formatLabel: `Enterprise Networking ${netPorts ? `(${netPorts})` : ''}`,
      configuration: netPorts || 'Managed Switching',
      confidence: 0.91,
      isMixed: false,
      detectedCategories: ['NETWORKING'],
      suggestedSections: [
        `01 CORE & ACCESS NETWORK SWITCHES${netPorts ? ` (${netPorts})` : ''}`,
        '02 ROUTER & WIRELESS ACCESS POINTS',
        '03 SERVER RACK & PATCH PANELS',
        '04 STRUCTURED CABLING & FIBER ACCESSORIES',
        '05 TESTING, LABELING & COMMISSIONING',
      ],
      explanation: `Detected structured networking requirement${netPorts ? ` with ${netPorts}` : ''}. Suggesting Networking infrastructure format.`,
    };
  }

  if (hasIFP) {
    return {
      format: 'INTERACTIVE_DISPLAY',
      formatLabel: `Interactive Display ${ifpSize ? `(${ifpSize})` : ''}`,
      configuration: ifpSize || 'Commercial IFP',
      confidence: 0.93,
      isMixed: false,
      detectedCategories: ['INTERACTIVE_DISPLAY'],
      suggestedSections: [
        `01 INTERACTIVE FLAT PANEL DISPLAY${ifpSize ? ` (${ifpSize})` : ''}`,
        '02 OPS PC MODULE & EMBEDDED OS',
        '03 WALL MOUNT / MOBILE HEAVY-DUTY STAND',
        '04 COLLABORATION ACCESSORIES & STYLUS',
        '05 INSTALLATION, SETUP & USER DEMO',
      ],
      explanation: `Detected Interactive Flat Panel display intent${ifpSize ? ` (${ifpSize})` : ''}. Suggesting Interactive Display solution layout.`,
    };
  }

  if (hasProj) {
    return {
      format: 'AV_PROJECTOR',
      formatLabel: 'AV & Projector Solution',
      configuration: 'Projector + Screen',
      confidence: 0.9,
      isMixed: false,
      detectedCategories: ['AV_PROJECTOR'],
      suggestedSections: [
        '01 HIGH-LUMENS COMMERCIAL PROJECTOR',
        '02 MOTORIZED / FIXED PROJECTION SCREEN',
        '03 CEILING MOUNT KIT & ACCESSORIES',
        '04 4K HDMI CABLING & TRANSMITTERS',
        '05 INSTALLATION, ALIGNMENT & TESTING',
      ],
      explanation: 'Detected Audio-Visual projector and screen requirement. Suggesting AV / Projector format.',
    };
  }

  if (hasIT) {
    return {
      format: 'LAPTOP_DESKTOP',
      formatLabel: `IT Hardware & Laptops ${itCount ? `(${itCount})` : ''}`,
      configuration: itCount || 'Commercial IT',
      confidence: 0.9,
      isMixed: false,
      detectedCategories: ['LAPTOP_DESKTOP'],
      suggestedSections: [
        `01 ENTERPRISE COMPUTING HARDWARE${itCount ? ` (${itCount})` : ''}`,
        '02 MONITORS & PERIPHERALS',
        '03 SOFTWARE LICENSES & ANTIVIRUS',
        '04 DELIVERY & INITIAL CONFIGURATION',
      ],
      explanation: `Detected commercial computing/laptop requirement${itCount ? ` (${itCount})` : ''}. Suggesting IT Hardware format.`,
    };
  }

  if (hasPrint) {
    return {
      format: 'PRINTER_SOLUTION',
      formatLabel: 'Printing Solution',
      configuration: 'Commercial Laser MFP',
      confidence: 0.88,
      isMixed: false,
      detectedCategories: ['PRINTER_SOLUTION'],
      suggestedSections: [
        '01 MULTIFUNCTION PRINTING SYSTEM',
        '02 CONSUMABLES & TONER CARTRIDGES',
        '03 NETWORK INTEGRATION & DRIVERS',
        '04 DELIVERY & OPERATOR TRAINING',
      ],
      explanation: 'Detected commercial printing and multifunction hardware requirement. Suggesting Printer Solution format.',
    };
  }

  if (hasAMC) {
    return {
      format: 'AMC_SERVICE',
      formatLabel: 'AMC & Maintenance Contract',
      configuration: 'Annual Service',
      confidence: 0.95,
      isMixed: false,
      detectedCategories: ['AMC_SERVICE'],
      suggestedSections: [
        '01 PREVENTIVE MAINTENANCE SCHEDULE',
        '02 CALL-OUT & BREAKDOWN SUPPORT',
        '03 COMPONENT REPAIR & REPLACEMENT',
        '04 SERVICE LEVEL AGREEMENT & SLA',
      ],
      explanation: 'Detected Annual Maintenance Contract or preventive service intent. Suggesting AMC / Service format.',
    };
  }

  if (hasAV) {
    return {
      format: 'AV_SOLUTION',
      formatLabel: 'Commercial AV Solution',
      configuration: 'Turnkey AV',
      confidence: 0.92,
      isMixed: false,
      detectedCategories: ['AV_SOLUTION'],
      suggestedSections: [
        '01 DISPLAY & PROJECTION',
        '02 AUDIO SYSTEM',
        '03 CONTROL & SWITCHING',
        '04 MOUNTING & CABLING',
        '05 SERVICES & COMMISSIONING',
      ],
      explanation: 'Detected Commercial Audio-Visual presentation requirement. Suggesting AV Solution format.',
    };
  }

  // Default Fallback: Standard Commercial Format
  return {
    format: 'STANDARD',
    formatLabel: 'Standard Commercial',
    confidence: 0.7,
    isMixed: false,
    detectedCategories: ['STANDARD'],
    suggestedSections: ['COMMERCIAL PRODUCTS', 'SERVICES & IMPLEMENTATION'],
    explanation: 'Standard itemized commercial quotation layout suitable for product sales and general line items.',
  };
}

/**
 * Generate initial ProjectSection objects for a chosen format
 */
export function createSectionsForFormat(
  formatType: QuotationFormatType,
  configuration?: string
): ProjectSection[] {
  const def = QUOTATION_FORMAT_REGISTRY[formatType] || QUOTATION_FORMAT_REGISTRY.STANDARD;
  let sectionTitles = [...def.defaultSections];

  if (formatType === 'HOME_THEATER' && configuration) {
    sectionTitles = [
      `HOME THEATER ROOM / CONFIGURATION (${configuration})`,
      'AVR / PROTECTION / SCREEN',
      'ALL INTERCONNECTIVITIES',
      'VIDEO PROJECTOR',
      'INSTALLATION / DESIGN / TRANSPORT / COMMISSIONING',
    ];
  }

  return sectionTitles.map((title, idx) => ({
    section_id: `sec-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
    section_title: title,
    items: [],
    section_subtotal: 0,
    section_installation: 0,
    section_discount: 0,
    section_total: 0,
  }));
}
