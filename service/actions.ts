// app/actions/course-actions.ts
'use server'

import { getSession } from '@/lib/auth';
import { query } from '@/service/postgres';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Verify admin privileges
async function verifyAdmin() {
  if (process.env.NODE_ENV === 'development') {
    return;
  } else {
    const session = await getSession();
    if (session?.user?.username !== 'admin') {
      throw new Error('Unauthorized: You are not authorized to perform this action.');
    }
  }
}

// Course Schema
const CourseSchema = z.object({
  title: z.string().min(1, { message: "Title is required." }),
  instructor: z.string().min(1, { message: "Instructor is required." }),
  email: z.email().optional().or(z.literal('')),
  office: z.string().optional(),
  class_info: z.string().optional(),
  timetable_link: z.url().optional().or(z.literal('')),
  textbook_title: z.string().optional(),
  textbook_link: z.url().optional().or(z.literal('')),
  textbook_solutions_link: z.url().optional().or(z.literal('')),
});

// Update Course Basic Information
export async function updateCourseInfo(courseId: string, prevState: any, formData: FormData) {
  await verifyAdmin();
  console.log(formData)

  const validatedFields = CourseSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Failed to update course. Please check the fields.',
    };
  }

  const { title, instructor, email, office, class_info, timetable_link, textbook_title, textbook_link, textbook_solutions_link } = validatedFields.data;

  // Handle topics array
  const topicsRaw = formData.get('topics') as string;
  const topics = topicsRaw ? topicsRaw.split(',').map(topic => topic.trim()).filter(topic => topic) : null;

  try {
    await query(
      `UPDATE courses
       SET title = $1, instructor = $2, email = $3, office = $4, class_info = $5,
           timetable_link = $6, textbook_title = $7, textbook_link = $8,
           textbook_solutions_link = $9, topics = $10, last_modified = NOW()
       WHERE id = $11`,
      [title, instructor, email, office, class_info, timetable_link, textbook_title,
       textbook_link, textbook_solutions_link, topics, courseId]
    );

    revalidatePath(`/teachings/class/${courseId}`);
    return { success: true, message: 'Course information updated successfully.' };
  } catch (error) {
    console.error('Database Error:', error);
    return { success: false, message: 'Database Error: Failed to update course.' };
  }
}

// Lecture Schema
const LectureSchema = z.object({
  lecture_number: z.coerce.number().optional().nullable(),
  event_date: z.string().min(1, { message: "Date is required." }),
  topic: z.string().min(1, { message: "Topic is required." }),
  hw_link: z.string().url().optional().or(z.literal('')),
  hw_text: z.string().optional(),
  lecture_pdf: z.string().url().optional().or(z.literal('')),
  lecture_html: z.string().url().optional().or(z.literal('')),
});

// Add Lecture
export async function addLecture(courseId: string, prevState: any, formData: FormData) {
  await verifyAdmin();

  const validatedFields = LectureSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Failed to add lecture. Please check the fields.',
    };
  }

  const { lecture_number, event_date, topic, hw_link, hw_text, lecture_pdf, lecture_html } = validatedFields.data;

  try {
    await query(
      `INSERT INTO course_schedule (course_id, lecture_number, event_date, topic, hw_link, hw_text, lecture_pdf, lecture_html)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [courseId, lecture_number, event_date, topic, hw_link, hw_text, lecture_pdf, lecture_html]
    );

    // Update course last_modified
    await query(`UPDATE courses SET last_modified = NOW() WHERE id = $1`, [courseId]);

    revalidatePath(`/teachings/class/${courseId}`);
    return { success: true, message: 'Lecture added successfully.' };
  } catch (error) {
    console.error('Database Error:', error);
    return { success: false, message: 'Database Error: Failed to add lecture.' };
  }
}

// Update Lecture
export async function updateLecture(lectureId: number, courseId: string, prevState: any, formData: FormData) {
  await verifyAdmin();

  const validatedFields = LectureSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Failed to update lecture. Please check the fields.',
    };
  }

  const { lecture_number, event_date, topic, hw_link, hw_text, lecture_pdf, lecture_html } = validatedFields.data;

  try {
    await query(
      `UPDATE course_schedule
       SET lecture_number = $1, event_date = $2, topic = $3, hw_link = $4,
           hw_text = $5, lecture_pdf = $6, lecture_html = $7
       WHERE schedule_id = $8 AND course_id = $9`,
      [lecture_number, event_date, topic, hw_link, hw_text, lecture_pdf, lecture_html, lectureId, courseId]
    );

    // Update course last_modified
    await query(`UPDATE courses SET last_modified = NOW() WHERE id = $1`, [courseId]);

    revalidatePath(`/teachings/class/${courseId}`);
    return { success: true, message: 'Lecture updated successfully.' };
  } catch (error) {
    console.error('Database Error:', error);
    return { success: false, message: 'Database Error: Failed to update lecture.' };
  }
}

// Delete Lecture
export async function deleteLecture(lectureId: number, courseId: string) {
  await verifyAdmin();

  try {
    await query(`DELETE FROM course_schedule WHERE schedule_id = $1 AND course_id = $2`, [lectureId, courseId]);

    // Update course last_modified
    await query(`UPDATE courses SET last_modified = NOW() WHERE id = $1`, [courseId]);

    revalidatePath(`/teachings/class/${courseId}`);
    return { success: true, message: 'Lecture deleted successfully.' };
  } catch (error) {
    console.error('Database Error:', error);
    return { success: false, message: 'Database Error: Failed to delete lecture.' };
  }
}
