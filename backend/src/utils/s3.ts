import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const bucket = process.env.AWS_S3_BUCKET!;

export interface S3Metadata {
  size: number;
  lastModified: Date;
  etag: string;
}

export async function getS3ObjectMetadata(key: string): Promise<S3Metadata> {
  const command = new HeadObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3Client.send(command);
  
  return {
    size: response.ContentLength!,
    lastModified: response.LastModified!,
    etag: response.ETag!
  };
}

export async function getS3ObjectStream(key: string, range?: { start: number; end: number }): Promise<Readable> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    Range: range ? `bytes=${range.start}-${range.end}` : undefined
  });
  
  const response = await s3Client.send(command);
  return response.Body as Readable;
}

export async function getS3ObjectBuffer(key: string, range?: { start: number; end: number }): Promise<Buffer> {
  const stream = await getS3ObjectStream(key, range);
  const chunks: Buffer[] = [];
  
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

