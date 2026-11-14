# ICON TECH PRO ERP V9.2 — REMOTE EMPLOYEE ACCESS GUIDE
## User Acceptance Testing (UAT) from Home / Remote Network

**Document ID:** UAT-REMOTE-V9.2-008  
**Target Employee:** Manisha (Office Assistant / Service Coordinator)  
**Authorized Email:** `service01@icontechpro.in`  
**Date:** 2026-11-09  
**Security Level:** Protected Employee Guidance  

---

## 1. OVERVIEW & REMOTE ACCESS POLICY

As an ICON TECH PRO employee working remotely from home, you have full authorized access to test the ERP in the pre-production cloud environment.

### Core Guarantees for Remote Work:
1. **No Office Hardware Dependency:** You do **not** need the office desktop or the owner's laptop to be turned on. The UAT ERP runs in the cloud.
2. **No Office Wi-Fi or VPN Required:** You can connect using your home broadband, mobile hotspot, or home Wi-Fi.
3. **No Developer Localhost:** You will access a public HTTPS web address via your browser, just like visiting any standard website.
4. **Shared Live Data:** Any record you create (e.g. a Delivery Challan or Service Ticket) will immediately appear on the screens of your colleagues working in the office, and vice versa.

---

## 2. HOW TO CONNECT FROM HOME

### Step 1: Open Your Web Browser
Open **Google Chrome** or **Microsoft Edge** on your laptop. Make sure your browser is updated.

### Step 2: Navigate to the UAT Address
Enter the official UAT address in your browser:
```
https://uat.icontechpro.in
```
*(If the company DNS is still propagating, your administrator will send you the direct secure cloud preview link).*

### Step 3: Check for the Secure UAT Indicator
Once the page loads, look at the top of your screen. You will see a dark bar confirming:
```
[● FINAL UAT REVIEW]  Manisha (Office Assistant)  Environment: UAT
```
This confirms you are safely connected to the test platform over encrypted HTTPS.

### Step 4: Sign In
- **Email:** `service01@icontechpro.in`
- **Password:** Your authorized company password.
- Click **Sign In**.

---

## 3. YOUR REMOTE DAILY WORKFLOW CHECKLIST

As Office Assistant, your testing checklist covers operational coordination, customer inquiries, and goods movement documentation:

---

### **Task 1: Search the Customer Master**
1. Click **Customers** in the left sidebar menu.
2. Type a customer name (e.g. `Swan Technologies` or `T-Hub`) in the search box.
3. Open the customer dossier and review the contact person, phone number, and address.
4. **Security Check:** Confirm that you **cannot** see internal purchase costs or supplier profit margins.

---

### **Task 2: Generate a Rule 55 Delivery Challan**
When equipment needs to be dispatched for site surveys, client demonstrations, or site delivery:
1. Go to **Operations > Delivery Challans** in the sidebar.
2. Click **+ New Delivery Challan**.
3. Select the customer and the project file.
4. Add the equipment items (e.g. `Optoma Laser Projector`, `Display Panel`).
5. Specify the vehicle number (e.g. `TS 09 UB 4821`) and transporter name.
6. Click **Generate Challan**.
7. Click **Print Challan** to review the official printable PDF document conforming to GST Rule 55.

---

### **Task 3: Service Ticket Intake**
1. Go to **Services > Service Tickets**.
2. Click **+ Log New Ticket**.
3. Select an existing client and record a customer complaint or service inquiry (e.g. `Audio hum in Boardroom 2`).
4. Assign the priority (e.g. `High`) and assign a field engineer (e.g. `K. Shiva Kumar`).
5. Save the ticket and verify it appears in the active service queue.

---

### **Task 4: Check Notifications**
1. Look at the top right header for the bell icon.
2. Verify that you receive in-app alerts when a new delivery challan is confirmed or when a ticket is assigned.

---

## 4. REMOTE SECURITY & DATA PRIVACY RULES

Because you are working from a home internet connection, adhere strictly to these security protocols:

1. **Keep Login Private:** Never share your password or let unauthorized persons use your logged-in laptop.
2. **Account Lockout Protection:** The system allows 3 password attempts. If you fail 3 times, your account will be temporarily locked for 30 minutes for security. If this happens, contact Dheeraj Reddy (Admin) to unlock your account.
3. **Automatic Session Expiry:** If your laptop remains idle for an extended period, your session will expire automatically to protect company data. Simply sign in again.
4. **Confidentiality:** All test data is company property. Do not download or copy customer lists onto external personal USB drives.

---

## 5. TROUBLESHOOTING & TECHNICAL ASSISTANCE

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **"This site can't be reached"** | DNS not yet resolved or home Wi-Fi drop | Check your home internet connection; try reloading or use the direct cloud link provided by Admin. |
| **"Invalid email or password"** | Typo in email or password | Ensure Caps Lock is off; type `service01@icontechpro.in` carefully. |
| **"Account Locked"** | 3 failed attempts entered | Wait 30 minutes or message Dheeraj Reddy (Admin) to reset attempts. |
| **Page looks frozen or blank** | Old browser cache | Press `Ctrl + Shift + R` (Hard Reload) to fetch the latest version. |

**Technical Support Contact:**
- Admin / IT Coordinator: B V Dheeraj Reddy (`dheeraj@icontechpro.in`)
- Urgent Phone / WhatsApp: Contact office admin via corporate channel.

---
*Certified by Independent Verification Agent on 2026-11-09.*
