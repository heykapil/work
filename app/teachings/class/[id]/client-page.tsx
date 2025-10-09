'use client'

import { Session } from '@/lib/auth';
import { signJWT } from '@/lib/helpers/jose';
import { addLecture, deleteLecture, updateCourseInfo, updateLecture } from '@/service/actions';
import { Button, Input } from '@headlessui/react';
import { CrossIcon, Edit2Icon } from 'lucide-react';
import { ChangeEvent, useActionState, useEffect, useRef, useState } from 'react';

// Types (same as before)
type ScheduleItem = {
    schedule_id: number;
    course_id: string;
    lecture_number: number | null;
    event_date: string;
    topic: string;
    hw_link: string | null;
    hw_text: string | null;
    lecture_pdf: string | null;
    lecture_html: string | null;
};

type Course = {
    id: string;
    title: string;
    instructor: string;
    email: string | null;
    office: string | null;
    class_info: string | null;
    timetable_link: string | null;
    textbook_title: string | null;
    textbook_link: string | null;
    textbook_solutions_link: string | null;
    topics: string[] | null;
    last_modified: string;
    schedule: ScheduleItem[] | null;
};

interface CourseClientComponentProps {
    course: Course;
}


// --- NEW FileUploadInput Component with Presigned URL Logic ---

// --- Configuration ---
// It's best practice to use a Next.js API route as a proxy to avoid exposing your worker URL.
// For simplicity here, we call the worker directly.
const BUCKET_ID = 1; // Assuming a static bucket ID for now. You could make this a prop.
const WORKER_BASE_URL = 'https://worker-api.kapil.app'; // Replace with your actual worker URL
const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50 MB
const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks for multipart

interface FileUploadInputProps {
  name: string;
  label: string;
  defaultValue?: string | null;
  labelClassName?: string;
}

