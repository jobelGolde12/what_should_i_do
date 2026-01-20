import { NextResponse } from 'next/server';
import { openRouterAPI } from '@/lib/openrouter';

export async function POST() {
  try {
    const result = await openRouterAPI.analyzeText('Suspend classes today due to heavy rainfall');
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('OpenRouter test error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json({ 
      success: false, 
      error: errorMessage,
      stack: errorStack
    }, { status: 500 });
  }
}