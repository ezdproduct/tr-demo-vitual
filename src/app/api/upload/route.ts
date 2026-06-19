import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json(); // image is base64 dataUrl: data:image/jpeg;base64,...
    if (!image) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Parse base64
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Detect content type
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    const contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const ext = contentType.split('/')[1] || 'jpg';

    // R2 config
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME || 'aib2c';

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      return NextResponse.json({ error: 'R2 configuration is missing on server' }, { status: 500 });
    }

    const s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const fileId = crypto.randomUUID();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const newFileName = `${year}${month}${day}_${fileId}.${ext}`;
    const key = `${year}/${month}/${day}/${newFileName}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const r2PublicUrl = process.env.R2_PUBLIC_URL || 'https://pub-b20d002a599c43358b1c4e92915e6687.r2.dev';
    const publicUrl = `${r2PublicUrl}/${key}`;

    return NextResponse.json({ publicUrl, key });
  } catch (error: any) {
    console.error('R2 upload route error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
