# FRONTEND BUG AUDIT & FIXES

## BUG #1: Memory Leak in useEffect (Critical)

**File:** `frontend/src/components/*.jsx` (Multiple files)

**Problem:**
```jsx
useEffect(() => {
  const abortController = new AbortController();
  // ... make API call ...
  return () => abortController.abort(); // Good
}, [paperId]); // PROBLEM: What if component unmounts mid-request?
```

If component unmounts while request in flight, the abort signal might be ignored by Axios.

**Fix:**
```jsx
useEffect(() => {
  let isMounted = true; // Track if component is still mounted
  const abortController = new AbortController();

  const fetchData = async () => {
    try {
      const result = await api.get(...);
      // Only update state if component is still mounted
      if (isMounted) {
        setState(result);
      }
    } catch (error) {
      if (isMounted) {
        setError(error);
      }
    }
  };

  fetchData();

  return () => {
    isMounted = false; // Mark as unmounted
    abortController.abort();
  };
}, [paperId]);
```

---

## BUG #2: Race Condition on PaperDetail Navigation

**File:** `frontend/src/components/PaperDetail.jsx`

**Problem:**
```jsx
const [paper, setPaper] = useState(null);

const handleGenerateSummary = async () => {
  const result = await generateSummary(paperId);
  setPaper(result.paper); // What if paperId changed?
};

useEffect(() => {
  // Load paper on mount/paperId change
  fetchPaperById(paperId).then(setPaper);
}, [paperId]);
```

Scenario: User is generating summary for Paper A. While waiting, user clicks on Paper B. The request for Paper A completes and updates state with Paper A's summary, but the page now shows Paper B.

**Fix:** Already implemented in earlier changes. Verify with current code.

---

## BUG #3: No Token Validation Before API Calls

**File:** `frontend/src/context/AuthContext.jsx` and API services

**Problem:**
```jsx
// AuthContext doesn't check if token is expired
// Frontend just blindly sends it
// Backend returns 401
// But frontend shows generic "404" or "Network error"

const response = await axios.post('/api/papers/:id/generate-summary', {
  // Token sent but might be expired
});
```

**Fix - Add token validation:**
```jsx
// frontend/src/context/AuthContext.jsx

export function AuthProvider({ children }) {
  const [authToken, setAuthToken] = useState(() => {
    const token = localStorage.getItem('paperlens.authToken');
    return isTokenExpired(token) ? null : token;
  });

  // Check token on app load
  useEffect(() => {
    const token = localStorage.getItem('paperlens.authToken');
    if (token && isTokenExpired(token)) {
      localStorage.removeItem('paperlens.authToken');
      setAuthToken(null);
    }
  }, []);

  return <AuthContext.Provider value={{ authToken, setAuthToken }}>{children}</AuthContext.Provider>;
}

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}
```

**Fix - Add interceptor for 401 responses:**
```jsx
// frontend/src/services/paperApi.js

const axiosInstance = axios.create({
  baseURL: API_BASE_URL
});

// Add response interceptor
axiosInstance.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('paperlens.authToken');
      window.location.href = '/login?reason=session-expired';
    }
    return Promise.reject(error);
  }
);
```

---

## BUG #4: No Error Boundary (App Will Crash)

**File:** `frontend/src/App.jsx`

**Problem:**
```jsx
// If any component throws an error, entire app crashes
// No fallback UI shown
```

**Fix - Add Error Boundary:**
```jsx
// frontend/src/components/ErrorBoundary.jsx

import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-900 mb-2">Something went wrong</h1>
            <p className="text-red-700 mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// In App.jsx
<ErrorBoundary>
  <MainApp />
</ErrorBoundary>
```

---

## BUG #5: State Updates in Unmounted Component

**File:** `frontend/src/components/Chat.jsx`

**Problem:**
```jsx
useEffect(() => {
  fetchMessages();
  // No cleanup if component unmounts
}, []);

// If component unmounts, fetchMessages completes and tries to call setState
// React warning: "Can't perform a React state update on an unmounted component"
```

**Fix:**
```jsx
useEffect(() => {
  let isMounted = true;

  const fetchMessages = async () => {
    const data = await api.get('/messages');
    if (isMounted) {
      setMessages(data);
    }
  };

  fetchMessages();

  return () => {
    isMounted = false;
  };
}, []);
```

---

## BUG #6: Missing Input Validation

**File:** `frontend/src/components/PDFUpload.jsx`

**Problem:**
```jsx
<input type="file" accept=".pdf" onChange={handleFileChange} />

// No validation before upload
// User could upload:
// - Non-PDF files (detected by name but could be trojan)
// - 100MB files (no size check)
// - Wrong format (not actually PDF)
```

**Fix:**
```jsx
const handleFileChange = async (event) => {
  const file = event.target.files[0];

  if (!file) return;

  // Validate file size (max 50MB)
  if (file.size > 50 * 1024 * 1024) {
    setError('File size must be less than 50MB');
    return;
  }

  // Validate file type
  if (file.type !== 'application/pdf') {
    setError('Only PDF files are allowed');
    return;
  }

  // Validate file extension
  if (!file.name.endsWith('.pdf')) {
    setError('File must have .pdf extension');
    return;
  }

  // Check file signature (PDF magic bytes: %PDF)
  const buffer = await file.slice(0, 4).arrayBuffer();
  const view = new Uint8Array(buffer);
  const header = String.fromCharCode(...view);

  if (header !== '%PDF') {
    setError('File does not appear to be a valid PDF');
    return;
  }

  // File is valid, proceed with upload
  handleUpload(file);
};
```

