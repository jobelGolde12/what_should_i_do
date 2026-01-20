import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    keys: {
      key1: process.env.OPENROUTER_API_KEY1 ? 'exists' : 'missing',
      key2: process.env.OPENROUTER_API_KEY2 ? 'exists' : 'missing', 
      key3: process.env.OPENROUTER_API_KEY3 ? 'exists' : 'missing',
      envCheck: {
        nodeEnv: process.env.NODE_ENV,
        allEnv: Object.keys(process.env).filter(key => key.includes('OPENROUTER'))
      }
    }
  });
}