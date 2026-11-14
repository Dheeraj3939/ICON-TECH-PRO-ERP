export type MailProvider = 'gmail' | 'zoho';

export type MailFolder = 'inbox' | 'starred' | 'sent' | 'drafts' | 'archive' | 'trash';

export interface MailAttachment {
  name: string;
  size: string;
  type: string;
}

export interface MailMessage {
  id: string;
  provider: MailProvider;
  folder: MailFolder;
  fromName: string;
  fromEmail: string;
  toName: string;
  toEmail: string;
  cc?: string;
  bcc?: string;
  subject: string;
  preview: string;
  body: string;
  timestamp: string;
  dateStr: string;
  isUnread: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  attachments?: MailAttachment[];
  tags: string[];
}

export interface EmployeeMailboxProfile {
  id: string;
  name: string;
  role: string;
  gmailAddress: string;
  zohoAddress: string;
  department: string;
}

export const SAMPLE_EMPLOYEE_PROFILES: EmployeeMailboxProfile[] = [
  {
    id: 'USR002',
    name: 'B V Dheeraj Reddy',
    role: 'Admin / BDM',
    gmailAddress: 'dheeraj@icontechpro.in',
    zohoAddress: 'dheeraj@icontechpro.in',
    department: 'Administration & Business Development',
  },
  {
    id: 'USR003',
    name: 'B V Vineet Babu',
    role: 'Sales Executive',
    gmailAddress: 'vineet@icontechpro.in',
    zohoAddress: 'vineet@icontechpro.in',
    department: 'Enterprise Sales',
  },
  {
    id: 'USR004',
    name: 'Reshma',
    role: 'Sales Executive',
    gmailAddress: 'sales@icontechpro.in',
    zohoAddress: 'reshma@icontechpro.in',
    department: 'Commercial Quotations & Sales',
  },
];

