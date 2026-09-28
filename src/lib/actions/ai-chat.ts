'use server';

import { requireAuth } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { getCustomers } from '@/lib/actions/customers';
import { getQuotations } from '@/lib/actions/quotations';
import { getInvoices } from '@/lib/actions/billing';
import { getProducts } from '@/lib/actions/products';
import { getEnquiries } from '@/lib/actions/enquiries';
import { getFollowUps, type FollowUpItem } from '@/lib/actions/operations';
import { detectLanguage } from '@/lib/ai/gateway';
import type { SupportedLanguage, Product } from '@/types/erp';

export interface AIChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  category?: 'READ' | 'DRAFT' | 'ACTION';
  timestamp: string;
  dataSnippet?: any;
  draftDetails?: {
    channel: 'EMAIL' | 'WHATSAPP';
    recipient: string;
    subject?: string;
    body: string;
  };
}

export async function processAIChatPrompt(
  prompt: string,
  language: SupportedLanguage = 'en'
): Promise<{
  success: boolean;
  reply: string;
  category: 'READ' | 'DRAFT' | 'ACTION';
  dataSnippet?: any;
  draftDetails?: {
    channel: 'EMAIL' | 'WHATSAPP';
    recipient: string;
    subject?: string;
    body: string;
  };
  error?: string;
}> {
  try {
    const authUser = await requireAuth();
    const q = prompt.toLowerCase().trim();
    const detected = detectLanguage(prompt);
    const activeLang = language || detected;

    // Log the AI prompt query in audit trail
    await logAuditEvent({
      userName: authUser.name,
      action: 'AI_CHAT_PROMPT',
      module: 'AI_ECOSYSTEM',
      details: `User queried AI Chat: "${prompt.slice(0, 80)}"`,
    });

    const isMgmtOrAccounts = ['Managing Director', 'Admin / BDM', 'Accounts', 'BDM'].includes(authUser.role);

    // 1. Draft WhatsApp message
    if (q.includes('whatsapp') || q.includes('వాట్సాప్') || q.includes('व्हाट्सएप')) {
      const { customers } = await getCustomers();
      const targetCustomer = customers[0] || { company_name: 'Client', contact_person: 'Sir/Madam', phone: '+91 98490 12345' };
      
      const body = `Dear ${targetCustomer.contact_person || targetCustomer.company_name},\nGreetings from ICON TECH PRO Hyderabad!\nFollowing up on our recent AV/IT infrastructure quotation. We have verified material availability and can commit to priority dispatch upon your confirmation.\nPlease let us know if you require any adjustments.\n\nWarm regards,\n${authUser.name}\nICON TECH PRO`;

      return {
        success: true,
        category: 'DRAFT',
        reply: `I have prepared a draft WhatsApp follow-up message using your authorized corporate persona (${authUser.name} - ${authUser.role}). You can review and dispatch via the Communication Center.`,
        draftDetails: {
          channel: 'WHATSAPP',
          recipient: targetCustomer.phone || '+91 98490 00000',
          body,
        },
      };
    }

    // 2. Draft Email
    if (q.includes('email') || q.includes('mail') || q.includes('ఈమెయిల్') || q.includes('ईमेल')) {
      const { customers } = await getCustomers();
      const targetCustomer = customers[0] || { company_name: 'Client Corporation', contact_person: 'Executive', email: 'procurement@client.com' };

      const subject = `Follow-up: Commercial AV Infrastructure Proposal - ICON TECH PRO`;
      const body = `Dear ${targetCustomer.contact_person || 'Partner'},\n\nThank you for considering ICON TECH PRO as your unified solutions specialist.\n\nWe would like to check on the status of our submitted technical and commercial proposal. Our team is fully prepared to mobilize installation engineers to your site upon order release.\n\nPlease feel free to contact us for any technical clarification or commercial alignment.\n\nSincerely,\n${authUser.name}\n${authUser.role}\nICON TECH PRO - Hyderabad, Telangana`;

      return {
        success: true,
        category: 'DRAFT',
        reply: `I have generated a professional corporate follow-up email linked to your corporate account identity. Review below:`,
        draftDetails: {
          channel: 'EMAIL',
          recipient: targetCustomer.email || 'procurement@client.com',
          subject,
          body,
        },
      };
    }

    // 3. Enquiries query
    if (q.includes('enquir') || q.includes('lead') || q.includes('ఇంక్వైరీ') || q.includes('पूछताछ')) {
      const enqRes = await getEnquiries();
      const enquiries = enqRes.enquiries || [];
      const openEnquiries = enquiries.filter((e) => e.status !== 'Order done' && e.status !== 'Lost' && e.status !== 'Closed');
      
      let replyText = '';
      if (activeLang === 'te') {
        replyText = `మొత్తం ${enquiries.length} విచారణలు నమోదయ్యాయి, అందులో ${openEnquiries.length} ప్రస్తుతం యాక్టివ్‌గా ఉన్నాయి. తాజా లీడ్స్ వివరాలు క్రింద ఇవ్వబడ్డాయి.`;
      } else if (activeLang === 'hi') {
        replyText = `कुल ${enquiries.length} पूछताछ दर्ज हैं, जिनमें से ${openEnquiries.length} वर्तमान में सक्रिय हैं। विवरण नीचे दिया गया है।`;
      } else {
        replyText = `Found ${enquiries.length} total enquiries in the ERP, of which ${openEnquiries.length} are currently open and being pursued by the commercial team.`;
      }

      return {
        success: true,
        category: 'READ',
        reply: replyText,
        dataSnippet: openEnquiries.slice(0, 5).map((e) => ({
          id: e.id,
          customer: e.customer_name,
          category: e.product_category,
          status: e.status,
          salesperson: e.salesperson_name,
        })),
      };
    }

    // 2. Follow-ups overdue / due
    if (q.includes('follow-up') || q.includes('followup') || q.includes('overdue') || q.includes('ఫాలో-అప్') || q.includes('फॉलो-अप')) {
      const followUps = await getFollowUps();
      const overdue = followUps.filter((f: FollowUpItem) => f.is_overdue || f.status === 'Follow up');

      let replyText = '';
      if (activeLang === 'te') {
        replyText = `ప్రస్తుతం ${overdue.length} ఫాలో-అప్‌లు షెడ్యూల్ చేయబడ్డాయి లేదా పెండింగ్‌లో ఉన్నాయి. దయచేసి ప్రాధాన్యత ప్రకారం సంప్రదించండి.`;
      } else if (activeLang === 'hi') {
        replyText = `वर्तमान में ${overdue.length} फॉलो-अप निर्धारित या लंबित हैं। कृपया प्राथमिकता अनुसार संपर्क करें।`;
      } else {
        replyText = `There are ${overdue.length} follow-ups requiring team action across active enterprise accounts.`;
      }

      return {
        success: true,
        category: 'READ',
        reply: replyText,
        dataSnippet: overdue.slice(0, 5).map((f: FollowUpItem) => ({
          id: f.id,
          customer: f.customer_name,
          notes: f.requirement,
          scheduled: f.follow_up_date,
          salesperson: f.salesperson_name,
        })),
      };
    }

    // 3. Pending Quotations
    if (q.includes('quotation') || q.includes('quote') || q.includes('కొటేషన్') || q.includes('कोटेशन')) {
      const qRes = await getQuotations();
      const quotes = qRes.quotations || [];
      const pending = quotes.filter((q) => q.status === 'Sent' || q.status === 'Draft' || q.status === 'Approval Pending');
      const totalVal = pending.reduce((s, q) => s + q.grand_total, 0);

      let replyText = '';
      if (activeLang === 'te') {
        replyText = `మొత్తం ${pending.length} పెండింగ్ కొటేషన్‌లు ఉన్నాయి, వీటి మొత్తం విలువ ₹${totalVal.toLocaleString('en-IN')}.`;
      } else if (activeLang === 'hi') {
        replyText = `कुल ${pending.length} लंबित कोटेशन हैं, जिनका कुल मूल्य ₹${totalVal.toLocaleString('en-IN')} है।`;
      } else {
        replyText = `Identified ${pending.length} active/pending quotations valued at ₹${totalVal.toLocaleString('en-IN')} awaiting client order confirmation.`;
      }

      return {
        success: true,
        category: 'READ',
        reply: replyText,
        dataSnippet: pending.slice(0, 5).map((q) => ({
          number: q.quotation_number,
          customer: q.customer_name,
          total: `₹${q.grand_total.toLocaleString('en-IN')}`,
          status: q.status,
          date: q.quotation_date,
        })),
      };
    }

    // 4. Sales Summary
    if (q.includes('sales') || q.includes('revenue') || q.includes('సమ్మరీ') || q.includes('बिक्री')) {
      const invRes = await getInvoices();
      const invoices = invRes.invoices || [];
      const totalRevenue = invoices.reduce((s, i) => s + i.grand_total, 0);
      const paidInvoices = invoices.filter((i) => i.status === 'Paid');
      const paidTotal = paidInvoices.reduce((s, i) => s + i.grand_total, 0);

      let replyText = '';
      if (activeLang === 'te') {
        replyText = `ఈ నెల మొత్తం అమ్మకాలు ₹${totalRevenue.toLocaleString('en-IN')}. వసూలైన మొత్తం: ₹${paidTotal.toLocaleString('en-IN')}.`;
      } else if (activeLang === 'hi') {
        replyText = `इस महीने की कुल बिक्री ₹${totalRevenue.toLocaleString('en-IN')} है। प्राप्त राशि: ₹${paidTotal.toLocaleString('en-IN')} है।`;
      } else {
        replyText = `Total billed sales revenue is ₹${totalRevenue.toLocaleString('en-IN')} across ${invoices.length} commercial tax invoices. Realized collections: ₹${paidTotal.toLocaleString('en-IN')}.`;
      }

      return {
        success: true,
        category: 'READ',
        reply: replyText,
        dataSnippet: {
          totalBilled: `₹${totalRevenue.toLocaleString('en-IN')}`,
          collected: `₹${paidTotal.toLocaleString('en-IN')}`,
          outstanding: `₹${(totalRevenue - paidTotal).toLocaleString('en-IN')}`,
          invoiceCount: invoices.length,
        },
      };
    }

    // 5. Low-stock products
    if (q.includes('stock') || q.includes('inventory') || q.includes('low') || q.includes('స్టాక్') || q.includes('స్టాక్') || q.includes('स्टॉक')) {
      const prodRes = await getProducts();
      const products = prodRes.products || [];
      const lowStock = products.filter((p: Product) => (p.current_stock || 0) <= (p.reorder_level || 5));

      let replyText = '';
      if (activeLang === 'te') {
        replyText = `హైదరాబాద్ కార్యాలయ స్టాక్‌లో ${lowStock.length} ఉత్పత్తులు తక్కువ స్టాక్ స్థాయిలో ఉన్నాయి.`;
      } else if (activeLang === 'hi') {
        replyText = `हैदराबाद कार्यालय स्टॉक में ${lowStock.length} उत्पाद कम स्टॉक सीमा पर हैं।`;
      } else {
        replyText = `Found ${lowStock.length} products currently at or below minimum threshold in Hyderabad office stock.`;
      }

      return {
        success: true,
        category: 'READ',
        reply: replyText,
        dataSnippet: lowStock.map((p: Product) => ({
          sku: p.sku,
          name: p.name,
          currentStock: p.current_stock,
          minStock: p.reorder_level || 5,
          category: p.category_name,
          purchaseCost: isMgmtOrAccounts ? `₹${(p.purchase_price || 0).toLocaleString('en-IN')}` : '[Confidential / Restricted]',
        })),
      };
    }

    // 7. General AI Copilot response
    let defaultResponse = '';
    if (activeLang === 'te') {
      defaultResponse = `నమస్కారం ${authUser.name}! ఐకాన్ టెక్ ప్రో ఈఆర్పీ కోపైలట్ సిద్ధంగా ఉంది. విచారణలు, ఫాలో-అప్‌లు, కొటేషన్‌లు, స్టాక్ లేదా బిల్లింగ్ సంబంధిత ప్రశ్నలను అడగవచ్చు.`;
    } else if (activeLang === 'hi') {
      defaultResponse = `नमस्ते ${authUser.name}! आइकन टेक प्रो ईआरपी सहायक तैयार है। आप पूछताछ, फॉलो-अप, कोटेशन, इन्वेंटरी या बिलिंग से संबंधित जानकारी प्राप्त कर सकते हैं।`;
    } else {
      defaultResponse = `Hello ${authUser.name}! I am the ICON TECH PRO Universal ERP Copilot. I have real-time read access to permitted CRM, inventory, quotation, and financial ledgers for your role (${authUser.role}). How can I assist your operations today?`;
    }

    return {
      success: true,
      category: 'READ',
      reply: defaultResponse,
    };
  } catch (err) {
    return {
      success: false,
      reply: '',
      category: 'READ',
      error: (err as Error).message || 'Failed to process AI query',
    };
  }
}
