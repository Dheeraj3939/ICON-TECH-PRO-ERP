import { NextRequest, NextResponse } from 'next/server';
import { executeScheduledReportCycle } from '@/lib/actions/scheduled-reports';
import { processEmailQueue } from '@/lib/actions/email-automation';
import { logAuditEvent } from '@/lib/audit/logger';

export const dynamic = 'force-dynamic';

/**
 * Enterprise Scheduled Reports & Email Automation Cron Endpoint
 *
 * Can be invoked by:
 * - Railway Cron / Cloud Scheduler / external webhook
 * - In-app manual execution
 *
 * Security: Validates CRON_SECRET or SESSION_SECRET bearer token.
 */
export async function POST(req: NextRequest) {
  return handleCronTrigger(req);
}

export async function GET(req: NextRequest) {
  return handleCronTrigger(req);
}

async function handleCronTrigger(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const secretParam = req.nextUrl.searchParams.get('secret') || '';
    const expectedSecret = process.env.CRON_SECRET || process.env.SESSION_SECRET || 'icon-tech-pro-enterprise-cron-2026';

    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : secretParam;
    if (token !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing cron security secret token.' },
        { status: 401 }
      );
    }

    const requestedFreq = req.nextUrl.searchParams.get('frequency')?.toUpperCase();

    // Determine current Asia/Kolkata date
    const kolkataOffsetMs = 5.5 * 3600 * 1000;
    const nowKolkata = new Date(Date.now() + kolkataOffsetMs);
    const dayOfMonth = nowKolkata.getUTCDate();
    const dayOfWeek = nowKolkata.getUTCDay(); // 0 = Sun, 6 = Sat
    const month = nowKolkata.getUTCMonth(); // 0 = Jan, 3 = Apr, etc.

    const frequenciesToRun: ('DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY')[] = [];

    if (requestedFreq) {
      if (['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY'].includes(requestedFreq)) {
        frequenciesToRun.push(requestedFreq as any);
      } else {
        return NextResponse.json({ error: `Unsupported frequency '${requestedFreq}'` }, { status: 400 });
      }
    } else {
      // Default Automated Schedule:
      // 1. Daily always runs at midnight
      frequenciesToRun.push('DAILY');

      // 2. Weekly runs on Saturday
      if (dayOfWeek === 6) {
        frequenciesToRun.push('WEEKLY');
      }

      // 3. Monthly runs on 1st of month
      if (dayOfMonth === 1) {
        frequenciesToRun.push('MONTHLY');
      }

      // 4. Quarterly runs on 1st day of Indian Fiscal Quarters (Apr 1, Jul 1, Oct 1, Jan 1)
      if (dayOfMonth === 1 && [0, 3, 6, 9].includes(month)) {
        frequenciesToRun.push('QUARTERLY');
      }
    }

    const runResults: any[] = [];
    for (const freq of frequenciesToRun) {
      const res = await executeScheduledReportCycle(freq);
      runResults.push({
        frequency: freq,
        success: res.success,
        dispatchedCount: res.dispatchedRuns.length,
        runs: res.dispatchedRuns.map((r) => ({
          id: r.id,
          recipient: r.recipient_email,
          role: r.recipient_role,
          status: r.status,
        })),
        error: res.error,
      });
    }

    // Also process any queued automation emails
    const queueRes = await processEmailQueue();

    await logAuditEvent({
      userName: 'Automated Cron Trigger',
      action: 'CRON_REPORT_EXECUTION',
      module: 'EXECUTIVE_REPORTING',
      details: `Executed scheduled reporting for [${frequenciesToRun.join(', ')}]. Queue processed: ${queueRes.sent} sent, ${queueRes.failed} failed.`,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      frequenciesRun: frequenciesToRun,
      results: runResults,
      queueSummary: queueRes,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Cron execution failed' },
      { status: 500 }
    );
  }
}
