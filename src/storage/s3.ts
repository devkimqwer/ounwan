import { DeleteObjectCommand, GetBucketVersioningCommand, GetObjectCommand, HeadObjectCommand, ListObjectVersionsCommand, paginateListObjectsV2, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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
    async *list() {
      const { client, bucket } = getClient();
      const versioning = await client.send(new GetBucketVersioningCommand({ Bucket: bucket }));
      if (versioning.Status) {
        // 버전 관리 버킷은 삭제 마커만 생성하지 않고 실제 파일 버전을 삭제한다.
        let keyMarker: string | undefined;
        let versionIdMarker: string | undefined;
        while (true) {
          const page = await client.send(new ListObjectVersionsCommand({ Bucket: bucket, KeyMarker: keyMarker, VersionIdMarker: versionIdMarker }));
          for (const object of page.Versions ?? []) {
            if (!object.Key || !object.LastModified || object.Size === undefined || !object.VersionId) {
              throw new Error("Incomplete storage object version metadata.");
            }
            yield { storageKey: object.Key, lastModified: object.LastModified, size: object.Size, etag: object.ETag, versionId: object.VersionId };
          }
          if (!page.IsTruncated) {
            break;
          }
          if (!page.NextKeyMarker || (page.NextKeyMarker === keyMarker && page.NextVersionIdMarker === versionIdMarker)) {
            throw new Error("Invalid storage object version pagination.");
          }
          keyMarker = page.NextKeyMarker;
          versionIdMarker = page.NextVersionIdMarker;
        }
      } else {
        for await (const page of paginateListObjectsV2({ client }, { Bucket: bucket })) {
          for (const object of page.Contents ?? []) {
            if (!object.Key || !object.LastModified || object.Size === undefined) {
              throw new Error("Incomplete storage object metadata.");
            }
            yield { storageKey: object.Key, lastModified: object.LastModified, size: object.Size, etag: object.ETag };
          }
        }
      }
    },
    async deleteIfUnchanged(object) {
      const { client, bucket } = getClient();
      try {
        const current = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: object.storageKey, VersionId: object.versionId }));
        if (!object.etag || current.ETag !== object.etag || current.ContentLength !== object.size
          || current.LastModified?.getTime() !== object.lastModified.getTime()) {
          return false;
        }
        await client.send(new DeleteObjectCommand({
          Bucket: bucket,
          Key: object.storageKey,
          VersionId: object.versionId,
          // 고유 버전은 불변이다. 덮어쓸 수 있는 객체만 ETag 조건을 추가한다.
          IfMatch: object.versionId && object.versionId !== "null" ? undefined : object.etag,
        }));
        return true;
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 404 || status === 412) {
          return false;
        }
        throw error;
      }
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
