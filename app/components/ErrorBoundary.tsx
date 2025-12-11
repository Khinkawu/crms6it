"use client";

import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary component to catch and handle runtime errors gracefully.
 * Prevents the entire app from crashing and provides user-friendly error UI.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        this.setState({ errorInfo });

        // Log error to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error("Error Boundary caught:", error);
            console.error("Error Info:", errorInfo);
        }

        // TODO: Send error to logging service in production
        // logErrorToService(error, errorInfo);
    }

    handleReload = (): void => {
        window.location.reload();
    };

    handleGoHome = (): void => {
        window.location.href = '/';
    };

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                        <AlertTriangle className="w-10 h-10 text-red-500" />
                    </div>

                    <h2 className="text-2xl font-bold text-text mb-2">เกิดข้อผิดพลาด</h2>
                    <p className="text-text-secondary mb-6 max-w-md">
                        ขออภัย เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง
                    </p>

                    {/* Show error details in development */}
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-left max-w-lg w-full overflow-auto">
                            <p className="text-sm font-mono text-red-600 dark:text-red-400">
                                {this.state.error.message}
                            </p>
                            {this.state.errorInfo && (
                                <pre className="mt-2 text-xs text-red-500/70 overflow-auto max-h-32">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={this.handleReset}
                            className="flex items-center gap-2 px-6 py-3 bg-card border border-border rounded-xl font-medium text-text hover:bg-background transition-colors"
                        >
                            <RefreshCw size={18} />
                            ลองใหม่
                        </button>
                        <button
                            onClick={this.handleGoHome}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium shadow-lg hover:shadow-cyan-500/20 transition-all"
                        >
                            <Home size={18} />
                            กลับหน้าหลัก
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

/**
 * Higher-order component wrapper for ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WithErrorBoundaryWrapper(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <WrappedComponent {...props} />
            </ErrorBoundary>
        );
    };
}
