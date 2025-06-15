import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create server-side Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Check if URL already exists in scraped_listings
    const { data: existingItem, error: checkError } = await supabase
      .from('scraped_listings')
      .select('id, status')
      .eq('url', url)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking existing URL:', checkError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (existingItem) {
      // URL already exists, update it to be queued for processing
      const { error: updateError } = await supabase
        .from('scraped_listings')
        .update({
          status: 'approved',
          queued_for_processing: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingItem.id);

      if (updateError) {
        console.error('Error updating existing item:', updateError);
        return NextResponse.json({ error: 'Failed to update existing item' }, { status: 500 });
      }

      return NextResponse.json({ 
        message: 'URL already exists and has been queued for processing',
        id: existingItem.id,
        action: 'updated'
      });
    }

    // Create new entry directly as approved and queued for processing
    const { data: newItem, error: insertError } = await supabase
      .from('scraped_listings')
      .insert([{
        title: `Direct URL: ${url}`,
        url: url,
        image_url: null,
        status: 'approved',
        queued_for_processing: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting new item:', insertError);
      return NextResponse.json({ error: 'Failed to add URL to queue' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'URL added to processing queue successfully',
      id: newItem.id,
      action: 'created'
    });

  } catch (error: any) {
    console.error('Add to queue error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
} 