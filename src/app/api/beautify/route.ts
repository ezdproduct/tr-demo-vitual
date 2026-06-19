import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json(); // image is base64 dataUrl: data:image/jpeg;base64,...
    if (!image) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your-openai-api-key-here') {
      return NextResponse.json({ 
        error: 'OpenAI API key is missing or not configured on server',
        needsConfig: true 
      }, { status: 400 });
    }

    const openai = new OpenAI({ 
      apiKey,
      baseURL: process.env.OPENAI_API_BASE_URL || undefined
    });

    const visionModel = process.env.OPENAI_VISION_MODEL || 'gpt-4o';
    const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gemini-2.5-flash-image';

    let beautifiedDataUrl = '';

    const isDalle = imageModel.toLowerCase().startsWith('dall-e');

    if (isDalle) {
      // --- Standard OpenAI Two-Step Flow (Vision Analysis + DALL-E Generation) ---
      const chatResponse = await openai.chat.completions.create({
        model: visionModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this photo which contains a furniture/product item overlaid on a room background. Describe the scene in detail as a high-end interior design catalog photograph. Focus on describing the furniture type, style, placement, materials, and the room environment (lighting, floor, wall color) so that it can be beautifully recreated. Keep the description under 120 words. Start directly with the description, no intros.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: image
                }
              }
            ]
          }
        ],
        max_tokens: 300
      });

      const description = chatResponse.choices[0]?.message?.content;
      if (!description) {
        throw new Error(`${visionModel} failed to analyze the image`);
      }

      const imageResponse = await openai.images.generate({
        model: imageModel,
        prompt: `A professional, high-end interior design portfolio photograph of: ${description}. Perfectly styled, photorealistic, warm lighting, architectural digest style, highly detailed.`,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json'
      });

      const beautifiedBase64 = imageResponse.data?.[0]?.b64_json;
      if (!beautifiedBase64) {
        throw new Error(`${imageModel} failed to generate the image`);
      }

      beautifiedDataUrl = `data:image/png;base64,${beautifiedBase64}`;
    } else {
      // --- Chat(Modify Picture) Flow (Gemini Image Models, etc.) ---
      const chatResponse = await openai.chat.completions.create({
        model: imageModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this photo which contains a furniture/product item overlaid on a room background. Recreate it as a high-end interior design portfolio photograph. Ensure the room environment is perfectly styled, photorealistic, with warm lighting, in an architectural digest style, highly detailed, beautifully integrating the dining set/furniture.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: image
                }
              }
            ]
          }
        ]
      });

      const responseContent = chatResponse.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error(`${imageModel} failed to return a response`);
      }

      // Parse generated image URL from response (e.g. ![image](url) or plain URL)
      let imageUrl = null;
      const markdownMatch = responseContent.match(/!\[.*?\]\((.*?)\)/);
      if (markdownMatch) {
        imageUrl = markdownMatch[1];
      } else {
        const urlMatch = responseContent.match(/https?:\/\/[^\s\)]+/);
        if (urlMatch) {
          imageUrl = urlMatch[0];
        }
      }

      if (!imageUrl) {
        throw new Error(`Failed to extract generated image URL from response: ${responseContent}`);
      }

      // Fetch the generated image and convert it to base64 dataUrl
      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) {
        throw new Error(`Failed to fetch generated image from proxy: ${imageUrl}`);
      }
      const arrayBuffer = await imageRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = imageRes.headers.get('content-type') || 'image/png';
      beautifiedDataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
    }

    return NextResponse.json({ image: beautifiedDataUrl });
  } catch (error: any) {
    console.error('AI Beautify route error:', error);
    return NextResponse.json({ 
      error: error.message || 'AI processing failed' 
    }, { status: 500 });
  }
}
