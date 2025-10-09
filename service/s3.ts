'use server'

import { decryptSecret } from "@/lib/helpers/jose";
import { HeadBucketCommand, ListBucketsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { toast } from "sonner";
import { BucketConfig, getBucketConfig } from "./bucket.config";


export async function s3WithConfig(bucketConfig: BucketConfig) {
  try {
    const accessKeyId = await decryptSecret(bucketConfig.accessKey);
    const secretAccessKey = await decryptSecret(bucketConfig.secretKey);

    if (!accessKeyId || !secretAccessKey) {
        throw new Error("Decryption failed. One or both keys are null or empty. Check production environment variables.");
    }

    return new S3Client({
      region: bucketConfig.region || 'auto',
      endpoint: bucketConfig.endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
  } catch (error) {
    console.error("FATAL ERROR in s3WithConfig:", error);
    // Re-throw the error to be caught by the API route handler
    throw new Error(`Failed to create S3 client for bucket ${bucketConfig.name}. Please check server logs.`);
  }
}


export async function testS3Connection(bucketIds: number | number[]) {
  try {
    const configs = await getBucketConfig(bucketIds);

    if (configs.length === 0) {
      const ids = Array.isArray(bucketIds) ? bucketIds : [bucketIds];
      return ids.map(id => ({ bucket: id, name: 'N/A', status: 'Error', message: 'Bucket configuration not found.' }));
    }

    const results = await Promise.all(
      configs.map(async (config) => {
        try {
          const s3 = await s3WithConfig(config);
          await s3.send(new ListBucketsCommand({}));
          return { bucket: config.id, name: config.name, status: 'Success', message: 'Bucket is healthy!' };
        } catch (error: any) {
          return { bucket: config.id, name: config.name, status: 'Error', message: error.message }
        }
      })
    );

    return results
  } catch(error: any){
    console.log(error)
    throw new Error(error)
  }
}

const DEFAULT_MAX_BUCKET_CAPACITY_GB = 25; // 25GB limit

export async function getS3StorageUsage(bucketIds: number | number[]) {
  const configs = await getBucketConfig(bucketIds);

  if (configs.length === 0) {
    const ids = Array.isArray(bucketIds) ? bucketIds : [bucketIds];
    return ids.map(id => ({ bucket: id, name: 'N/A', status: 'Error', message: 'Bucket configuration not found.', storageUsedBytes: NaN }));
  }

  const usagePromises = configs.map(async (config) => {
    try {
      const s3 = await s3WithConfig(config);
      await s3.send(new HeadBucketCommand({ Bucket: config.name }));

      let totalSize = 0;
      let continuationToken: string | undefined = undefined;

      do {
        const response: any = await s3.send(
          new ListObjectsV2Command({
            Bucket: config.name,
            ContinuationToken: continuationToken,
          })
        );

        if (response.Contents) {
          totalSize += response.Contents.reduce((sum: number, obj: any) => sum + (obj.Size || 0), 0);
        }
        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      const totalAvailableSizeGB = config.totalCapacityGB || DEFAULT_MAX_BUCKET_CAPACITY_GB;
      const totalAvailableSizeBytes = totalAvailableSizeGB * 1024 * 1024 * 1024;
      const availableStorageBytes = Math.max(totalAvailableSizeBytes - totalSize, 0);
      const availableStorageGB = (availableStorageBytes / (1024 * 1024 * 1024)).toFixed(2);

      return {
        bucket: config.id,
        name: config.name,
        status: "Success",
        storageUsedBytes: totalSize,
        storageUsedMB: `${(totalSize / (1024 * 1024)).toFixed(2)} MB`,
        storageUsedGB: `${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`,
        availableCapacityGB: `${availableStorageGB} GB`,
      };
    } catch (error: any) {
      console.error(error)
      return {
        bucket: config.id,
        name: config.name,
        status: "Error",
        message: error.message,
        storageUsedBytes: NaN,
        storageUsedMB: NaN,
        storageUsedGB: NaN,
        availableCapacityGB: NaN,
      };
    }
  });

  return Promise.all(usagePromises);
}



export async function verifyBucketConnection(bucketConfig: BucketConfig): Promise<boolean> {
  const s3Client = await s3WithConfig(bucketConfig);
  try {
    await s3Client.send(
      new HeadBucketCommand({
        Bucket: bucketConfig.name,
      })
    );
    return true;
  } catch (error) {
    toast.error('Bucket connection verification failed:', { description: JSON.stringify(error)});
    return false;
  } finally {
    s3Client.destroy();
  }
}
