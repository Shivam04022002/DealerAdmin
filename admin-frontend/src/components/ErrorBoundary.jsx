// src/components/ErrorBoundary.jsx
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
    this.setState({ info });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, fontFamily: "sans-serif" }}>
          <h2 style={{ color: "#b91c1c" }}>UI crashed — ErrorBoundary</h2>
          <pre style={{ whiteSpace: "pre-wrap", color: "#111" }}>
            {String(this.state.error)}
          </pre>
          <details style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
            {this.state.info?.componentStack}
          </details>
          <p style={{ marginTop: 12 }}>
            Check browser console for full stack trace.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
