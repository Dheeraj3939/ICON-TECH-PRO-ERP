import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getFreshAccessToken } from '@/lib/actions/gmail';
import { GmailClient } from '@/lib/integrations/gmail-client';

/**
 * GET /api/integrations/gmail/attachment
 * Secure, authenticated on-demand streaming endpoint for Gmail attachments.
 * 
 * Fetches the attachment data buffer on-the-fly directly from the Gmail API
 * and pipes it to the browser as a downloadable attachment.
 * 
 * Leaves ZERO permanent or temporary file footprint on disk or in the database.
 */
export async function GET(request: NextRequest) {
  // 1. Enforce RBAC
  const user = await getAuthenticatedUser();
  if (!user || !['Managing Director', 'Admin / BDM'].includes(user.role)) {
    return new NextResponse('Unauthorized: Executive access required for mailbox attachments', {
      status: 403,
    });
  }

  // 2. Validate parameters
  const searchParams = request.nextUrl.searchParams;
  const messageId = searchParams.get('messageId');
  const attachmentId = searchParams.get('attachmentId');
  const filename = searchParams.get('filename') || 'attachment.bin';
  const mimeType = searchParams.get('mimeType') || 'application/octet-stream';

  if (!messageId || !attachmentId) {
    return new NextResponse('Missing required query parameters: messageId and attachmentId', {
      status: 400,
    });
  }

  try {
    const client = new GmailClient(getFreshAccessToken);
    const { data, size } = await client.getAttachment(messageId, attachmentId);

    // Sanitize filename for Content-Disposition header
    const cleanFilename = filename.replace(/["\r\n]/g, '_');

    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(size),
        'Content-Disposition': `attachment; filename="${cleanFilename}"`,
        'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    console.error('Failed to stream Gmail attachment:', err);
    return new NextResponse(err.message || 'Failed to download attachment', {
      status: 500,
    });
  }
}
