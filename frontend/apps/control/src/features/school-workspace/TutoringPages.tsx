import { ResourcePage } from './ResourcePage';
import { StatusPill } from './shared';

export function TutoringTutorsPage() {
  return (
    <ResourcePage
      id="tutoring-tutors"
      title="Tutor management"
      subtitle="Tutors available for one-to-one and small-group sessions"
      heroLead="Maintain tutor profiles used for session booking and tutor payments."
      eyebrow="Control · Tutoring"
      navPermission="nav.control.tutoring"
      endpoint="tutoring/tutors"
      prefix="tt-"
      idKey="user_id"
      createLabel="+ Add tutor"
      links={[
        { to: '/tutoring/booking', label: 'Session booking' },
        { to: '/tutoring/timetable', label: 'Timetable' },
        { to: '/finance/tutor-payments', label: 'Tutor payments' },
      ]}
      stats={[
        { key: 'total', label: 'Tutors' },
        { key: 'active', label: 'Active' },
      ]}
      columns={[
        {
          key: 'name',
          label: 'Tutor',
          render: (row) => (
            <strong>
              {[row.first_name, row.last_name].filter(Boolean).join(' ') || String(row.email ?? '—')}
            </strong>
          ),
        },
        { key: 'email', label: 'Email' },
        { key: 'hourly_rate', label: 'Rate' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="tt-" status={String(row.status ?? '')} />,
        },
      ]}
      fields={[
        { key: 'email', label: 'Email', type: 'email', required: true },
        {
          key: 'password',
          label: 'Password',
          type: 'password',
          required: true,
          createOnly: true,
          hint: 'At least 8 characters. The tutor can change this after first login.',
        },
        { key: 'first_name', label: 'First name', required: true },
        { key: 'last_name', label: 'Last name' },
        { key: 'hourly_rate', label: 'Hourly rate', type: 'number' },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
          editOnly: true,
        },
      ]}
    />
  );
}

export function TutoringBookingPage() {
  return (
    <ResourcePage
      id="tutoring-booking"
      title="Session booking"
      subtitle="Book and manage tutoring sessions"
      heroLead="Schedule sessions between tutors and students — update status as sessions complete."
      eyebrow="Control · Tutoring"
      navPermission="nav.control.tutoring"
      endpoint="tutoring/bookings"
      prefix="tb-"
      createLabel="+ Book session"
      links={[
        { to: '/tutoring/tutors', label: 'Tutors' },
        { to: '/tutoring/timetable', label: 'Timetable' },
      ]}
      stats={[
        { key: 'total', label: 'Sessions' },
        { key: 'scheduled', label: 'Scheduled' },
        { key: 'completed', label: 'Completed' },
      ]}
      statusFilterOptions={[
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
      ]}
      columns={[
        { key: 'tutor_name', label: 'Tutor' },
        { key: 'student_name', label: 'Student' },
        { key: 'starts_at', label: 'Starts' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="tb-" status={String(row.status ?? '')} />,
        },
      ]}
      fields={[
        { key: 'tutor_user_id', label: 'Tutor user ID', type: 'number', required: true },
        { key: 'student_user_id', label: 'Student user ID', type: 'number', required: true },
        { key: 'starts_at', label: 'Starts', type: 'date', required: true },
        { key: 'ends_at', label: 'Ends', type: 'date' },
        { key: 'subject_id', label: 'Subject ID', type: 'number' },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ],
        },
      ]}
      labelKey="tutor_name"
    />
  );
}

export function TutoringTimetablePage() {
  return (
    <ResourcePage
      id="tutoring-timetable"
      title="Timetable"
      subtitle="Weekly tutoring availability slots"
      heroLead="Define recurring day/time slots tutors can be booked against."
      eyebrow="Control · Tutoring"
      navPermission="nav.control.tutoring"
      endpoint="tutoring/timetable"
      prefix="tm-"
      createLabel="+ Add slot"
      allowDelete
      links={[
        { to: '/tutoring/booking', label: 'Session booking' },
        { to: '/tutoring/tutors', label: 'Tutors' },
      ]}
      stats={[
        { key: 'total', label: 'Slots' },
        { key: 'active', label: 'Active' },
      ]}
      columns={[
        { key: 'day_label', label: 'Day' },
        { key: 'start_time', label: 'Start' },
        { key: 'end_time', label: 'End' },
        { key: 'tutor_name', label: 'Tutor' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="tm-" status={String(row.status ?? '')} />,
        },
      ]}
      fields={[
        {
          key: 'day_of_week',
          label: 'Day of week',
          type: 'select',
          required: true,
          options: [
            { value: '1', label: 'Monday' },
            { value: '2', label: 'Tuesday' },
            { value: '3', label: 'Wednesday' },
            { value: '4', label: 'Thursday' },
            { value: '5', label: 'Friday' },
            { value: '6', label: 'Saturday' },
            { value: '0', label: 'Sunday' },
          ],
        },
        { key: 'start_time', label: 'Start time (HH:MM)', required: true, placeholder: '09:00' },
        { key: 'end_time', label: 'End time (HH:MM)', required: true, placeholder: '10:00' },
        { key: 'tutor_user_id', label: 'Tutor user ID', type: 'number', required: true },
        { key: 'subject_id', label: 'Subject ID', type: 'number' },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
        },
      ]}
      labelKey="day_label"
    />
  );
}
