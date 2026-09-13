import type { UpcomingTrainingCourse } from './lib/training-parsers';
import styles from './training-source.module.css';
export function TrainingClassCards({ courses, today, limit = 5 }: { courses: UpcomingTrainingCourse[]; today: string; limit?: number }) {
  const upcoming = courses.filter(course => course.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, limit);
  const date = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  return <div className={styles.cards} aria-label="Upcoming classes">{upcoming.map(course => <a className={styles.card} href={course.url} target="_blank" rel="noopener noreferrer" key={`${course.title}-${course.startDate}-${course.location}`}>
    <time dateTime={course.startDate}>{date(course.startDate)}{course.endDate !== course.startDate && <small>through {date(course.endDate)}</small>}</time>
    <div><strong>{course.title}</strong><span>{course.location}</span>{course.detail && <small>{course.detail}</small>}<b>View class / Register ↗</b></div>
  </a>)}</div>;
}
