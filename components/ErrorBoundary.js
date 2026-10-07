// components/ErrorBoundary.js
'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50/70 border-2 border-red-200 rounded-2xl p-6 text-red-900 my-4 max-w-2xl mx-auto shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-xl text-red-700 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-2 flex-1">
              <h3 className="font-bold text-base text-red-900 font-title">
                Terjadi Kesalahan pada Komponen: {this.props.componentName || 'Pratinjau Dokumen'}
              </h3>
              <p className="text-xs text-red-700 leading-relaxed">
                {this.state.error?.message || String(this.state.error) || 'Kesalahan render tidak terduga'}
              </p>
              {process.env.NODE_ENV !== 'production' && this.state.error?.stack && (
                <pre className="text-[11px] bg-red-100/60 p-3 rounded-lg overflow-x-auto text-red-800 font-mono max-h-40">
                  {this.state.error.stack}
                </pre>
              )}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold transition-all shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Muat Ulang Pratinjau</span>
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
