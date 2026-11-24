import "server-only";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createAdminSupabase } from "@/lib/supabase/admin";

/** Where menu photos live. `put` returns the public URL the storefront loads. */
export type PhotoStorage = {
  name: "r2" | "supabase";
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  /** Removes a photo this storage owns. Ignores URLs that belong elsewhere (seed placeholders, old hosts). */
  remove(publicUrl: string): Promise<void>;
};

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
};

function r2Config(env: NodeJS.ProcessEnv): R2Config | null {
  const config = {
    accountId: env.R2_ACCOUNT_ID ?? "",
    accessKeyId: env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
    bucket: env.R2_BUCKET ?? "",
    publicUrl: (env.R2_PUBLIC_URL ?? "").replace(/\/+$/, ""),
  };
  return Object.values(config).every((value) => value !== "") ? config : null;
}

/** Cloudflare R2 through its S3-compatible API. Objects are served from the bucket's public URL. */
function r2Storage(config: R2Config): PhotoStorage {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const prefix = `${config.publicUrl}/`;

  return {
    name: "r2",
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      return `${prefix}${key}`;
    },
    async remove(publicUrl) {
      if (!publicUrl.startsWith(prefix)) return;
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: publicUrl.slice(prefix.length) }));
    },
  };
}

const SUPABASE_BUCKET = "items";

/** Fallback for local development: the project's own public `items` storage bucket. */
function supabaseStorage(): PhotoStorage {
  const db = createAdminSupabase();
  const marker = `/storage/v1/object/public/${SUPABASE_BUCKET}/`;

  return {
    name: "supabase",
    async put(key, body, contentType) {
      const { error } = await db.storage
        .from(SUPABASE_BUCKET)
        .upload(key, body, { contentType, cacheControl: "31536000", upsert: false });
      if (error) throw new Error(error.message);
      return db.storage.from(SUPABASE_BUCKET).getPublicUrl(key).data.publicUrl;
    },
    async remove(publicUrl) {
      const index = publicUrl.indexOf(marker);
      if (index < 0) return;
      const { error } = await db.storage.from(SUPABASE_BUCKET).remove([publicUrl.slice(index + marker.length)]);
      if (error) throw new Error(error.message);
    },
  };
}

/** R2 when all five R2_* variables are set (production), otherwise Supabase storage (local dev). */
export function photoStorage(env: NodeJS.ProcessEnv = process.env): PhotoStorage {
  const config = r2Config(env);
  return config ? r2Storage(config) : supabaseStorage();
}
