/**
 * Format amount into Indian Rupee representation
 */
export function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format date in DD MMM, YYYY format (e.g. 05 Sep, 2024)
 */
export function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format relative time (e.g. "Today", "Yesterday", "5 days ago")
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return 'No visits yet';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';

  const now = new Date();
  const diffTime = now.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1) return `${diffDays} days ago`;
  return formatDate(dateString);
}
