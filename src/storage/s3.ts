import "server-only";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { StorageAdapter } from "./types";

type S3StorageConfig = {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle?: boolean;
};

let cachedClient: { client: S3Client; bucket: string } | undefined;

export function createS3StorageAdapter(): StorageAdapter {
  return {
    provider: "s3",
    async put(input) {
      const { client, bucket } = getClient();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: input.storageKey,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
    },
    async get(storageKey) {
      const { client, bucket } = getClient();
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
      if (!response.Body) {
        throw new Error("Storage object body is empty.");
      }

      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(Buffer.from(chunk));
      }

      return { body: Buffer.concat(chunks), contentType: response.ContentType };
    },
    async delete(storageKey) {
      const { client, bucket } = getClient();
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
    },
  };
}

function getClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getS3StorageConfig();
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
  });
  cachedClient = { client, bucket: config.bucket };
  return cachedClient;
}

function getS3StorageConfig(): S3StorageConfig {
  return {
    bucket: requiredEnv("OUNWAN_S3_BUCKET"),
    region: requiredEnv("OUNWAN_S3_REGION"),
    endpoint: optionalEnv("OUNWAN_S3_ENDPOINT"),
    forcePathStyle: optionalEnv("OUNWAN_S3_FORCE_PATH_STYLE") === "true",
  };
}

function requiredEnv(key: string) {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function optionalEnv(key: string) {
  const value = process.env[key]?.trim();
  return value || undefined;
}