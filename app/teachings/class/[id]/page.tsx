// app/course/[id]/page.tsx
import { getSession } from '@/lib/auth';
import { query } from '@/service/postgres';
import { Suspense } from 'react';
import CourseClientComponent from './client-page';

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

export default async function ClassTeachingPage({ params }: { params: { id: string } }) {
  const courseQuery = `
    SELECT
      c.*,
      (
        SELECT json_agg(s.* ORDER BY s.event_date ASC, s.schedule_id ASC)
        FROM course_schedule s
        WHERE s.course_id = c.id
      ) as schedule
    FROM
      courses c
    WHERE
      c.id = $1;
  `;

  const { rows } = await query(courseQuery, [params.id]);
  const course: Course = rows[0];
  const session = await getSession();
  if (!course) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <h2 className="animate-fade-left">Course Not Found</h2>
        <p className='animate-fade-up'>Sorry, the course you are looking for does not exist.</p>
      </main>
    );
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CourseClientComponent course={course} session={session} />
    </Suspense>
  );
}
