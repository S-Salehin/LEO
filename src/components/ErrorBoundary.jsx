import React from "react";

/** Prevents blank white screen by showing a friendly error box. */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, message: String(err?.message || err) };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="page">
          <div className="panel" style={{borderColor:"#ff6b6b"}}>
            <h3>Something went wrong.</h3>
            <p style={{opacity:.8}}>{this.state.message}</p>
            <button onClick={() => location.reload()}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
