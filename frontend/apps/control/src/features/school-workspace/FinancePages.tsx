import { ResourcePage } from './ResourcePage';
import { StatusPill } from './shared';

export function FinanceFeesPage() {
  return (
    <ResourcePage
      id="fees"
      title="Student fees"
      subtitle="Issue and track student fee invoices"
      heroLead="Create fee invoices, update payment status, and print professional statements for families."
      eyebrow="Control · Finance"
      navPermission="nav.control.finance"
      endpoint="finance/fees"
      prefix="fee-"
      createLabel="+ New invoice"
      allowPrint
      links={[
        { to: '/finance/expenses', label: 'Expenses' },
        { to: '/finance/reports', label: 'Finance reports' },
      ]}
      stats={[
        { key: 'total', label: 'Invoices' },
        { key: 'paid', label: 'Paid' },
        { key: 'outstanding', label: 'Outstanding' },
        { key: 'collected', label: 'Collected', hint: 'SAR' },
      ]}
      statusFilterOptions={[
        { value: 'draft', label: 'Draft' },
        { value: 'issued', label: 'Issued' },
        { value: 'paid', label: 'Paid' },
        { value: 'overdue', label: 'Overdue' },
        { value: 'void', label: 'Void' },
      ]}
      columns={[
        { key: 'number', label: 'Invoice #' },
        { key: 'student_name', label: 'Student' },
        { key: 'total', label: 'Total' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="fee-" status={String(row.status ?? '')} />,
        },
      ]}
      fields={[
        { key: 'student_user_id', label: 'Student user ID', type: 'number', required: true },
        { key: 'number', label: 'Invoice number', required: true, placeholder: 'INV-2026-001' },
        { key: 'total', label: 'Total amount', type: 'number', required: true },
        { key: 'currency', label: 'Currency', placeholder: 'SAR' },
        { key: 'due_at', label: 'Due date', type: 'date' },
        { key: 'notes', label: 'Notes', type: 'textarea' },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'draft', label: 'Draft' },
            { value: 'issued', label: 'Issued' },
            { value: 'paid', label: 'Paid' },
            { value: 'overdue', label: 'Overdue' },
            { value: 'void', label: 'Void' },
          ],
        },
      ]}
      labelKey="number"
      detailMeta={[
        { key: 'number', label: 'Invoice #' },
        { key: 'student_name', label: 'Student' },
        { key: 'total', label: 'Total', money: true },
        { key: 'due_at', label: 'Due', date: true },
        { key: 'status', label: 'Status', status: true },
        { key: 'notes', label: 'Notes' },
      ]}
    />
  );
}

export function FinanceTutorPaymentsPage() {
  return (
    <ResourcePage
      id="tutor-payments"
      title="Tutor payments"
      subtitle="Record payouts to tutors for completed sessions"
      heroLead="Track amounts owed and paid to tutors. Print payment vouchers for finance records."
      eyebrow="Control · Finance"
      navPermission="nav.control.finance"
      endpoint="finance/tutor-payments"
      prefix="tp-"
      createLabel="+ Record payment"
      allowPrint
      links={[
        { to: '/tutoring/tutors', label: 'Tutors' },
        { to: '/finance/reports', label: 'Finance reports' },
      ]}
      stats={[
        { key: 'total', label: 'Payments' },
        { key: 'paid', label: 'Paid' },
        { key: 'pending', label: 'Pending' },
        { key: 'amount_paid', label: 'Paid amount', hint: 'SAR' },
      ]}
      statusFilterOptions={[
        { value: 'pending', label: 'Pending' },
        { value: 'paid', label: 'Paid' },
        { value: 'cancelled', label: 'Cancelled' },
      ]}
      columns={[
        { key: 'tutor_name', label: 'Tutor' },
        { key: 'amount', label: 'Amount' },
        { key: 'paid_at', label: 'Paid on' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="tp-" status={String(row.status ?? '')} />,
        },
      ]}
      fields={[
        { key: 'tutor_user_id', label: 'Tutor user ID', type: 'number', required: true },
        { key: 'amount', label: 'Amount', type: 'number', required: true },
        { key: 'currency', label: 'Currency', placeholder: 'SAR' },
        { key: 'paid_at', label: 'Paid on', type: 'date' },
        { key: 'reference', label: 'Reference' },
        { key: 'notes', label: 'Notes', type: 'textarea' },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'pending', label: 'Pending' },
            { value: 'paid', label: 'Paid' },
            { value: 'cancelled', label: 'Cancelled' },
          ],
        },
      ]}
      labelKey="tutor_name"
      detailMeta={[
        { key: 'tutor_name', label: 'Tutor' },
        { key: 'amount', label: 'Amount', money: true },
        { key: 'paid_at', label: 'Paid on', date: true },
        { key: 'reference', label: 'Reference' },
        { key: 'status', label: 'Status', status: true },
      ]}
    />
  );
}

export function FinanceExpensesPage() {
  return (
    <ResourcePage
      id="expenses"
      title="Expenses"
      subtitle="School operating expenses and reimbursements"
      heroLead="Log categories such as utilities, supplies, and events — then roll them into finance reports."
      eyebrow="Control · Finance"
      navPermission="nav.control.finance"
      endpoint="finance/expenses"
      prefix="exp-"
      createLabel="+ Add expense"
      allowDelete
      links={[
        { to: '/finance/fees', label: 'Student fees' },
        { to: '/finance/reports', label: 'Finance reports' },
      ]}
      stats={[
        { key: 'total', label: 'Expenses' },
        { key: 'paid', label: 'Paid' },
        { key: 'amount', label: 'Total amount', hint: 'SAR' },
      ]}
      statusFilterOptions={[
        { value: 'pending', label: 'Pending' },
        { value: 'paid', label: 'Paid' },
        { value: 'void', label: 'Void' },
      ]}
      columns={[
        { key: 'title', label: 'Expense' },
        { key: 'category', label: 'Category' },
        { key: 'amount', label: 'Amount' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusPill prefix="exp-" status={String(row.status ?? '')} />,
        },
      ]}
      fields={[
        { key: 'title', label: 'Title', required: true },
        { key: 'category', label: 'Category', required: true, placeholder: 'Utilities' },
        { key: 'amount', label: 'Amount', type: 'number', required: true },
        { key: 'currency', label: 'Currency', placeholder: 'SAR' },
        { key: 'spent_on', label: 'Date', type: 'date', required: true },
        { key: 'notes', label: 'Notes', type: 'textarea' },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'pending', label: 'Pending' },
            { value: 'paid', label: 'Paid' },
            { value: 'void', label: 'Void' },
          ],
        },
      ]}
      labelKey="title"
      detailMeta={[
        { key: 'title', label: 'Title' },
        { key: 'category', label: 'Category' },
        { key: 'amount', label: 'Amount', money: true },
        { key: 'spent_on', label: 'Date', date: true },
        { key: 'status', label: 'Status', status: true },
      ]}
    />
  );
}
