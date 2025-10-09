// app/components/AddNewBucketForm.tsx
'use client';

import { SubmitButton } from '@/components/submit-button'; // A separate component for the button
import { addNewBucket } from '@/service/bucket.config'; // Adjust path if needed
import { useActionState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

const initialState = {
  success: false,
  message: null,
  errors: null,
  id: null,
};

export function AddNewBucketForm() {
  const formRef = useRef<HTMLFormElement>(null);
  // @ts-ignore
  const [state, formAction] = useActionState(addNewBucket, initialState);

  useEffect(() => {
    if (state.message) {
      if (state.success) {
        toast.success(state.message);
        formRef.current?.reset(); // Reset form on success
      } else {
        toast.error(state.message);
      }
    }
  }, [state]);

  return (
    <div className="max-w-2xl mx-auto p-6  rounded-lg shadow-md ">
      <h2 className="text-2xl font-semibold mb-6">
        Add New S3 Bucket
      </h2>
      <form ref={formRef} action={formAction} className="space-y-6">
        {/* Bucket Name and Provider */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Bucket Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="p-1 block w-full rounded-md outline-none ring-none  shadow-sm"
            />
            {state.errors?.name && <p className="mt-1 text-sm text-red-500">{state.errors.name[0]}</p>}
          </div>
          <div>
            <label htmlFor="provider" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Provider (e.g., AWS, Cloudflare)
            </label>
            <input
              type="text"
              id="provider"
              name="provider"
              required
              className="p-1 block w-full rounded-md outline-none ring-none  shadow-sm"
            />
            {state.errors?.provider && <p className="mt-1 text-sm text-red-500">{state.errors.provider[0]}</p>}
          </div>
        </div>

        {/* Endpoint and Region */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="endpoint" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Endpoint URL
            </label>
            <input
              type="url"
              id="endpoint"
              name="endpoint"
              placeholder="https://s3.tebi.io"
              required
              className="p-1 block w-full rounded-md outline-none ring-none  shadow-sm"
            />
             {state.errors?.endpoint && <p className="mt-1 text-sm text-red-500">{state.errors.endpoint[0]}</p>}
          </div>
          <div>
            <label htmlFor="region" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Region
            </label>
            <input
              type="text"
              id="region"
              name="region"
              placeholder="auto"
              required
              className="p-1 block w-full rounded-md outline-none ring-none  shadow-sm"
            />
            {state.errors?.region && <p className="mt-1 text-sm text-red-500">{state.errors.region[0]}</p>}
          </div>
        </div>

        {/* Capacity */}
        <div>
            <label htmlFor="total_capacity_gb" className="block text-sm font-medium">
              Total Capacity (GB)
            </label>
            <input
              type="number"
              id="total_capacity_gb"
              name="total_capacity_gb"
              required
              min="1"
              defaultValue='25'
              className="p-1 block w-full rounded-md outline-none ring-none  shadow-sm"
            />
            {state.errors?.total_capacity_gb && <p className="mt-1 text-sm text-red-500">{state.errors.total_capacity_gb[0]}</p>}
        </div>

        {/* Access and Secret Keys */}
        <div className="space-y-6 rounded-md">
          <div>
            <label htmlFor="accessKey" className="block text-sm font-medium">
              Access Key ID
            </label>
            <input
              type="password"
              id="accessKey"
              name="accessKey"
              required
              // autoComplete="new-password"
              className="p-1 block w-full rounded-md outline-none ring-none  shadow-sm"
            />
            {state.errors?.accessKey && <p className="mt-1 text-sm text-red-500">{state.errors.accessKey[0]}</p>}
          </div>
          <div>
            <label htmlFor="secretKey" className="block text-sm font-medium">
              Secret Access Key
            </label>
            <input
              type="password"
              id="secretKey"
              name="secretKey"
              required
              // autoComplete="new-password"
              className="p-1 block w-full rounded-md outline-none ring-none  shadow-sm"
            />
            {state.errors?.secretKey && <p className="mt-1 text-sm text-red-500">{state.errors.secretKey[0]}</p>}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
