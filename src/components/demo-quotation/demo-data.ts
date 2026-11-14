export interface DemoCustomer {
  id: string;
  customer_code: string;
  customer_name: string;
  company_name: string;
  contact_person: string;
  designation: string;
  phone: string;
  email: string;
  billing_address: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
}

export interface DemoProductSpecification {
  key: string;
  value: string;
}

export interface DemoQuotationItem {
  id: string;
  product_id?: string;
  brand: string;
  model: string;
  product_name: string;
  category: string;
  hsn_sac: string;
  unit: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  discount: number;
  section_id: string;
  image_url?: string;
  is_dynamic: boolean;
  warranty: string;
  // Specifications
  specifications: DemoProductSpecification[];
  // Mandatory Customer-Facing Description
  customer_description: string;
  // Short Highlights
  short_highlights: string[];
  // Internal Confidential Pricing (NEVER shown in customer preview)
  purchase_cost: number;
  supplier_name: string;
  internal_notes?: string;
}

export interface DemoSection {
  id: string;
  title: string;
  description?: string;
}

export type QuotationFormatKey =
  | 'HOME_THEATER'
  | 'CONFERENCE_ROOM'
  | 'CCTV'
  | 'NETWORKING'
  | 'AV_SOLUTION'
  | 'AMC_SERVICE'
  | 'STANDARD'
  | 'CUSTOM_MIXED';

