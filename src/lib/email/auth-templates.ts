/**
 * ICON TECH PRO ERP V9.2 — Standardized Authentication & Identity Email Templates
 * Branded, responsive transactional templates for employee onboarding, password recovery,
 * and security alerts.
 */

export interface InvitationEmailParams {
  name: string;
  email: string;
  role: string;
  inviteUrl: string;
  corporateEmail?: string;
  expiresHours?: number;
}

export interface PasswordResetEmailParams {
  name: string;
  email: string;
  resetUrl: string;
  expiresHours?: number;
}

export interface PasswordChangedEmailParams {
  name: string;
  email: string;
  changedAt?: string;
}

export interface AccountStatusAlertParams {
  name: string;
  email: string;
  status: string;
  reason?: string;
}

const BRAND_HEADER = `
  <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
    <div style="font-size: 16px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">
      ICON <span style="color: #2563eb;">TECH PRO</span> ERP
    </div>
    <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
      Enterprise Security &amp; Identity Management
    </div>
  </div>
`;

const BRAND_FOOTER = `
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
    <p style="margin: 0 0 4px 0;"><strong>Security Notice:</strong> ICON TECH PRO administrators will never ask for your password.</p>
    <p style="margin: 0;">ICON TECH PRO ERP V9.2 • Hyderabad, Telangana • Confidential Enterprise Communication</p>
  </div>
`;

export function renderInvitationEmail(params: InvitationEmailParams): { subject: string; html: string; text: string } {
  const { name, email, role, inviteUrl, corporateEmail, expiresHours = 24 } = params;
  const subject = 'Welcome to ICON TECH PRO ERP — Set Up Your Account';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #0f172a;">
      ${BRAND_HEADER}
      <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0;">Account Activation Invitation</h2>
      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 12px 0;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
        An administrator has provisioned your user account on ICON TECH PRO ERP with the assigned role of <strong>${role}</strong>.
      </p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
        <div style="font-size: 13px; color: #475569; margin-bottom: 6px;">
          <strong>ERP Login Email:</strong> <code style="color: #2563eb; font-weight: 600;">${email}</code>
        </div>
        ${corporateEmail ? `
        <div style="font-size: 13px; color: #475569;">
          <strong>Corporate Mailbox:</strong> <code style="color: #475569;">${corporateEmail}</code>
        </div>
        ` : ''}
      </div>

      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 16px 0;">
        You can activate your account in one click by choosing <strong>&quot;Sign in with Zoho&quot;</strong> (for your @icontechpro.in corporate email) or <strong>&quot;Sign in with Google&quot;</strong> (for leadership/Gmail accounts) on the ERP login portal, or click the button below to establish a dedicated password. This security link will expire in ${expiresHours} hours.
      </p>

      <div style="margin: 24px 0;">
        <a href="${inviteUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block;">
          Activate Account &amp; Set Password
        </a>
      </div>

      <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 16px 0 0 0;">
        Or copy and paste this link into your browser:<br>
        <code style="word-break: break-all; color: #2563eb; font-size: 12px;">${inviteUrl}</code>
      </p>

      ${BRAND_FOOTER}
    </div>
  `;

  const text = `ICON TECH PRO ERP — Account Activation Invitation\n\nHello ${name},\n\nAn administrator has invited you to join ICON TECH PRO ERP with the role of ${role}.\n\nYour ERP Login Email: ${email}\n${corporateEmail ? `Corporate Mailbox: ${corporateEmail}\n` : ''}\nUse the link below to set your password and activate your account (single-use, expires in ${expiresHours} hours):\n${inviteUrl}\n\nRegards,\nICON TECH PRO Security`;

  return { subject, html, text };
}

export function renderPasswordResetEmail(params: PasswordResetEmailParams): { subject: string; html: string; text: string } {
  const { name, email, resetUrl, expiresHours = 24 } = params;
  const subject = 'ICON TECH PRO ERP — Password Reset Request';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #0f172a;">
      ${BRAND_HEADER}
      <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0;">Password Reset Request</h2>
      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 12px 0;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
        A password reset request was received for your ICON TECH PRO ERP account (<code>${email}</code>).
      </p>

      <div style="margin: 24px 0;">
        <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block;">
          Reset Account Password
        </a>
      </div>

      <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 16px 0 0 0;">
        Or copy and paste this link into your browser:<br>
        <code style="word-break: break-all; color: #2563eb; font-size: 12px;">${resetUrl}</code>
      </p>

      <p style="font-size: 12px; color: #64748b; margin-top: 16px;">
        This link is single-use and valid for ${expiresHours} hours. If you did not request this password reset, please contact your system administrator immediately; your account remains secure.
      </p>

      ${BRAND_FOOTER}
    </div>
  `;

  const text = `ICON TECH PRO ERP — Password Reset Request\n\nHello ${name},\n\nA password reset request was received for your account (${email}).\n\nReset your password using this link (single-use, expires in ${expiresHours} hours):\n${resetUrl}\n\nIf you did not request this reset, please contact your system administrator.\n\nRegards,\nICON TECH PRO Security`;

  return { subject, html, text };
}

export function renderPasswordChangedAlertEmail(params: PasswordChangedEmailParams): { subject: string; html: string; text: string } {
  const { name, email, changedAt = new Date().toISOString() } = params;
  const subject = 'ICON TECH PRO ERP — Security Alert: Password Changed';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #0f172a;">
      ${BRAND_HEADER}
      <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0;">Security Alert: Password Changed</h2>
      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 12px 0;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
        The password for your ICON TECH PRO ERP account (<code>${email}</code>) was successfully updated on <strong>${new Date(changedAt).toLocaleString()}</strong>.
      </p>
      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
        All existing active sessions across other devices have been invalidated for security. If you made this change, no further action is required.
      </p>
      <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 12px 16px; margin: 20px 0; font-size: 12px; color: #9f1239;">
        <strong>Did not perform this change?</strong> Immediately notify your system administrator to lock your account and investigate unauthorized activity.
      </div>
      ${BRAND_FOOTER}
    </div>
  `;

  const text = `ICON TECH PRO ERP — Security Alert: Password Changed\n\nHello ${name},\n\nThe password for your account (${email}) was updated on ${changedAt}.\n\nIf you did not make this change, please contact your administrator immediately.\n\nRegards,\nICON TECH PRO Security`;

  return { subject, html, text };
}

export function renderAccountStatusAlertEmail(params: AccountStatusAlertParams): { subject: string; html: string; text: string } {
  const { name, email, status, reason } = params;
  const subject = `ICON TECH PRO ERP — Account Status Notification: ${status}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; color: #0f172a;">
      ${BRAND_HEADER}
      <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0;">Account Status Update</h2>
      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 12px 0;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
        Your account access status on ICON TECH PRO ERP (<code>${email}</code>) has been updated to: <strong style="color: #2563eb;">${status}</strong>.
      </p>
      ${reason ? `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #475569;">
        <strong>Details:</strong> ${reason}
      </div>
      ` : ''}
      <p style="font-size: 12px; color: #64748b; margin-top: 16px;">
        For inquiries regarding your access credentials, please contact your human resources department or system administrator.
      </p>
      ${BRAND_FOOTER}
    </div>
  `;

  const text = `ICON TECH PRO ERP — Account Status Update\n\nHello ${name},\n\nYour account (${email}) status is now: ${status}.\n${reason ? `Details: ${reason}\n` : ''}\nRegards,\nICON TECH PRO Security`;

  return { subject, html, text };
}
