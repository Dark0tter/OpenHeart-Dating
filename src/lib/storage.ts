import { promises as fs } from "fs";
import path from "path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Private file storage. Uses any S3-compatible bucket (DigitalOcean Spaces,
 * Cloudflare R2, AWS S3) when S3_BUCKET is set; otherwise a local folder,
 * which is fine for development but is wiped on every App Platform deploy.
 * Objects are never public: they're only read back through our own routes.
 */

const LOCAL_DIR = path.join(process.cwd(), ".uploads");

let client: S3Client | null = null;

function s3(): S3Client | null {
  if (!process.env.S3_BUCKET) return null;
  client ??= new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: process.env.S3_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET ?? "",
    },
  });
  return client;
}

function localPath(key: string) {
  const safe = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(LOCAL_DIR, safe);
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const c = s3();
  if (c) {
    await c.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: "private",
      }),
    );
    return;
  }
  const file = localPath(key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body);
}

export async function getObject(key: string): Promise<Buffer | null> {
  const c = s3();
  try {
    if (c) {
      const res = await c.send(
        new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
      );
      if (!res.Body) return null;
      return Buffer.from(await res.Body.transformToByteArray());
    }
    return await fs.readFile(localPath(key));
  } catch {
    return null;
  }
}

export async function deleteObject(key: string | null | undefined) {
  if (!key) return;
  const c = s3();
  try {
    if (c) {
      await c.send(
        new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
      );
      return;
    }
    await fs.unlink(localPath(key));
  } catch {
    // Already gone.
  }
}
