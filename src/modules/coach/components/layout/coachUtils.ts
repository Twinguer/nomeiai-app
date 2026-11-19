export function getCoachInitials(name: string): string {
  if (!name) return 'A';
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

export function hasStudentLast7DaysActivity(student: {
  performance: { sessions_this_week?: number; hours_this_week?: number };
}): boolean {
  return (
    (student.performance.sessions_this_week ?? 0) > 0 ||
    (student.performance.hours_this_week ?? 0) > 0
  );
}
