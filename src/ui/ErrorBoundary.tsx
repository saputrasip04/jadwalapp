// src/ui/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../lib/logger';
import { AlertTriangle, RefreshCw, Download } from 'lucide-react';

interface Props {
  menuTitle?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('UI_CRASH', `Crash di menu: ${this.props.menuTitle ?? 'Umum'}`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 m-4 bg-red-50 border border-red-200 rounded-2xl shadow-sm text-red-950">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-xl">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-red-900 mb-1">
                Terjadi Kendala pada Bagian {this.props.menuTitle ?? 'Ini'}
              </h2>
              <p className="text-sm text-red-700 mb-4">
                Aplikasi tetap berjalan dengan aman. Bagian ini mengalami kesalahan tidak terduga dan diisolasi agar data Anda tetap terlindungi.
              </p>
              {this.state.error && (
                <div className="p-3 mb-4 bg-red-100/60 rounded-lg text-xs font-mono text-red-800 overflow-x-auto">
                  {this.state.error.message}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={this.handleReset}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Muat Ulang Menu Ini
                </button>
                <button
                  onClick={() => logger.downloadLogs()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-red-300 hover:bg-red-50 text-red-800 text-sm font-medium rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Unduh Berkas Log
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
