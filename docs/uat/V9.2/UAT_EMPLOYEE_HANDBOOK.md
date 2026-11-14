# ICON TECH PRO ERP V9.2 — EMPLOYEE UAT HANDBOOK

**Document ID:** UAT-HANDBOOK-V9.2-007  
**Audience:** All ICON TECH PRO Staff (Office & Remote)  
**Date:** 2026-11-09  
**Version:** 1.0.0 (Pre-Production Testing Guide)  

---

## 1. WELCOME TO THE UAT ENVIRONMENT

Welcome to the User Acceptance Testing (UAT) review of **ICON TECH PRO ERP V9.2**. 

The purpose of this testing phase is for you to test your real daily business operations in the new ERP before it goes live. This is a safe testing environment: **no real customer emails will be sent, and no real accounting vouchers in Tally will be altered.**

---

## 2. HOW TO ACCESS THE UAT ENVIRONMENT

### 2.1 The UAT Website URL
- **Web Address:** `https://uat.icontechpro.in`  
  *(Interim cloud preview link will be provided by your system administrator if company DNS is propagating).*
- **Supported Web Browsers:** Google Chrome, Microsoft Edge, Mozilla Firefox, or Apple Safari (updated versions).
- **Access Location:** You can access this website from the office desktop, from home, or from your phone/laptop on any internet connection.

### 2.2 How to Verify You Are in UAT (Not Production!)
Look at the very top of your browser window. You will see a dark bar with a pulsing green indicator:
```
[● FINAL UAT REVIEW]  Your Name (Your Role)  Environment: UAT (Port 3001)  Commit: 6bc3635
```
If you see this dark banner at the top, you are safely in the **Test Environment**.

### 2.3 How to Sign In
1. Navigate to the UAT web address in your browser.
2. Enter your official company email address.
3. Enter your authorized password.
4. Click **Sign In**.
*(Note: Each employee must use their own official login. Never share your password with colleagues).*

---

## 3. INDIVIDUAL EMPLOYEE TESTING CHECKLISTS

---

### **3.1 Checklist for Managing Director (Borra Narsimulu)**
- [ ] **Sign In:** Log in as Managing Director (`icontechpro@gmail.com`).
- [ ] **Executive Dashboard:** Verify that corporate revenue, project counts, and active receivables cards load cleanly.
- [ ] **Commercial Margins:** Open any quotation or Customer 360 view and verify that purchase costs and profit margins are clearly visible.
- [ ] **Order Cancellation Review:** Review any project file marked for cancellation and approve the cancellation with an explanation.
- [ ] **File Reopening Approval:** Check the Reopening Requests tab in the Open Files Cockpit and approve or reject a file reopening request submitted by sales.

---

### **3.2 Checklist for Admin / BDM (B V Dheeraj Reddy)**
- [ ] **Sign In:** Log in as Admin (`dheeraj@icontechpro.in`).
- [ ] **Open Files Cockpit:** Create a new project file (`+ Create New Project File`), assigning it to a sales executive.
- [ ] **File Ownership Transfer:** Transfer a project file from one sales executive to another and verify the transfer history in the audit log.
- [ ] **User Security Controls:** Open `/dashboard/settings/users` and review staff lockout statuses and active sessions.
- [ ] **Spec Intelligence CPQ:** Create a quotation, trigger **Spec Intelligence (Brand → Model)**, search for `BenQ TK710`, and review the automated specifications.

---

### **3.3 Checklist for Sales Executives (B Vineet Babu & Reshma)**
- [ ] **Sign In:** Log in using your company email (`vineet@icontechpro.in` or `sales@icontechpro.in`).
- [ ] **Create an Enquiry:** Go to Presales / Enquiries, click `+ New Enquiry`, select a customer from the master list, and save.
- [ ] **Create a Project File:** Open the Projects Cockpit and create an Open File for your customer.
- [ ] **Upload Customer PO:** In your project file, click **Upload Customer PO**, enter PO number, date, value, and select payment terms (e.g. `30 Days`). Verify that ownership automatically hands off to Accounts.
- [ ] **Test Lost Enquiry:** For an uncommitted enquiry with no PO, click **Close File**, select `Lost Enquiry`, choose `Requirement Not Needed` or `Competitor Selected`, and verify the file closes immediately.
- [ ] **Confidentiality Check:** Verify that supplier purchase prices and profit margins are completely hidden from your view (`purchase_price: 0`).
- [ ] **Quotation PDF:** Generate a quotation PDF and verify that no supplier costs appear on the printed proposal.
- [ ] **Request Reopening:** Open a previously closed file and click **Request Reopening**, entering your business reason.

---

### **3.4 Checklist for Accounts Executive (Hemalath)**
- [ ] **Sign In:** Log in using your company email (`accounts@icontechpro.in`).
- [ ] **Accounts Workspace:** Open `/dashboard/tally` from the sidebar under ACCOUNTS.
- [ ] **Company Selector:** Verify that `ICON TECH PRO - 2026-27` is selected as the primary live company, and that past years (`2025-26`, `2024-25`) are marked Read-Only.
- [ ] **Customer Ledger Matching:** Go to the Customer Matching tab, review match candidates (e.g. `Swan Technologies`), and click **Verify Match**.
- [ ] **Cross-Month Procurement Review:** Review the cross-month transactions tab. Verify that November purchase dates and December sales dates are preserved while displaying authentic gross margin (₹90,000 / 17.65%).
- [ ] **Receipt Allocation:** Open the Unallocated Bank Receipts tab. Select a receipt of ₹2,00,000 with ₹55,000 unallocated balance, and allocate ₹55,000 against an outstanding invoice. Verify the unallocated balance becomes ₹0.
- [ ] **Financial Clearance Check:** Open an open file and run **Check Financial Clearance** to ensure all invoices are settled before permitting successful file closure.

---

### **3.5 Checklist for Office Assistant / Remote Coordinator (Manisha)**
- [ ] **Sign In from Home:** Log in from your home laptop using your company email (`service01@icontechpro.in`).
- [ ] **Customer Master Search:** Search for customer details and view contacts without experiencing any lag over home internet.
- [ ] **Delivery Challan (Rule 55):** Open Operations / Delivery Challans, click `+ New Delivery Challan`, select a test customer, add items for site demonstration/delivery, and generate the printable Rule 55 challan.
- [ ] **Confidentiality Check:** Verify that you cannot see purchase costs, supplier names, or gross profit margins.

---

## 4. HOW TO REPORT AN ISSUE OR DEFECT

If you encounter an error, unexpected screen, or confusing button during testing:

1. **Click the "Report Issue" Button:** Look at the top right of the screen in the dark UAT bar and click the amber **Report Issue** button.
2. **Describe What Happened:**
   - What page were you on?
   - What button did you click?
   - What error message or behavior appeared?
3. **Take a Screenshot:**
   - On Windows: Press `Windows Key + Shift + S`, drag to select the screen, and paste (`Ctrl + V`) into the issue description or chat.
4. **Submit:** Click **Submit Feedback**. The technical team will review the issue and record it in the UAT Defect Register.
5. **Immediate Assistance:** Contact Admin (Dheeraj Reddy) for urgent login or environment assistance.

---
*Certified by Independent Verification Agent on 2026-11-09.*
