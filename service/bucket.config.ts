'use server'
import { decryptSecret, encryptSecret } from "@/lib/helpers/jose"
import { encryptTokenV4 } from "@/lib/helpers/paseto-ts"
import { revalidatePath } from "next/cache"
import { cache } from "react"
import { z } from "zod"
import { query } from "./postgres"
import { getS3StorageUsage, verifyBucketConnection } from "./s3"
export interface BucketConfig {
  name: string
  accessKey: string
  secretKey: string
  region: string
  endpoint: string
  id: number
  totalCapacityGB?: number
  storageUsedBytes?: number
  private?: boolean
  cdnUrl?: string
  provider?: string
}


/**
 * Fetches a SINGLE bucket configuration from the database.
 * This function is the one we will wrap with `cache`.
 * It's intentionally not exported, as it's an internal implementation detail.
 */
const getSingleBucketConfigFromDb = async (bucketId: number): Promise<BucketConfig | null> => {
  const { rows } = await query("SELECT * FROM s3_buckets WHERE id = $1 LIMIT 1", [bucketId]);

  if (rows.length === 0) {
    return null;
  }

  const bucket = rows[0];
  // Simple mapping logic (ensure this matches your schema)
  return {
    id: bucket.id,
    name: bucket.name,
    accessKey: bucket.access_key_encrypted,
    secretKey: bucket.secret_key_encrypted,
    region: bucket.region,
    endpoint: bucket.endpoint,
    totalCapacityGB: bucket.total_capacity_gb,
    storageUsedBytes: bucket.storage_used_bytes,
    private: bucket.is_private,
    provider: bucket.provider,
  };
};

// 2. Create the cached version of the function
// Any calls to this function with the same `bucketId` within the same server request
// will be de-duplicated.
const getCachedBucketConfig = cache(getSingleBucketConfigFromDb);

/**
 * This is the primary function you will call from your server code.
 * It intelligently fetches multiple bucket configurations using the cached function.
 */
export async function getBucketConfig(bucketIds: number | number[]): Promise<BucketConfig[]> {
  try {
    const ids = Array.isArray(bucketIds) ? bucketIds : [bucketIds];
    const uniqueIds = [...new Set(ids)]; // Ensure we don't process duplicate IDs

    if (uniqueIds.length === 0) {
      return [];
    }

    // 3. Use Promise.all to fetch all configs in parallel.
    // React's `cache` will ensure that if getCachedBucketConfig(1) is called multiple
    // times across these promises, the database is only hit once for ID 1.
    const configPromises = uniqueIds.map(id => getCachedBucketConfig(id));

    const results = await Promise.all(configPromises);

    // Filter out any null results for IDs that were not found
    return results.filter((config: any): config is BucketConfig => config !== null)
  } catch(error){
    console.error(error)
    return []
  }
}


export async function encryptBucketConfig(bucketId: number){
  try {
    const config = await getBucketConfig(bucketId)
    const payload = {
      name: config[0].name,
      accessKey: await decryptSecret(config[0].accessKey),
      secretKey: await decryptSecret(config[0].secretKey),
      region: config[0].region,
      endpoint: config[0].endpoint,
      // availableCapacity: config[0]?.storageUsedBytes || 20,
      // private: config[0]?.private || true,
      // cdnUrl: config[0]?.cdnUrl || '',
      // provider: config[0]?.provider || 'synology'
    }
    const token = await encryptTokenV4(payload) as string;
    return token;
  } catch(error: any){
    console.error(error)
    throw new Error(error)
  }
}

export async function refreshBucketUsage(bucketIds: number[]){
  try {
    let bucketsToRefresh: { id: number }[];
    if (bucketIds && bucketIds.length > 0) {
      const { rows } = await query("SELECT id FROM s3_buckets WHERE id = ANY($1::int[])", [bucketIds]);
      bucketsToRefresh = rows;
    } else {
      bucketsToRefresh = [];
    }
    if (bucketsToRefresh.length === 0) {
      throw new Error("No matching buckets found to refresh.");
    }

    const bucketIdsToProcess = bucketsToRefresh.map(b => b.id);

    // Call your existing async function to get the latest usage stats
    const usageStats = await getS3StorageUsage(bucketIdsToProcess);

    // Prepare and execute database updates
    const updatePromises = usageStats
      // THIS IS THE FIX: Filter the array to only include success objects.
      .filter(stat => stat.status === "Success")
      .map(stat => {
        return query(
          "UPDATE s3_buckets SET storage_used_bytes = $1, updated_at = NOW() WHERE id = $2",
          [stat.storageUsedBytes, stat.bucket]
        );
      });

    await Promise.all(updatePromises);
    return { success: true, refreshed: updatePromises.length }
  } catch(error: any){
    throw new Error(error)
  }
}


// Define a schema for validation
const bucketSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters.'),
  region: z.string().min(1, 'Region is required.'),
  endpoint: z.url('Must be a valid URL.'),
  provider: z.string().min(1, 'Provider is required.'),
  total_capacity_gb: z.coerce.number().positive('Capacity must be a positive number.'),
  accessKey: z.string().min(1, 'Access Key is required.'),
  secretKey: z.string().min(1, 'Secret Key is required.'),
});

export async function addNewBucket(
  prevState: any,
  formData: FormData
) {
  try {
    const validatedFields = bucketSchema.safeParse(Object.fromEntries(formData.entries()));

    // Return validation errors if any
    if (!validatedFields.success) {
      return {
        success: false,
        message: "Validation failed. Please check the fields.",
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    const {
      name,
      region,
      endpoint,
      provider,
      total_capacity_gb,
      accessKey,
      secretKey
    } = validatedFields.data;

    // Encrypt credentials before verification and storage
    const access_key_encrypted = await encryptSecret(accessKey);
    const secret_key_encrypted = await encryptSecret(secretKey);

    const validConnection = await verifyBucketConnection({
      id: 0, // Temporary ID for verification
      name,
      region,
      endpoint,
      provider,
      accessKey: access_key_encrypted,
      secretKey: secret_key_encrypted,
    });

    if (!validConnection) {
      return {
        success: false,
        message: 'Connection failed. Please check your credentials and endpoint.'
      };
    }

    const { rows } = await query(
      `INSERT INTO s3_buckets (name, region, endpoint, provider, total_capacity_gb, access_key_encrypted, secret_key_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [name, region, endpoint, provider, total_capacity_gb, access_key_encrypted, secret_key_encrypted]
    );

    revalidatePath('/dashboard/buckets'); // Example path to revalidate

    return {
      success: true,
      message: `Bucket "${name}" added successfully!`,
      id: rows[0]?.id
    };

  } catch (error: any) {
    console.error("Error adding bucket:", error);
    return {
      success: false,
      message: error.message || 'An unexpected server error occurred.'
    };
  }
}