export const FORMAT_OPTIONS: { key: QuotationFormatKey; label: string; badge: string }[] = [
  { key: 'STANDARD', label: 'STANDARD', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
  { key: 'HOME_THEATER', label: 'HOME THEATER', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'CONFERENCE_ROOM', label: 'CONFERENCE ROOM', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'CCTV', label: 'CCTV', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  { key: 'NETWORKING', label: 'NETWORKING', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'AV_SOLUTION', label: 'AV SOLUTION', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'AMC_SERVICE', label: 'AMC / SERVICE', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'CUSTOM_MIXED', label: 'CUSTOM / MIXED', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
];

export const FORMAT_SECTIONS: Record<QuotationFormatKey, string[]> = {
  HOME_THEATER: [
    'DISPLAY / PROJECTOR',
    'AV RECEIVER',
    'SPEAKERS',
    'SUBWOOFER',
    'SCREEN',
    'INSTALLATION & CALIBRATION',
  ],
  CONFERENCE_ROOM: [
    'DISPLAY',
    'VIDEO CONFERENCING',
    'CAMERA',
    'MICROPHONES',
    'AUDIO',
    'DSP',
    'AMPLIFIER',
    'SPEAKERS',
    'CONTROL',
    'CONNECTIVITY',
    'CABLING',
    'INSTALLATION',
    'TESTING & COMMISSIONING',
  ],
  CCTV: [
    'CAMERAS',
    'NVR',
    'HDD',
    'POE SWITCH',
    'RACK',
    'UPS',
    'CABLING',
    'ACCESSORIES',
    'INSTALLATION',
    'CONFIGURATION',
    'TESTING',
  ],
  NETWORKING: [
    'ACTIVE COMPONENTS',
    'PASSIVE COMPONENTS',
    'RACK',
    'CABLING',
    'POWER',
    'INSTALLATION',
    'CONFIGURATION',
    'TESTING',
  ],
  AV_SOLUTION: [
    'DISPLAY & PROJECTION',
    'AUDIO SYSTEM',
    'CONTROL & SWITCHING',
    'MOUNTING & CABLING',
    'SERVICES',
  ],
  AMC_SERVICE: [
    'PREVENTIVE MAINTENANCE',
    'CALL-OUT SUPPORT',
    'COMPONENT REPLACEMENT',
    'SERVICE LEVEL AGREEMENT',
  ],
  STANDARD: [
    'PRODUCTS & SERVICES',
  ],
  CUSTOM_MIXED: [
    'DISPLAY',
    'CONFERENCE',
    'NETWORKING',
    'SECURITY',
    'SERVICES',
  ],
};

export const DEMO_CUSTOMERS: DemoCustomer[] = [
  {
    id: 'CUST-DEMO-01',
    customer_code: 'ICON260002',
    customer_name: 'Kavita Reddy',
    company_name: 'ABC Technologies Pvt Ltd',
    contact_person: 'Kavita Reddy',
    designation: 'Chief Technology Officer',
    phone: '+91 98491 23456',
    email: 'kavita@abctech.com',
    billing_address: 'Road No. 12, Banjara Hills',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500034',
    gstin: '36AAACA9876Q1ZM',
  },
  {
    id: 'CUST-DEMO-02',
    customer_code: 'ICON260003',
    customer_name: 'Ravi Kumar',
    company_name: 'Ravi Kumar Residence',
    contact_person: 'Ravi Kumar',
    designation: 'Homeowner',
    phone: '+91 98492 34567',
    email: 'ravikumar.hyd@gmail.com',
    billing_address: 'Plot 42, Road No. 36, Jubilee Hills',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500033',
    gstin: '36AAXPK1234F1Z8',
  },
  {
    id: 'CUST-DEMO-03',
    customer_code: 'ICON260004',
    customer_name: 'Dr. Srinivas Rao',
    company_name: 'Telangana State Tech Academy',
    contact_person: 'Dr. Srinivas Rao',
    designation: 'Director of Academic Technology',
    phone: '+91 98493 45678',
    email: 'director@tsta.gov.in',
    billing_address: 'Academic Block B, Gachibowli',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500032',
    gstin: '36AAAGT4412E1ZQ',
  },
  {
    id: 'CUST-DEMO-04',
    customer_code: 'ICON260005',
    customer_name: 'Ramesh Varma',
    company_name: 'Hitech Security Solutions',
    contact_person: 'Ramesh Varma',
    designation: 'Managing Partner',
    phone: '+91 98494 56789',
    email: 'ramesh@hitechsec.in',
    billing_address: 'Hitech City Main Road, Madhapur',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500081',
    gstin: '36AAACH5512B1ZX',
  },
];

export const DEMO_PRESET_ITEMS: DemoQuotationItem[] = [
  {
    id: 'item-benq-tk710',
    brand: 'BenQ',
    model: 'TK710',
    product_name: 'BenQ TK710 4K UHD Laser Projector',
    category: 'Projector',
    hsn_sac: '',
    unit: 'Nos',
    quantity: 1,
    unit_price: 125000,
    gst_rate: 18,
    discount: 5000,
    section_id: 'DISPLAY / PROJECTOR',
    is_dynamic: false,
    warranty: '2 Years Comprehensive',
    specifications: [
      { key: 'Projection Technology', value: 'DLP' },
      { key: 'Resolution', value: '4K UHD (3840 × 2160)' },
      { key: 'Brightness', value: '3,200 ANSI Lumens' },
      { key: 'Light Source', value: 'Laser' },
      { key: 'HDR Support', value: 'HDR10 / HLG' },
      { key: 'Contrast Ratio', value: '600,000:1' },
      { key: 'Throw Ratio', value: '1.15–1.50' },
      { key: 'Zoom', value: '1.3x' },
      { key: 'Lens Shift', value: 'Vertical ±10%' },
      { key: 'HDMI', value: '2 × HDMI 2.0b' },
      { key: '3D Support', value: 'Yes' },
      { key: 'Speaker', value: '5W Chamber Speaker' },
    ],
    customer_description: 'Premium 4K UHD laser projector designed for immersive home-theater applications, delivering high brightness, HDR support and detailed cinematic visuals. Ideal for dedicated home theaters, media rooms and premium AV installations.',
    short_highlights: [
      '4K UHD Resolution',
      '3,200 ANSI Lumens',
      'Laser Light Source',
      'HDR10 / HLG Support',
      '600,000:1 Contrast Ratio',
      '2 × HDMI 2.0b',
      'Low Latency Gaming & Cinema',
    ],
    purchase_cost: 98000,
    supplier_name: 'BenQ India Authorized Distributor',
    internal_notes: 'Standard dealer pricing margin. Immediate stock available at Hyderabad warehouse.',
  },
  {
    id: 'item-denon-x3800h',
    brand: 'Denon',
    model: 'AVR-X3800H',
    product_name: 'Denon AVR-X3800H 9.4 Ch 8K AV Receiver',
    category: 'Home Theater',
    hsn_sac: '85184000',
    unit: 'Nos',
    quantity: 1,
    unit_price: 175000,
    gst_rate: 18,
    discount: 0,
    section_id: 'AV RECEIVER',
    is_dynamic: false,
    warranty: '3 Years Manufacturer Warranty',
    specifications: [
      { key: 'Number of Powered Channels', value: '9 Channels (105W per channel at 8 ohms)' },
      { key: 'Processing Channels', value: '11.4 Channel Processing' },
      { key: 'Audio Formats', value: 'Dolby Atmos, DTS:X, Auro-3D, IMAX Enhanced' },
      { key: 'HDMI Inputs / Outputs', value: '6 In / 3 Out (8K / HDMI 2.1)' },
      { key: 'Room Calibration', value: 'Audyssey MultEQ XT32 & Dirac Live Ready' },
      { key: 'Subwoofer Outputs', value: '4 Independent Subwoofer Outputs' },
    ],
    customer_description: 'Reference 9.4 channel 8K AV receiver with discrete 4-subwoofer processing and Dirac Live acoustic room calibration support for unparalleled spatial audio immersion.',
    short_highlights: [
      '9.4 Channels (105W/ch)',
      'Dolby Atmos & DTS:X',
      'Dirac Live Upgradeable',
      '8K Ultra HD HDMI 2.1',
      '4 Independent Subwoofers',
    ],
    purchase_cost: 135000,
    supplier_name: 'Sound United India',
    internal_notes: 'Margin 22.8%. Official distributor warranty registered.',
  },
  {
    id: 'item-polk-r700',
    brand: 'Polk Audio',
    model: 'Reserve R700',
    product_name: 'Polk Audio Reserve R700 Floorstanding Tower Speakers (Pair)',
    category: 'Home Theater',
    hsn_sac: '85182200',
    unit: 'Pair',
    quantity: 1,
    unit_price: 185000,
    gst_rate: 18,
    discount: 5000,
    section_id: 'SPEAKERS',
    is_dynamic: false,
    warranty: '5 Years Manufacturer Warranty',
    specifications: [
      { key: 'Tweeter', value: '1" Pinnacle Ring Radiator' },
      { key: 'Midrange', value: '6.5" Turbine Cone Midrange' },
      { key: 'Woofers', value: 'Dual 8" Long-Throw Polypropylene Woofers' },
      { key: 'Frequency Response', value: '30 Hz - 50 kHz' },
      { key: 'Bass Radiator', value: 'Power Port 2.0 Enhanced Bass Venting' },
      { key: 'Impedance', value: '4 Ohm (Compatible with 8 Ohm)' },
    ],
    customer_description: 'Flagship floorstanding tower speakers featuring Pinnacle Ring Radiators and dual 8-inch woofers, delivering audiophile musical clarity and visceral cinematic dynamics.',
    short_highlights: [
      'Pinnacle Ring Radiator',
      'Dual 8" High-Output Woofers',
      'Power Port 2.0 Bass',
      'Hi-Res Audio Certified',
    ],
    purchase_cost: 142000,
    supplier_name: 'MZ Audio Distributions',
    internal_notes: 'Pair price. High customer satisfaction index.',
  },
  {
    id: 'item-svs-sb3000',
    brand: 'SVS',
    model: 'SB-3000',
    product_name: 'SVS SB-3000 13-inch Sealed Powered Subwoofer',
    category: 'Home Theater',
    hsn_sac: '85182100',
    unit: 'Nos',
    quantity: 1,
    unit_price: 138000,
    gst_rate: 18,
    discount: 0,
    section_id: 'SUBWOOFER',
    is_dynamic: false,
    warranty: '5 Years Unconditional Warranty',
    specifications: [
      { key: 'Driver', value: '13" High-Excursion SVS Driver' },
      { key: 'Amplifier', value: '800 Watts RMS (2,500+ Watts Peak) Sledge STA-800D2 DSP' },
      { key: 'Frequency Response', value: '18 Hz - 270 Hz (±3 dB)' },
      { key: 'Cabinet Design', value: 'Acoustically Inert Compact Sealed Enclosure' },
      { key: 'App Control', value: 'Smartphone DSP App for iOS and Android' },
    ],
    customer_description: 'Groundbreaking reference sealed subwoofer delivering thunderous low-frequency extension and pinpoint transient speed down to 18Hz without room overhang.',
    short_highlights: [
      '13" High-Excursion Driver',
      '800W RMS / 2500W Peak',
      '18Hz Deep Bass Extension',
      'Bluetooth DSP Smartphone Control',
    ],
    purchase_cost: 106000,
    supplier_name: 'Acoustic Arts Distribution',
    internal_notes: 'Black Ash finish. 5-year warranty included.',
  },
  {
    id: 'item-screen-135',
    brand: 'Elite Screens',
    model: 'AcousticPro UHD 135"',
    product_name: '135-inch 16:9 Fixed Frame Sound-Transparent Projection Screen',
    category: 'Home Theater',
    hsn_sac: '90106000',
    unit: 'Nos',
    quantity: 1,
    unit_price: 88000,
    gst_rate: 18,
    discount: 0,
    section_id: 'SCREEN',
    is_dynamic: false,
    warranty: '2 Years Manufacturer Warranty',
    specifications: [
      { key: 'Diagonal Size', value: '135-inch (16:9 Aspect Ratio)' },
      { key: 'Screen Material', value: 'AcousticPro UHD Angular Weave Sound Transparent' },
      { key: 'Gain', value: '1.0 Gain with 180° Viewing Angle' },
      { key: 'Frame', value: '3.5" Heavy-Duty Aluminum Velvet Coated Bezel' },
      { key: 'Resolution Support', value: '4K/8K Ultra HD Ready with zero moiré effect' },
    ],
    customer_description: 'Acoustically transparent fixed-frame cinema screen engineered to allow center and main speakers to be mounted directly behind the image for cinema-true audio-visual coherence.',
    short_highlights: [
      '135" Diagonal 16:9',
      'Sound Transparent Weave',
      '4K/8K Ultra HD Ready',
      'Heavy-Duty Velvet Bezel',
    ],
    purchase_cost: 62000,
    supplier_name: 'Elite Screens India',
    internal_notes: 'Rigid tensioned frame prevents any sagging.',
  },
  {
    id: 'item-install-calib',
    brand: 'ICON TECH PRO',
    model: 'SRV-HT-CALIB',
    product_name: 'Turnkey 7.2.1 Dolby Atmos Acoustic Calibration & Commissioning',
    category: 'Installation',
    hsn_sac: '9987',
    unit: 'Job',
    quantity: 1,
    unit_price: 45000,
    gst_rate: 18,
    discount: 0,
    section_id: 'INSTALLATION & CALIBRATION',
    is_dynamic: true,
    warranty: '1 Year Installation Workmanship',
    specifications: [
      { key: 'Scope', value: 'Rigging, Laser Alignment, Cabling Termination & Concealment' },
      { key: 'Acoustic Tools', value: 'UMIK-1 Calibrated Microphone & REW Room EQ Wizard Analysis' },
      { key: 'DSP Tuning', value: 'Target Curve EQ, Phase Alignment & Subwoofer Time Delay Integration' },
      { key: 'Handover', value: 'Client Demonstration, Pre-set Profiles & Remote Control Configuration' },
    ],
    customer_description: 'Comprehensive turnkey on-site installation, precision ceiling laser alignment, 48Gbps HDMI cable termination, and multi-position Dirac Live / Audyssey acoustic room calibration for optimal reference performance.',
    short_highlights: [
      'Turnkey Professional Rigging',
      'Precision Laser Alignment',
      'Dirac Live Acoustic Calibration',
      'Subwoofer Time-Alignment Tuning',
    ],
    purchase_cost: 15000,
    supplier_name: 'In-House Technical Team',
    internal_notes: '2 senior AV engineers for 2 days on-site.',
  },
];

export const DEMO_STANDARD_COMMERCIAL_ITEMS: DemoQuotationItem[] = [
  {
    id: 'item-dell-lat-5440',
    brand: 'Dell',
    model: 'Latitude 5440',
    product_name: 'Dell Latitude 5440 14" Business Laptop (Intel Core i7-1355U / 16GB RAM / 512GB SSD / Windows 11 Pro)',
    category: 'Laptops',
    hsn_sac: '84713010',
    unit: 'Nos',
    quantity: 5,
    unit_price: 85000,
    gst_rate: 18,
    discount: 0,
    section_id: 'PRODUCTS & SERVICES',
    is_dynamic: false,
    warranty: '3 Years Dell ProSupport On-Site Next Business Day',
    specifications: [
      { key: 'Processor', value: '13th Gen Intel Core i7-1355U (10 cores, up to 5.0 GHz)' },
      { key: 'Memory', value: '16GB (1x16GB) DDR4 3200MHz Non-ECC' },
      { key: 'Storage', value: '512GB M.2 PCIe NVMe Solid State Drive' },
      { key: 'Display', value: '14.0" FHD (1920x1080) Non-Touch, AG, IPS, 250 nits' },
      { key: 'Operating System', value: 'Windows 11 Pro 64-bit English Pre-Installed' },
    ],
    customer_description: 'Enterprise-grade 14-inch commercial laptop engineered for hybrid business performance, featuring military-standard durability, integrated hardware security TPM 2.0, and 3-year on-site next-business-day manufacturer warranty.',
    short_highlights: [
      'Intel Core i7-1355U',
      '16GB RAM / 512GB SSD',
      '14.0" FHD Anti-Glare',
      '3 Years ProSupport',
    ],
    purchase_cost: 72000,
    supplier_name: 'Dell India Enterprise Direct',
    internal_notes: 'Standard volume purchase tier with Dell India.',
  },
  {
    id: 'item-hp-laserjet-3103',
    brand: 'HP',
    model: 'LaserJet Pro MFP 3103fdw',
    product_name: 'HP LaserJet Pro MFP 3103fdw Multifunction Wireless Office Laser Printer',
    category: 'Printers',
    hsn_sac: '84433100',
    unit: 'Nos',
    quantity: 2,
    unit_price: 32000,
    gst_rate: 18,
    discount: 1000,
    section_id: 'PRODUCTS & SERVICES',
    is_dynamic: false,
    warranty: '1 Year On-Site Commercial Warranty',
    specifications: [
      { key: 'Function', value: 'Print, Copy, Scan, Fax, Wireless Networking' },
      { key: 'Print Speed', value: 'Up to 35 ppm (Letter / A4 Black)' },
      { key: 'Duplex', value: 'Automatic Two-Sided Printing & 50-sheet ADF' },
      { key: 'Connectivity', value: 'Dual-Band Wi-Fi, Gigabit Ethernet, USB 2.0' },
    ],
    customer_description: 'High-productivity wireless all-in-one laser printer designed for department workgroups, delivering fast black-and-white printing, automatic double-sided scanning, and integrated enterprise security features.',
    short_highlights: [
      '35 ppm Fast Printing',
      'Auto 2-Sided Duplex',
      '50-Sheet ADF Scanner',
      'Dual-Band Wi-Fi & LAN',
    ],
    purchase_cost: 26000,
    supplier_name: 'HP Commercial Distributors',
    internal_notes: 'Includes starter toner cartridges for 1,500 pages.',
  },
  {
    id: 'item-epson-eb-e01',
    brand: 'Epson',
    model: 'EB-E01',
    product_name: 'Epson EB-E01 XGA 3LCD Classroom & Meeting Room Projector',
    category: 'Projectors',
    hsn_sac: '', // Intentionally empty to verify optional HSN/SAC
    unit: 'Nos',
    quantity: 2,
    unit_price: 38000,
    gst_rate: 18,
    discount: 0,
    section_id: 'PRODUCTS & SERVICES',
    is_dynamic: false,
    warranty: '2 Years Manufacturer Warranty on Projector / 1 Year on Lamp',
    specifications: [
      { key: 'Display Technology', value: '3LCD 3-Chip Technology' },
      { key: 'Color & White Brightness', value: '3,300 ANSI Lumens' },
      { key: 'Native Resolution', value: 'XGA (1024 × 768)' },
      { key: 'Lamp Life', value: 'Up to 12,000 Hours (Eco Mode)' },
      { key: 'Interface', value: 'HDMI 1.4, VGA D-Sub 15pin, USB Type-B' },
    ],
    customer_description: 'Bright and reliable 3LCD business projector designed for conference rooms and corporate training spaces, delivering 3,300 lumens of equal color and white brightness with long lamp maintenance intervals.',
    short_highlights: [
      '3,300 ANSI Lumens',
      '3LCD Vibrant Color Tech',
      '12,000 Hrs Long Lamp Life',
      'HDMI & VGA Dual Input',
    ],
    purchase_cost: 30500,
    supplier_name: 'Epson India Regional Distributor',
    internal_notes: 'Tested with ceiling mounts.',
  },
];

export const AI_RESEARCH_PRESETS: Record<string, {
  brand: string;
  model: string;
  product_name: string;
  category: string;
  hsn_sac: string;
  unit_price: number;
  purchase_cost: number;
  supplier_name: string;
  specifications: DemoProductSpecification[];
  customer_description: string;
  short_highlights: string[];
}> = {
  'benq-tk710': {
    brand: 'BenQ',
    model: 'TK710',
    product_name: 'BenQ TK710 4K UHD Laser Projector',
    category: 'Projector',
    hsn_sac: '',
    unit_price: 125000,
    purchase_cost: 98000,
    supplier_name: 'BenQ India Authorized Distributor',
    specifications: [
      { key: 'Projection Technology', value: 'DLP' },
      { key: 'Resolution', value: '4K UHD (3840 × 2160)' },
      { key: 'Brightness', value: '3,200 ANSI Lumens' },
      { key: 'Light Source', value: 'Laser' },
      { key: 'HDR Support', value: 'HDR10 / HLG' },
      { key: 'Contrast Ratio', value: '600,000:1' },
      { key: 'Throw Ratio', value: '1.15–1.50' },
      { key: 'Zoom', value: '1.3x' },
      { key: 'Lens Shift', value: 'Vertical ±10%' },
      { key: 'HDMI', value: '2 × HDMI 2.0b' },
    ],
    customer_description: 'Premium 4K UHD laser projector designed for immersive home-theater applications, delivering high brightness, HDR support and detailed cinematic visuals. Ideal for dedicated home theaters, media rooms and premium AV installations.',
    short_highlights: [
      '4K UHD Resolution',
      '3,200 ANSI Lumens',
      'Laser Light Source',
      'HDR10 / HLG Support',
      '600,000:1 Contrast Ratio',
      '2 × HDMI 2.0b',
    ],
  },
  'denon-x3800h': {
    brand: 'Denon',
    model: 'AVR-X3800H',
    product_name: 'Denon AVR-X3800H 9.4 Ch 8K AV Receiver',
    category: 'Home Theater',
    hsn_sac: '85184000',
    unit_price: 175000,
    purchase_cost: 135000,
    supplier_name: 'Sound United India',
    specifications: [
      { key: 'Amplification', value: '9.4 Channels (105W/ch)' },
      { key: 'Decoders', value: 'Dolby Atmos, DTS:X, Auro-3D, IMAX Enhanced' },
      { key: 'Video Resolution', value: '8K Ultra HD HDMI 2.1' },
      { key: 'Room Calibration', value: 'Audyssey MultEQ XT32 & Dirac Live Ready' },
      { key: 'Subwoofer Outputs', value: '4 Independent Subwoofer Outputs' },
    ],
    customer_description: 'Reference 9.4 channel 8K AV receiver with discrete 4-subwoofer processing and Dirac Live acoustic room calibration support for unparalleled spatial audio immersion.',
    short_highlights: [
      '9.4 Channels (105W/ch)',
      'Dolby Atmos & DTS:X',
      'Dirac Live Upgradeable',
      '8K Ultra HD HDMI 2.1',
    ],
  },
  'poly-studio-x50': {
    brand: 'Poly',
    model: 'Studio X50',
    product_name: 'Poly Studio X50 Video Bar with TC8 Touch Control',
    category: 'Video Conferencing',
    hsn_sac: '85176290',
    unit_price: 245000,
    purchase_cost: 195000,
    supplier_name: 'HP Poly Enterprise Distribution',
    specifications: [
      { key: 'Camera Optics', value: '4K Ultra HD with 120° Field of View' },
      { key: 'Zoom', value: '5x Digital Zoom with Automatic Speaker Framing' },
      { key: 'Microphone Array', value: 'Next-Gen Beamforming Microphones (25ft pickup)' },
      { key: 'Audio Features', value: 'Poly Acoustic Fence and NoiseBlockAI' },
      { key: 'Supported Platforms', value: 'Native Zoom Rooms, Microsoft Teams, SIP/H.323' },
    ],
    customer_description: 'All-in-one 4K video conferencing bar engineered for medium-sized conference rooms, featuring intelligent camera framing, acoustic noise suppression, and native Teams/Zoom touch operation.',
    short_highlights: [
      '4K UHD Auto-Framing Camera',
      'Beamforming Acoustic Microphones',
      'NoiseBlockAI Technology',
      'Native Teams & Zoom Rooms',
    ],
  },
};

export const DEMO_COMPANY_INFO = {
  name: 'ICON TECH PRO',
  legalName: 'ICON TECHNOLOGIES PRIVATE LIMITED',
  tagline: 'Professional Audio-Visual, Home Automation & Acoustic Solutions',
  address: 'Plot No. 128, Phase-II, Kavuri Hills, Madhapur',
  city: 'Hyderabad',
  state: 'Telangana',
  pincode: '500081',
  phone: '+91 40 4852 9900 / +91 99890 12345',
  email: 'sales@icontechpro.com',
  website: 'www.icontechpro.com',
  gstin: '36AABCU9603R1ZM',
  pan: 'AABCU9603R',
  cin: 'U72200TG2018PTC128456',
};

export const DEMO_BANK_DETAILS = {
  bankName: 'IDBI Bank Limited',
  branch: 'Madhapur Branch, Hyderabad',
  accountName: 'ICON TECHNOLOGIES PRIVATE LIMITED',
  accountNumber: '0594102000018492',
  ifscCode: 'IBKL0000594',
  accountType: 'Current Account',
  upiId: 'icontechpro@idbi',
};

export const DEFAULT_TERMS_CONDITIONS = [
  'Validity: This quotation is valid for 15 days from the date of issue.',
  'Payment Terms: 60% advance with Purchase Order, 30% on delivery of equipment, 10% after successful installation & handover.',
  'Delivery Period: 7 to 10 working days from the date of receipt of confirmed advance payment.',
  'Taxes: GST will be charged extra as applicable at the time of invoicing (currently 18% standard).',
  'Warranty: Manufacturer warranty applies as specified per item. On-site installation workmanship covered for 1 year.',
  'Civil/Carpentry/Concealment: Any civil, electrical conduit or false ceiling work is excluded unless specifically line-itemed.',
  'Jurisdiction: All disputes are subject to Hyderabad jurisdiction only.',
];

export function numberToIndianWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Zero Rupees Only';
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n < 20) return units[n];
    return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '');
  }

  function convertThreeDigits(n: number): string {
    let str = '';
    if (Math.floor(n / 100) > 0) {
      str += units[Math.floor(n / 100)] + ' Hundred ';
    }
    const rem = n % 100;
    if (rem > 0) {
      str += convertTwoDigits(rem);
    }
    return str.trim();
  }

  const rounded = Math.round(amount);
  let remaining = rounded;

  const crore = Math.floor(remaining / 10000000);
  remaining %= 10000000;
  const lakh = Math.floor(remaining / 100000);
  remaining %= 100000;
  const thousand = Math.floor(remaining / 1000);
  remaining %= 1000;
  const hundreds = remaining;

  let words = '';
  if (crore > 0) words += convertThreeDigits(crore) + ' Crore ';
  if (lakh > 0) words += convertThreeDigits(lakh) + ' Lakh ';
  if (thousand > 0) words += convertThreeDigits(thousand) + ' Thousand ';
  if (hundreds > 0) words += convertThreeDigits(hundreds);

  return 'Rupees ' + words.trim() + ' Only';
}
