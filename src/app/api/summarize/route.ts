import { NextRequest, NextResponse } from 'next/server';
import { pipeline } from '@xenova/transformers';

// Simple cache variable with explicit type
let summarizerCache: any = null;

export async function POST(request: NextRequest) {
  try {
    const { text, max_length = 100, min_length = 30 } = await request.json();
    
    if (!text || text.trim().length < 20) {
      return NextResponse.json(
        { error: 'Text must be at least 20 characters' },
        { status: 400 }
      );
    }

    // Load model if not cached
    if (!summarizerCache) {
      summarizerCache = await pipeline(
        'summarization',
        'Xenova/distilbart-cnn-12-6',
        { quantized: true }
      );
    }

    const result = await summarizerCache(text.trim(), {
      max_length: Math.min(max_length, 150),
      min_length: Math.min(min_length, 50),
      do_sample: false,
    });

    // Extract summary safely
    let summary: string;
    if (Array.isArray(result) && result[0]?.summary_text) {
      summary = result[0].summary_text;
    } else if (result?.summary_text) {
      summary = result.summary_text;
    } else {
      summary = 'Could not generate summary';
    }

    return NextResponse.json({
      summary,
      model: 'distilbart-cnn-12-6',
    });
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Summarization failed' },
      { status: 500 }
    );
  }
}

// Export runtime configuration
export const runtime = 'edge';