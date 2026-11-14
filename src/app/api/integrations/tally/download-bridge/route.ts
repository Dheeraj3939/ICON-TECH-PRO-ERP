import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const bridgePath = path.resolve(process.cwd(), 'scripts', 'tally-bridge-agent.mjs');
    if (!fs.existsSync(bridgePath)) {
      return new NextResponse('Bridge script not found', { status: 404 });
    }

    const scriptContent = fs.readFileSync(bridgePath, 'utf8');

    return new NextResponse(scriptContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Content-Disposition': 'attachment; filename="tally-bridge-agent.mjs"',
      },
    });
  } catch (err: any) {
    return new NextResponse(err?.message || 'Error serving bridge script', { status: 500 });
  }
}
