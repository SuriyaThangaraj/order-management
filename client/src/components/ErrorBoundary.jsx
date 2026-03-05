import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', color: 'red', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                    <h1>Something went wrong.</h1>
                    <h3 style={{ color: '#333' }}>Please show this to the developer:</h3>
                    <hr />
                    <strong>{this.state.error && this.state.error.toString()}</strong>
                    <br />
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
