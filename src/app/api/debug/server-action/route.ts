import { NextResponse } from 'next/server';
import { analyzeText } from '@/app/actions/analyzeText';

export async function POST() {
  try {
    const result = await analyzeText('Suspend classes today due to heavy rainfall');
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Server action test error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json({ 
      success: false, 
      error: errorMessage,
      stack: errorStack 
    }, { status: 500 });
  }
}