---

## BUG #7: Infinite Loops in useEffect

**File:** Various components

**Problem:**
```jsx
useEffect(() => {
  if (data) {
    setData(transformData(data)); // INFINITE LOOP!
  }
}, [data]); // data in dependency array, changing data triggers effect, which changes data
```

**Fix:**
```jsx
// Option 1: Use useCallback to memoize transformation
const transformData = useCallback((data) => {
  return data.map(item => ({ ...item, transformed: true }));
}, []);

useEffect(() => {
  if (data) {
    setData(transformData(data));
  }
}, []); // Only run once on mount

// Option 2: Transform during render
const transformedData = data?.map(item => ({ ...item, transformed: true }));
```

---

## BUG #8: Missing null/undefined Checks

**File:** `frontend/src/components/Dashboard.jsx`

**Problem:**
```jsx
{paper.summary.shortSummary.length > 0 ? ( // CRASH if summary is null!
  <div>{paper.summary.shortSummary}</div>
) : (
  <div>No summary</div>
)}
```

**Fix:**
```jsx
{paper?.summary?.shortSummary?.length > 0 ? (
  <div>{paper.summary.shortSummary}</div>
) : (
  <div>No summary</div>
)}

// Or better
{hasSummary(paper) ? (
  <div>{paper.summary.shortSummary}</div>
) : (
  <div>No summary</div>
)}

function hasSummary(paper) {
  return Boolean(
    paper?.summary?.shortSummary || 
    paper?.summary?.keyContributions?.length > 0
  );
}
```

---

## BUG #9: Missing Loading States in Lists

**File:** `frontend/src/components/Dashboard.jsx`

**Problem:**
```jsx
{papers.map(paper => (
  <PaperCard key={paper._id} paper={paper} />
))}
// Shows nothing while loading, user thinks page is broken
```

**Fix:**
```jsx
{isLoading ? (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <Skeleton key={i} />
    ))}
  </div>
) : papers.length > 0 ? (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {papers.map(paper => (
      <PaperCard key={paper._id} paper={paper} />
    ))}
  </div>
) : (
  <EmptyState
    title="No papers yet"
    description="Upload your first PDF to get started"
    action={<button>Upload PDF</button>}
  />
)}
```

---

## BUG #10: No Debouncing on Search

**File:** `frontend/src/components/Dashboard.jsx`

**Problem:**
```jsx
const handleSearch = (query) => {
  setSearchQuery(query); // Fires on every keystroke!
  fetchPapers(query); // Makes API call for each letter typed
};

<input onChange={(e) => handleSearch(e.target.value)} />
```

**Fix:**
```jsx
const handleSearch = useCallback(
  debounce((query) => {
    setSearchQuery(query);
    fetchPapers(query);
  }, 300), // Wait 300ms after user stops typing
  []
);

<input 
  onChange={(e) => handleSearch(e.target.value)}
  placeholder="Search papers..."
/>

// Helper function
function debounce(func, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}
```

---

## BUG #11: Stale Closure in Event Handlers

**File:** Various components

**Problem:**
```jsx
const handleClick = () => {
  console.log(paperId); // Stale value from initial render!
};

useEffect(() => {
  element.addEventListener('click', handleClick);
  return () => element.removeEventListener('click', handleClick);
}, []); // paperId not in deps - uses old value
```

**Fix:**
```jsx
const handleClick = useCallback(() => {
  console.log(paperId); // Current value
}, [paperId]); // Include dependency

useEffect(() => {
  element.addEventListener('click', handleClick);
  return () => element.removeEventListener('click', handleClick);
}, [handleClick]); // handleClick in deps
```

---

## BUG #12: Missing PropTypes

**File:** All components

**Problem:**
- No type checking at runtime
- Props passed incorrectly get silent failures
- Hard to debug

**Fix:**
```jsx
import PropTypes from 'prop-types';

function PaperCard({ paper, onDelete }) {
  return <div>{paper.title}</div>;
}

PaperCard.propTypes = {
  paper: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    uploadDate: PropTypes.string
  }).isRequired,
  onDelete: PropTypes.func.isRequired
};

export default PaperCard;
```

---

## FIXES SUMMARY

| Bug | Severity | File(s) | Status |
|-----|----------|---------|--------|
| Memory Leak | Critical | Multiple | Fix provided above |
| Race Condition | Critical | PaperDetail | Already fixed |
| Token Validation | High | AuthContext, Services | Fix provided above |
| No Error Boundary | High | App.jsx | Fix provided above |
| Unmounted State Update | High | Chat, others | Fix provided above |
| Missing Validation | High | PDFUpload | Fix provided above |
| Infinite Loops | High | Multiple | Fix provided above |
| Null/Undefined Crashes | High | Dashboard, Detail | Fix provided above |
| Missing Loading States | Medium | Dashboard | Fix provided above |
| No Debouncing | Medium | Dashboard | Fix provided above |
| Stale Closures | Medium | Event handlers | Fix provided above |
| Missing PropTypes | Low | All components | Fix provided above |

---

## Implementation Priority

**Phase 1 (This turn):** Error Boundary, Token Validation, Memory Leak fixes
**Phase 2 (Next):** Input Validation, Loading States
**Phase 3 (Following):** PropTypes, Debouncing, UI Polish