export const INITIAL_MOCK_EMAILS: MailMessage[] = [
  // -------------------------------------------------------------
  // GMAIL SPECIFIC SAMPLE EMAILS (Realistic Business Correspondence)
  // -------------------------------------------------------------
  {
    id: 'gm-001',
    provider: 'gmail',
    folder: 'inbox',
    fromName: 'Swan Tech Pvt Ltd (Procurement)',
    fromEmail: 'procurement@swantech.in',
    toName: 'Dheeraj Reddy',
    toEmail: 'dheeraj@icontechpro.in',
    cc: 'vineet@icontechpro.in',
    subject: 'Quotation for Conference Room AV Solution',
    preview: 'Dear Dheeraj, Please find the attached RFQ for our Hyderabad boardroom AV system upgrade...',
    body: `Dear Dheeraj,\n\nWe are looking to upgrade our main executive boardroom in Gachibowli, Hyderabad.\n\nKey Scope of Work:\n1. 4K Laser Display System (98" Commercial Interactive Flat Panel or Laser Projector with ALR screen).\n2. Ceiling Array Microphone with DSP Audio Processor (Biamp or Shure).\n3. 4K PTZ Camera system with auto-framing and voice tracking.\n4. Table Cable Cubby with HDMI, Type-C 4K pass-through, and fast-charging.\n\nPlease share a formal GST-compliant quotation along with technical datasheets and OEM warranty terms.\n\nTarget installation date: Within 3 weeks.\n\nBest regards,\nK. Ramesh Kumar\nHead of IT Infrastructure & Procurement\nSwan Tech Pvt Ltd`,
    timestamp: '10:42 AM',
    dateStr: 'Today, Oct 6, 2026',
    isUnread: true,
    isStarred: true,
    hasAttachments: true,
    attachments: [
      { name: 'RFQ_Boardroom_AV_Scope_2026.pdf', size: '1.4 MB', type: 'application/pdf' },
      { name: 'Room_Dimensions_Layout.dwg', size: '3.2 MB', type: 'application/octet-stream' },
    ],
    tags: ['Quotation', 'High Priority', 'Client RFQ'],
  },
  {
    id: 'gm-002',
    provider: 'gmail',
    folder: 'inbox',
    fromName: 'Infra Solutions India',
    fromEmail: 'purchase@infra-solutions.com',
    toName: 'Dheeraj Reddy',
    toEmail: 'dheeraj@icontechpro.in',
    subject: 'BenQ Projector Requirement & Availability',
    preview: 'Hi Team, We require 4 units of BenQ 4K laser projectors for our training center in Madhapur...',
    body: `Hi Dheeraj,\n\nWe require urgent pricing and delivery timelines for:\n- 4 units of BenQ LK936ST / LU935ST Laser Projectors (5000+ Lumens, 4K UHD).\n- 4 units of motorized ceiling drop mounts (heavy-duty).\n\nPlease let us know if stock is immediately available at your Hyderabad or Bangalore warehouse.\n\nLooking forward to your quotation today.\n\nRegards,\nSuresh Nair\nPurchase Lead, Infra Solutions`,
    timestamp: 'Yesterday',
    dateStr: 'Oct 5, 2026, 4:15 PM',
    isUnread: true,
    isStarred: false,
    hasAttachments: false,
    tags: ['Projectors', 'Lead'],
  },
  {
    id: 'gm-003',
    provider: 'gmail',
    folder: 'inbox',
    fromName: 'Apex Technologies',
    fromEmail: 'client@apextech.co.in',
    toName: 'Dheeraj Reddy',
    toEmail: 'dheeraj@icontechpro.in',
    subject: 'Meeting Confirmation — Site Inspection Tomorrow',
    preview: 'Confirmed for 11:00 AM at Gachibowli office. Our IT and facilities teams will be present...',
    body: `Dear Dheeraj,\n\nThis is to confirm our site inspection scheduled for tomorrow at 11:00 AM at Apex Technologies campus, Tower B, 4th Floor.\n\nOur Chief Technology Officer and Facilities Manager will accompany your team to inspect the conduit pathways and acoustic ceiling.\n\nPlease carry identification for security gate clearance.\n\nThanks,\nPooja Sharma\nFacilities Coordinator`,
    timestamp: 'Oct 4',
    dateStr: 'Oct 4, 2026, 2:30 PM',
    isUnread: false,
    isStarred: true,
    hasAttachments: false,
    tags: ['Site Visit', 'Meeting'],
  },
  {
    id: 'gm-004',
    provider: 'gmail',
    folder: 'sent',
    fromName: 'Dheeraj Reddy',
    fromEmail: 'dheeraj@icontechpro.in',
    toName: 'K. Ramesh Kumar (Swan Tech)',
    toEmail: 'procurement@swantech.in',
    subject: 'Preliminary Proposal: ICON TECH PRO Commercial AV Solution',
    preview: 'Dear Ramesh, Thank you for sharing the requirements. We have prepared the initial layout...',
    body: `Dear Ramesh,\n\nThank you for reaching out to ICON TECH PRO.\n\nWe have reviewed your boardroom acoustic requirements and generated proposal Q-2026-0142 with Crestron DSP and BenQ 4K visual systems.\n\nOur technical team can demonstrate the interactive panel at our Banjara Hills experience center anytime this week.\n\nWarm regards,\nB V Dheeraj Reddy\nAdmin / BDM | ICON TECH PRO\n+91 98490 12345`,
    timestamp: 'Oct 3',
    dateStr: 'Oct 3, 2026, 5:45 PM',
    isUnread: false,
    isStarred: false,
    hasAttachments: true,
    attachments: [
      { name: 'ICON_TECH_PRO_Company_Profile.pdf', size: '4.8 MB', type: 'application/pdf' },
    ],
    tags: ['Proposal', 'Sent'],
  },
  {
    id: 'gm-005',
    provider: 'gmail',
    folder: 'drafts',
    fromName: 'Dheeraj Reddy',
    fromEmail: 'dheeraj@icontechpro.in',
    toName: 'Regional Distributor Lead',
    toEmail: 'sales@crestron-india.in',
    subject: 'Draft: Q4 Deal Registration for Cyber City Auditorium',
    preview: 'Hello Rajesh, We are registering the Cyber City 500-seat auditorium project for project-based pricing discount...',
    body: `Hello Rajesh,\n\nWe are formally registering the Cyber City 500-seat auditorium project with Crestron India.\n\nProduct Bill of Materials:\n- DM-NVX-360 Encoders / Decoders (12 Units)\n- CP4 Control Processor (1 Unit)\n- TS-1070 Touch Panel (2 Units)\n\nPlease confirm our registered partner pricing margin.`,
    timestamp: 'Oct 2',
    dateStr: 'Oct 2, 2026, 11:20 AM',
    isUnread: false,
    isStarred: false,
    hasAttachments: false,
    tags: ['Draft', 'Partner Pricing'],
  },

  // -------------------------------------------------------------
  // ZOHO MAIL SPECIFIC SAMPLE EMAILS (Realistic Business Correspondence)
  // -------------------------------------------------------------
  {
    id: 'zm-001',
    provider: 'zoho',
    folder: 'inbox',
    fromName: 'Dr. Vikramaditya Rao',
    fromEmail: 'customer@hometheater-deluxe.com',
    toName: 'Dheeraj Reddy',
    toEmail: 'dheeraj@icontechpro.in',
    subject: 'Home Theater Project Discussion & Layout Approval',
    preview: 'Hi Dheeraj, We reviewed the 7.2.4 Dolby Atmos layout. Can we schedule acoustic panel installation this weekend?...',
    body: `Hi Dheeraj,\n\nMy family and I reviewed the 3D acoustic rendering and the 7.2.4 Dolby Atmos speaker placement you provided for our Jubilee Hills villa.\n\nWe are very impressed with the concealed surround speaker concept.\n\nQuestions before final sign-off:\n1. Can we swap the side surround speakers for the in-wall architectural series?\n2. What is the delivery lead time for the Marantz Cinema 30 AVR?\n\nIf the cable conduits are ready by Friday, can your installation team begin pull-wiring on Saturday?\n\nBest,\nDr. V. Rao\nJubilee Hills, Hyderabad`,
    timestamp: '11:15 AM',
    dateStr: 'Today, Oct 6, 2026',
    isUnread: true,
    isStarred: true,
    hasAttachments: true,
    attachments: [
      { name: 'HT_Villa_Acoustic_Layout_V2.dwg', size: '2.8 MB', type: 'application/octet-stream' },
      { name: 'Dolby_Atmos_Speaker_Specs.pdf', size: '890 KB', type: 'application/pdf' },
    ],
    tags: ['Home Theater', 'Atmos', 'VIP Client'],
  },
  {
    id: 'zm-002',
    provider: 'zoho',
    folder: 'inbox',
    fromName: 'Nexus Tech Parks Procurement',
    fromEmail: 'procurement@nexustech.org',
    toName: 'Dheeraj Reddy',
    toEmail: 'dheeraj@icontechpro.in',
    subject: 'Quotation Requirement — Conference Room Automation',
    preview: 'Dear ICON TECH PRO Sales, Requesting revised quotation for the 16-seater conference automation system...',
    body: `Dear Dheeraj,\n\nFollowing our technical discussions on Monday, please provide your best commercial quote for:\n- Smart Lighting Control (DALI Dimming, 4 Zones)\n- Motorized Roller Shades (RS-485 Somfy Motors, 2 Windows)\n- Occupancy Sensors & Touch Switchpad interface\n\nPlease ensure your proposal includes 18% GST and 2-year on-site comprehensive warranty terms.\n\nThank you,\nArvind Swamy\nSenior Project Engineer, Nexus Tech Parks`,
    timestamp: '09:05 AM',
    dateStr: 'Today, Oct 6, 2026',
    isUnread: true,
    isStarred: false,
    hasAttachments: false,
    tags: ['Automation', 'Quotation'],
  },
  {
    id: 'zm-003',
    provider: 'zoho',
    folder: 'inbox',
    fromName: 'Epson India Regional Depot',
    fromEmail: 'vendor@epson-india.com',
    toName: 'Dheeraj Reddy',
    toEmail: 'dheeraj@icontechpro.in',
    subject: 'Projector Pricing & Stock Availability Notification',
    preview: 'Dear Partner, New stock for EB-PU series high-lumen laser projectors arrived at Bangalore central warehouse...',
    body: `Dear ICON TECH PRO Team,\n\nWe are pleased to inform you that the EB-PU1007W (7000 Lumens) and EB-PU2213B (13,000 Lumens) laser projectors are now back in stock at our regional hub.\n\nDealer Net Pricing (DNP) has been revised downward by 3% for all orders placed before Oct 25, 2026.\n\nPlease contact your account manager for allocation requests.\n\nEpson Commercial Display Division`,
    timestamp: 'Yesterday',
    dateStr: 'Oct 5, 2026, 1:10 PM',
    isUnread: false,
    isStarred: false,
    hasAttachments: true,
    attachments: [
      { name: 'Epson_Dealer_Price_List_Q4_2026.xlsx', size: '420 KB', type: 'application/vnd.ms-excel' },
    ],
    tags: ['Vendor', 'Stock Update'],
  },
  {
    id: 'zm-004',
    provider: 'zoho',
    folder: 'inbox',
    fromName: 'Global Infra Finance Dept',
    fromEmail: 'accounts@globalinfra.com',
    toName: 'Dheeraj Reddy',
    toEmail: 'dheeraj@icontechpro.in',
    cc: 'accounts@icontechpro.in',
    subject: 'Invoice Payment Confirmation — INV-2026-089',
    preview: 'UTR #HDFC009281729 transferred today for ₹4,85,000 against Tax Invoice for Boardroom Project...',
    body: `Dear Accounts Team & Dheeraj,\n\nWe have credited payment for Tax Invoice #INV-2026-089 dated Sept 28, 2026.\n\nPayment Details:\n- Amount: ₹4,85,000/- (Rupees Four Lakh Eighty Five Thousand Only)\n- Mode: NEFT / RTGS\n- Bank: HDFC Bank Ltd\n- UTR Ref: HDFC0092817298371\n- Date: Oct 05, 2026\n\nPlease acknowledge receipt and issue the stamped payment receipt.\n\nRegards,\nM. Radhika\nSenior Accounts Executive, Global Infra Corp`,
    timestamp: 'Oct 5',
    dateStr: 'Oct 5, 2026, 11:40 AM',
    isUnread: false,
    isStarred: true,
    hasAttachments: true,
    attachments: [
      { name: 'Bank_Payment_Receipt_UTR_009281.pdf', size: '310 KB', type: 'application/pdf' },
    ],
    tags: ['Payment', 'Accounts'],
  },
  {
    id: 'zm-005',
    provider: 'zoho',
    folder: 'sent',
    fromName: 'Dheeraj Reddy',
    fromEmail: 'dheeraj@icontechpro.in',
    toName: 'Dr. Vikramaditya Rao',
    toEmail: 'customer@hometheater-deluxe.com',
    subject: 'Proposal & Acoustic Simulation — 7.2.4 Dolby Atmos Private Cinema',
    preview: 'Dear Dr. Rao, Attached please find our detailed technical specification and equipment bill of materials...',
    body: `Dear Dr. Rao,\n\nIt was a pleasure meeting you at your Jubilee Hills residence.\n\nAttached please find quotation Q-2026-0138 for the 7.2.4 Dolby Atmos Private Cinema, configured with high-sensitivity Klipsch THX ultra-certified speakers and laser projection.\n\nWe look forward to delivering a true cinematic experience.\n\nWarm regards,\nB V Dheeraj Reddy\nICON TECH PRO`,
    timestamp: 'Oct 4',
    dateStr: 'Oct 4, 2026, 6:00 PM',
    isUnread: false,
    isStarred: false,
    hasAttachments: true,
    attachments: [
      { name: 'Quotation_Q-2026-0138_HomeCinema.pdf', size: '2.1 MB', type: 'application/pdf' },
    ],
    tags: ['Proposal', 'Sent'],
  },
  {
    id: 'zm-006',
    provider: 'zoho',
    folder: 'starred',
    fromName: 'Solaris Architectural Spaces',
    fromEmail: 'director@solaris-spaces.in',
    toName: 'Dheeraj Reddy',
    toEmail: 'dheeraj@icontechpro.in',
    subject: 'Commercial AV Tender Submission Acknowledgment',
    preview: 'Your bid submission for the 500-seater auditorium audio system has been received and shortlisted...',
    body: `Dear Mr. Dheeraj,\n\nWe acknowledge receipt of ICON TECH PRO's technical bid for the 500-seater auditorium sound reinforcement system.\n\nYour proposal has successfully passed technical qualification and is shortlisted for commercial negotiation next Tuesday.\n\nBest regards,\nArunima Sen\nTender Evaluation Board`,
    timestamp: 'Oct 3',
    dateStr: 'Oct 3, 2026, 4:20 PM',
    isUnread: false,
    isStarred: true,
    hasAttachments: false,
    tags: ['Tender', 'Shortlisted'],
  },
];
