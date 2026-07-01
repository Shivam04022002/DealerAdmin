import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import 'bootstrap/dist/css/bootstrap.min.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Individual hooks override staleTime per query type (pending=20s, finalized=60s).
      // This default applies to any query that doesn't set its own staleTime.
      staleTime: 20 * 1000,
      gcTime: 5 * 60 * 1000,
      // useApplications('pending') sets refetchOnWindowFocus:true explicitly.
      // useApplications('approved'/'rejected') keeps it false.
      // All other queries default to false here.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
