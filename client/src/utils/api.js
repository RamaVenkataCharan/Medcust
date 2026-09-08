const API_BASE = '/api';

async function handleResponse(res) {
  if (!res.ok) {
    let errorMsg = 'An unexpected error occurred';
    try {
      const data = await res.json();
      errorMsg = data.error || errorMsg;
    } catch {
      errorMsg = await res.text() || res.statusText;
    }
    const err = new Error(errorMsg);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  // Config
  getConfig: () => fetch(`${API_BASE}/config`).then(handleResponse),

  // Customers
  searchCustomers: (query) =>
    fetch(`${API_BASE}/customers/search?q=${encodeURIComponent(query)}`).then(handleResponse),
  getCustomer: (id) => fetch(`${API_BASE}/customers/${id}`).then(handleResponse),
  getCustomerStats: (id) => fetch(`${API_BASE}/customers/${id}/stats`).then(handleResponse),
  createCustomer: (data) =>
    fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),

  // Entries (Purchases)
  addEntry: (data) =>
    fetch(`${API_BASE}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  getEntries: (customerId, page = 1, limit = 10) =>
    fetch(`${API_BASE}/entries?customer_id=${customerId}&page=${page}&limit=${limit}`).then(handleResponse),
  getEntry: (id) => fetch(`${API_BASE}/entries/${id}`).then(handleResponse),

  // Payments (Due Clearances)
  recordPayment: (data) =>
    fetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  getPayments: (customerId) =>
    fetch(`${API_BASE}/payments?customer_id=${customerId}`).then(handleResponse),

  // Autocomplete
  autocompleteMedicines: (q) =>
    fetch(`${API_BASE}/medicines/autocomplete?q=${encodeURIComponent(q || '')}`).then(handleResponse),

  // Reports & Backups
  getDuesReport: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetch(`${API_BASE}/reports/dues?${query}`).then(handleResponse);
  },
  triggerBackup: () => fetch(`${API_BASE}/reports/backup`, { method: 'POST' }).then(handleResponse),
  getBackups: () => fetch(`${API_BASE}/reports/backups`).then(handleResponse),
};

export default api;