function FileUploadInput({ name, label, defaultValue, labelClassName = 'text-sm' }: FileUploadInputProps) {
  const [url, setUrl] = useState<string | null>(defaultValue || null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      if (file.size < MULTIPART_THRESHOLD) {
        await handleSinglePartUpload(file);
      } else {
        await handleMultipartUpload(file);
      }
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred during upload.');
      setUrl(defaultValue || null); // Reset to original URL on failure
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSinglePartUpload = async (file: File) => {
    // 1. Get presigned URL from your worker
    const presignResponse = await fetch(`${WORKER_BASE_URL}/files/presign?bucketId=${BUCKET_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json','x-access-token': await signJWT({"hello": "world"}) },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
    });
    if (!presignResponse.ok) throw new Error('Could not get an upload URL.');
    const { uploadUrl, fileId, key, finalUrl } = await presignResponse.json();

    // 2. Upload the file directly to the storage provider
    const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
    });
    if (!uploadResponse.ok) throw new Error('File upload to storage failed.');
    setProgress(100);

    // 3. Notify your worker that the upload is complete
    const completeResponse = await fetch(`${WORKER_BASE_URL}/files/complete?bucketId=${BUCKET_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json','x-access-token': await signJWT({"hello": "world"}) },
        body: JSON.stringify({
            fileId,
            key,
            fileName: file.name,
            sizeBytes: file.size,
            contentType: file.type,
        }),
    });
    if (!completeResponse.ok) throw new Error('Failed to finalize upload record.');

    setUrl(finalUrl);
  };

  const handleMultipartUpload = async (file: File) => {
    // 1. Initiate multipart upload with your worker
    const initiateResponse = await fetch(`${WORKER_BASE_URL}/files/multipart/initiate?bucketId=${BUCKET_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json','x-access-token': await signJWT({"hello": "world"}) },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
    });
    if (!initiateResponse.ok) throw new Error('Could not initiate multipart upload.');
    const { fileId, key, uploadId } = await initiateResponse.json();

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadedParts: { PartNumber: number; ETag: string }[] = [];

    for (let i = 0; i < totalChunks; i++) {
        const partNumber = i + 1;
        const start = i * CHUNK_SIZE;
        const end = start + CHUNK_SIZE;
        const chunk = file.slice(start, end);

        // 2. Get a presigned URL for the specific chunk
        const presignPartResponse = await fetch(`${WORKER_BASE_URL}/files/multipart/presign?bucketId=${BUCKET_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json','x-access-token': await signJWT({"hello": "world"}) },
            body: JSON.stringify({ key, uploadId, partNumber }),
        });
        if (!presignPartResponse.ok) throw new Error(`Could not get URL for part #${partNumber}.`);
        const { uploadUrl } = await presignPartResponse.json();

        // 3. Upload the chunk directly to storage
        const uploadPartResponse = await fetch(uploadUrl, { method: 'PUT', body: chunk });
        if (!uploadPartResponse.ok) throw new Error(`Upload failed for part #${partNumber}.`);

        const etag = uploadPartResponse.headers.get('ETag');
        if (!etag) throw new Error(`ETag not found for part #${partNumber}.`);

        uploadedParts.push({ PartNumber: partNumber, ETag: etag.replace(/"/g, '') });
        setProgress(Math.round((partNumber / totalChunks) * 100));
    }

    // 4. Finalize the multipart upload with your worker
    const completeResponse = await fetch(`${WORKER_BASE_URL}/files/multipart/complete?bucketId=${BUCKET_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json','x-access-token': await signJWT({"hello": "world"}) },
        body: JSON.stringify({ fileId, key, uploadId, parts: uploadedParts, sizeBytes: file.size }),
    });
    if (!completeResponse.ok) throw new Error('Failed to finalize multipart upload.');

    const { finalUrl } = await completeResponse.json();
    setUrl(finalUrl);
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  return (
    <div>
      <label className={`block font-medium text-gray-700 ${labelClassName}`}>{label}</label>
      <input type="hidden" name={name} value={url || ''} />
      <div className="mt-1 flex items-center space-x-2">
        {url ? (
            <div className="flex-grow flex items-center justify-between p-2 border border-gray-300 rounded-md bg-gray-50 text-sm">
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate" title={url}>
                    Preview File
                </a>
            </div>
        ) : (
          <div className="flex-grow p-2 border border-dashed border-gray-300 rounded-md text-center text-sm text-gray-500">
            No file uploaded
          </div>
        )}
        <Button
            type="button"
            onClick={triggerFileInput}
            disabled={uploading}
            className="px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          {uploading ? `Uploading...` : (url ? 'Change' : 'Upload')}
        </Button>
      </div>
      {uploading && (
        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 dark:bg-gray-700">
          <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        disabled={uploading}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}


export default function CourseClientComponent({ course, session }: {course: Course, session: Session }) {
    const isAdmin = process.env.NODE_ENV === 'development' ? true : session?.user?.username === 'admin';
    const [editingCourse, setEditingCourse] = useState(false);
    const [editingLecture, setEditingLecture] = useState<number | null>(null);
    const [addingLecture, setAddingLecture] = useState(false);
    // @ts-ignore
    const [courseState, courseAction, coursePending] = useActionState(
        updateCourseInfo.bind(null, course.id),
        { success: false, message: '', errors: {} }
    );
    // @ts-ignore
    const [addLectureState, addLectureAction, addLecturePending] = useActionState(
        addLecture.bind(null, course.id),
        { success: false, message: '', errors: {} }
    );

    useEffect(() => {
        if (courseState.success) setEditingCourse(false);
        if (addLectureState.success) setAddingLecture(false);
    }, [courseState.success, addLectureState.success]);

    if (!course) {
        return (
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                <h2 className="animate-fade-left">Course Not Found</h2>
                <p className='animate-fade-up'>Sorry, the course you are looking for does not exist.</p>
            </main>
        );
    }

    return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <h2 className="text-3xl font-bold text-gray-900">{course.title}</h2>

        <div className='mt-6 flex flex-row justify-between w-full'>
            <h3 className="flex text-xl font-semibold text-gray-800">Basic Information</h3>
            {isAdmin && (
                <Button onClick={() => setEditingCourse(!editingCourse)} className='text-blue-600'>
                    {editingCourse ? <span className='flex flex-row items-centre text-red-500 '><CrossIcon className='rotate-45 mr-2'/>Cancel Edit </span> : <span className='flex flex-row items-centre'><Edit2Icon className="w-5 h-5 mr-2 mt-0.5"/> Edit info</span>}
                </Button>
            )}
        </div>
        {editingCourse ? (
            <form action={courseAction} className="space-y-4 bg-gray-50 p-4 rounded-lg">
                {(courseState.message && !courseState.success) && <div className="text-red-600 text-sm">{courseState.message}</div>}
                {courseState.success && <div className="text-green-600 text-sm">{courseState.message}</div>}

                <Input name='title' defaultValue={course.title || ''} className="hidden" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Class Info</label>
                        <Input name="class_info" defaultValue={course.class_info || ''} className="p-1 block w-full rounded-md outline-none ring-none shadow-sm" />
                        {courseState.errors?.class_info && <div className="text-red-500 text-sm">{courseState.errors.class_info}</div>}
                    </div>

                    <FileUploadInput name="timetable_link" label="Timetable Link" defaultValue={course.timetable_link} />

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Instructor</label>
                        <Input name="instructor" defaultValue={course.instructor} className="p-1 block w-full rounded-md outline-none ring-none shadow-sm" />
                        {courseState.errors?.instructor && <div className="text-red-500 text-sm">{courseState.errors.instructor}</div>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <Input name="email" type="email" defaultValue={course.email || ''} className="p-1 block w-full rounded-md outline-none ring-none shadow-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Office</label>
                        <Input name="office" defaultValue={course.office || ''} className="p-1 block w-full rounded-md outline-none ring-none shadow-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Textbook Title</label>
                        <Input name="textbook_title" defaultValue={course.textbook_title || ''} className="p-1 block w-full rounded-md outline-none ring-none shadow-sm" />
                    </div>

                    <FileUploadInput name="textbook_link" label="Textbook Link" defaultValue={course.textbook_link} />
                    <FileUploadInput name="textbook_solutions_link" label="Solutions Link" defaultValue={course.textbook_solutions_link} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Topics (comma-separated)</label>
                    <textarea name="topics" defaultValue={course.topics?.join(', ') || ''} rows={3} className="p-1 block w-full rounded-md outline-none ring-none shadow-sm" />
                </div>
                <div className="flex gap-2">
                    <Button type="submit" disabled={coursePending} className="rounded-full border border-solid border-black/[.08] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] hover:border-transparent font-medium text-sm sm:text-base h-8 sm:h-10 px-3 sm:px-4 w-full sm:w-auto md:w-[128px] disabled:opacity-50">
                        {coursePending ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button onClick={() => setEditingCourse(false)} className="rounded-full border border-solid border-black/[.08] transition-colors flex items-center justify-center hover:bg-red-100 hover:border-transparent font-medium text-sm sm:text-base h-8 sm:h-10 px-3 sm:px-4 w-full sm:w-auto md:w-[128px] disabled:opacity-50">
                        Cancel
                    </Button>
                </div>
            </form>
        ) : (
            <>
                <div className="space-y-3">
                    <p><strong>Class:</strong> {course.class_info} <a href={course.timetable_link || '#'} className="text-blue-600 hover:underline">Timetable</a></p>
                    <p><strong>Instructor:</strong> {course.instructor}</p>
                    <p><strong>Email:</strong> <a href={`mailto:${course.email}`} className="text-blue-600 hover:underline">{course.email}</a></p>
                    <p><strong>Office:</strong> {course.office}</p>
                    <p><strong>Textbook:</strong> <em>{course.textbook_title}</em>.{' '}
                        <a href={course.textbook_link || '#'} target="_blank" className="text-blue-600 hover:underline">Link</a>,{' '}
                        <a href={course.textbook_solutions_link || '#'} target="_blank" className="text-blue-600 hover:underline">Solutions</a>
                    </p>
                </div>
                <h3 className="mt-6 text-xl font-semibold text-gray-800">Topics to be Covered</h3>
                <ul className="space-y-2">
                    {course.topics?.map((topic, index) => <li key={index}><span dangerouslySetInnerHTML={{ __html: topic }} /></li>)}
                </ul>
            </>
        )}

        {/* Add Lecture Form */}
        {isAdmin && addingLecture && (
            <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                <h4 className="text-lg font-semibold mb-4">Add New Lecture</h4>
                <form action={addLectureAction} className="space-y-4">
                    {addLectureState.message && !addLectureState.success && <div className="text-red-600 text-sm">{addLectureState.message}</div>}
                    {addLectureState.success && <div className="text-green-600 text-sm">{addLectureState.message}</div>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Lecture Number</label>
                            <Input name="lecture_number" type="number" className="p-1 block w-full rounded-md outline-none ring-none shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Date</label>
                            <Input name="event_date" type="date" required className="p-1 block w-full rounded-md outline-none ring-none shadow-sm" />
                            {addLectureState.errors?.event_date && <div className="text-red-500 text-sm">{addLectureState.errors.event_date}</div>}
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Topic</label>
                            <Input name="topic" required className="p-1 block w-full rounded-md outline-none ring-none shadow-sm" />
                            {addLectureState.errors?.topic && <div className="text-red-500 text-sm">{addLectureState.errors.topic}</div>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">HW Text</label>
                            <Input name="hw_text" className="p-1 block w-full rounded-md outline-none ring-none shadow-sm" />
                        </div>
                        <FileUploadInput name="hw_link" label="HW Link" />
                        <FileUploadInput name="lecture_pdf" label="Lecture PDF" />
                        <FileUploadInput name="lecture_html" label="Lecture HTML" />
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit" disabled={addLecturePending} className="rounded-full border border-solid border-black/[.08] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] hover:border-transparent font-medium text-sm sm:text-base h-8 sm:h-10 px-3 sm:px-4 w-full sm:w-auto md:w-[128px] disabled:opacity-50">
                            {addLecturePending ? 'Adding...' : 'Add Lecture'}
                        </Button>
                        <Button onClick={() => setAddingLecture(false)} className="rounded-full border border-solid border-black/[.08] transition-colors flex items-center justify-center hover:bg-red-100 hover:border-transparent font-medium text-sm sm:text-base h-8 sm:h-10 px-3 sm:px-4 w-full sm:w-auto md:w-[128px] disabled:opacity-50">
                            Cancel
                        </Button>
                    </div>
                </form>
            </div>
        )}

        {/* Schedule Table */}
        <h3 className="mt-6 text-xl font-semibold text-gray-800">Tentative Schedule</h3>
        <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-2 text-left">#</th>
                        <th className="border border-gray-300 p-2 text-left">Date</th>
                        <th className="border border-gray-300 p-2 text-left">Topic</th>
                        <th className="border border-gray-300 p-2 text-left">HW/Practical</th>
                        <th className="border border-gray-300 p-2 text-left">Lecture</th>
                        {isAdmin && <th className="border border-gray-300 p-2 text-left"><Button onClick={() => setAddingLecture(!addingLecture)}>{addingLecture ? 'Cancel' : 'Add'}</Button></th>}
                    </tr>
                </thead>
                <tbody>
                    {course.schedule?.map((item) => (
                        <LectureRow key={item.schedule_id} item={item} courseId={course.id} isAdmin={isAdmin} isEditing={editingLecture === item.schedule_id} onEdit={() => setEditingLecture(item.schedule_id)} onCancelEdit={() => setEditingLecture(null)} />
                    ))}
                </tbody>
            </table>
        </div>
        <hr className="mt-8 border-t border-dotted border-gray-400" />
        <p className="mt-4 text-sm text-gray-600"><i>Last modified: {new Date(course.last_modified).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })} IST</i></p>
    </main>
    );
}

// Individual Lecture Row Component
function LectureRow({ item, courseId, isAdmin, isEditing, onEdit, onCancelEdit }: { item: ScheduleItem; courseId: string; isAdmin: boolean; isEditing: boolean; onEdit: () => void; onCancelEdit: () => void; }) {
  // @ts-ignore
  const [updateState, updateAction, updatePending] = useActionState(updateLecture.bind(null, item.schedule_id, courseId), { success: false, message: '', errors: {} });
    const [deleteState, deleteAction, deletePending] = useActionState(deleteLecture.bind(null, item.schedule_id, courseId), { success: false, message: '' });

    if (isEditing) {
        return (
            <tr className="bg-blue-50">
                <td className="border border-gray-300 p-2" colSpan={isAdmin ? 6 : 5}>
                    <form action={updateAction} className="space-y-3">
                        {updateState.message && !updateState.success && <div className="text-red-600 text-sm">{updateState.message}</div>}
                        {updateState.success && <div className="text-green-600 text-sm">{updateState.message}</div>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className='md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-3'>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">Lecture #</label>
                                    <Input name="lecture_number" type="number" defaultValue={item.lecture_number || ''} className="p-1 block w-full rounded-md outline-none ring-none shadow-sm text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">Date</label>
                                    <Input name="event_date" type="date" defaultValue={item.event_date} required className="p-1 block w-full rounded-md outline-none ring-none shadow-sm text-sm" />
                                    {updateState.errors?.event_date && <div className="text-red-500 text-xs">{updateState.errors.event_date}</div>}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">HW Text</label>
                                    <Input name="hw_text" defaultValue={item.hw_text || ''} className="p-1 block w-full rounded-md outline-none ring-none shadow-sm text-sm" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700">Topic</label>
                                    <Input name="topic" defaultValue={item.topic} required className="p-1 block w-full rounded-md outline-none ring-none shadow-sm text-sm" />
                                    {updateState.errors?.topic && <div className="text-red-500 text-xs">{updateState.errors.topic}</div>}
                                </div>
                            </div>
                            <FileUploadInput name="hw_link" label="HW Link" defaultValue={item.hw_link} labelClassName="text-xs" />
                            <FileUploadInput name="lecture_pdf" label="PDF URL" defaultValue={item.lecture_pdf} labelClassName="text-xs" />
                            <FileUploadInput name="lecture_html" label="HTML URL" defaultValue={item.lecture_html} labelClassName="text-xs" />
                        </div>
                        <div className="flex gap-2 items-center">
                            <Button type="submit" disabled={updatePending} className="px-3 py-1 rounded border hover:bg-green-100 disabled:opacity-50 text-sm">
                                {updatePending ? 'Saving...' : 'Save'}
                            </Button>
                            <Button onClick={onCancelEdit} className="px-3 py-1 rounded border hover:bg-gray-100 disabled:opacity-50 text-sm">
                                Cancel
                            </Button>
                            <form action={deleteAction} className='ml-auto'>
                                <Button type="submit" disabled={deletePending} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm"
                                    onClick={(e) => { if (!confirm('Are you sure you want to delete this lecture?')) e.preventDefault(); }}>
                                    {deletePending ? 'Deleting...' : 'Delete'}
                                </Button>
                            </form>
                        </div>
                    </form>
                </td>
            </tr>
        );
    }

    return (
        <tr>
            <td className="border border-gray-300 p-2">{item.lecture_number}</td>
            <td className="border border-gray-300 p-2">{new Date(item.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</td>
            <td className="border border-gray-300 p-2">{item.topic}</td>
            <td className="border border-gray-300 p-2">{item.hw_link && <a href={item.hw_link} className="text-blue-600 hover:underline">{item.hw_text || 'Link'}</a>}</td>
            <td className="border border-gray-300 p-2">
                {item.lecture_pdf && <a href={item.lecture_pdf} className="text-blue-600 hover:underline">pdf</a>}
                {item.lecture_pdf && item.lecture_html && ' , '}
                {item.lecture_html && <a href={item.lecture_html} target="_blank" className="text-blue-600 hover:underline">html</a>}
            </td>
            {isAdmin && (
                <td className="border border-gray-300 p-2">
                    <Button onClick={onEdit} className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">Edit</Button>
                </td>
            )}
        </tr>
    );
}
