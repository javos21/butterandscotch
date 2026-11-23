import type { NextConfig } from "next";

const STORAGE_PATH = "/storage/v1/object/public/**";

type RemotePattern = {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathname: string;
};

/** Image hosts: the placeholder service for seed images, and this project's Supabase storage. */
function imageRemotePatterns(): RemotePattern[] {
  const patterns: RemotePattern[] = [
    { protocol: "https", hostname: "placehold.co", pathname: "/**" },
  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const { protocol, hostname, port } = new URL(supabaseUrl);
    patterns.push({
      protocol: protocol === "https:" ? "https" : "http",
      hostname,
      ...(port ? { port } : {}),
      pathname: STORAGE_PATH,
    });
  }

  return patterns;
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: imageRemotePatterns(),
    // 90 for product photos, where softness shows; 75 (the default) everywhere else.
    qualities: [75, 90],
    // Local Supabase storage is on 127.0.0.1. Next blocks loopback image sources
    // unless this is set, so allow it outside production only.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
  experimental: {
    serverActions: {
      // Receipts are capped at 4 MB (lib/receipt-file.ts); the server action default is 1 MB.
      bodySizeLimit: "5mb",
    },
  },
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
