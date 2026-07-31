import { ResourcePage } from './ResourcePage';
import { StatusPill } from './shared';

const statusOpts = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export function StaffEmployeesPage() {
  return (
    <ResourcePage
      id="staff"
      title="Employees"
      subtitle="Manage non-teaching staff accounts for your school"
      heroLead="Add administrators, coordinators, and support staff — then track their attendance from the Staff Attendance page."
      eyebrow="Control · Staff management"
      navPermission="nav.control.staff-management"
      endpoint="staff"
      prefix="stf-"
      idKey="user_id"
      createLabel="+ Add employee"
      allowDelete={false}
      links={[{ to: '/staff/attendance', label: 'Attendance' }]}
      stats={[
        { key: 'total', label: 'Employees' },
        { key: 'active', label: 'Active' },
      ]}
      statusFilterOptions={statusOpts}
      columns={[
        {
          key: 'name',
          label: 'Employee',
          render: (row) => (
            <div>
              <strong>
                {[row.first_name, row.last_name].filter(Boolean).join(' ') || String(row.email ?? '—')}
              </strong>
              <div style={{ marginTop: 2, fontSize: '0.85rem', color: 'var(--stem-ink-soft)' }}>
                {String(row.email ?? '')}
              </div>
            </div>
          ),
        },
        {
          key: 'role',
          label: 'Role',
          render: (row) =>
            String(row.role ?? '')
              .split(/[_\s]+/)
              .filter(Boolean)
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(' ') || '—',
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="stf-" status={String(row.status ?? '')} />,
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
          hint: 'At least 8 characters. The employee can change this after first login.',
        },
        { key: 'first_name', label: 'First name', required: true },
        { key: 'last_name', label: 'Last name' },
        {
          key: 'role',
          label: 'Role',
          type: 'select',
          required: true,
          options: [
            { value: 'school_admin', label: 'School admin' },
            { value: 'campus_admin', label: 'Campus admin' },
            { value: 'principal', label: 'Principal' },
            { value: 'academic_coordinator', label: 'Academic coordinator' },
            { value: 'finance_manager', label: 'Finance manager' },
          ],
        },
        { key: 'status', label: 'Status', type: 'select', options: statusOpts, editOnly: true },
      ]}
      detailMeta={[
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role' },
        { key: 'status', label: 'Status', status: true },
        { key: 'user_id', label: 'User ID' },
      ]}
    />
  );
}

export function StaffAttendancePage() {
  return (
    <ResourcePage
      id="staff-attendance"
      title="Staff attendance"
      subtitle="Record daily presence for school employees"
      heroLead="Mark present, absent, late, or leave for staff members. Use filters to review a date range."
      eyebrow="Control · Staff management"
      navPermission="nav.control.staff-management"
      endpoint="staff-attendance"
      prefix="sta-"
      createLabel="+ Mark attendance"
      allowEdit
      links={[{ to: '/staff', label: 'Employees' }]}
      stats={[
        { key: 'present', label: 'Present' },
        { key: 'absent', label: 'Absent' },
        { key: 'late', label: 'Late' },
        { key: 'leave', label: 'On leave' },
      ]}
      statusFilterOptions={[
        { value: 'present', label: 'Present' },
        { value: 'absent', label: 'Absent' },
        { value: 'late', label: 'Late' },
        { value: 'leave', label: 'Leave' },
      ]}
      columns={[
        { key: 'user_name', label: 'Employee' },
        { key: 'attendance_date', label: 'Date' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="sta-" status={String(row.status ?? '')} />,
        },
        { key: 'notes', label: 'Notes' },
      ]}
      fields={[
        { key: 'user_id', label: 'Employee user ID', type: 'number', required: true, placeholder: 'User ID' },
        { key: 'attendance_date', label: 'Date', type: 'date', required: true },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          options: [
            { value: 'present', label: 'Present' },
            { value: 'absent', label: 'Absent' },
            { value: 'late', label: 'Late' },
            { value: 'leave', label: 'Leave' },
          ],
        },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      detailMeta={[
        { key: 'user_name', label: 'Employee' },
        { key: 'attendance_date', label: 'Date', date: true },
        { key: 'status', label: 'Status', status: true },
        { key: 'notes', label: 'Notes' },
      ]}
    />
  );
}
