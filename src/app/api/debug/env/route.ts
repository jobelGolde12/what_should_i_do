import { NextResponse } from 'next/server';
import { isDebugAllowed, authorized, DEBUG_UNAVAILABLE } from '@/lib/debug/guard';

export async function GET(request: Request) {
  if (!isDebugAllowed()) {
    return NextResponse.json(DEBUG_UNAVAILABLE, { status: 404 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const tokenRouterKeys = Object.keys(process.env).filter(key =>
    key.startsWith('TOKENROUTER')
  );
  const legacyOpenRouterKeys = Object.keys(process.env).filter(key =>
    key.startsWith('OPENROUTER')
  );

  return NextResponse.json({
    keys: {
      tokenRouter: {
        apiKey: process.env.TOKENROUTER_API_KEY ? 'exists' : 'missing',
        baseUrl: process.env.TOKENROUTER_BASE_URL || '(default: https://api.tokenrouter.com/v1)',
        model: process.env.TOKENROUTER_MODEL || '(auto-route)',
        fallbacks: process.env.TOKENROUTER_MODEL_FALLBACKS || '(none)',
        envCheck: {
          nodeEnv: process.env.NODE_ENV,
          allTokenRouterKeys: tokenRouterKeys,
        },
      },
      legacyOpenRouter: {
        present: legacyOpenRouterKeys.length > 0,
        keys: legacyOpenRouterKeys,
        deprecated: true,
      },
    },
  });
}
