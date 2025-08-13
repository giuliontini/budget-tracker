'use client';

import React from 'react';
import clsx from 'clsx';

type Props = {
  open: boolean;
  title?: string;
  message?: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* panel */}
      <div
        className={clsx(
          'relative w-full max-w-sm rounded-2xl border shadow-lg',
          'bg-white text-gray-900 border-zinc-200',
          'dark:bg-zinc-900 dark:text-gray-100 dark:border-zinc-800'
        )}
      >
        <div className="p-5">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">{message}</div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="px-4 py-2 rounded border border-zinc-300 dark:border-zinc-700"
              onClick={onCancel}
              type="button"
            >
              {cancelText}
            </button>
            <button
              className="px-4 py-2 rounded bg-red-600 text-white"
              onClick={onConfirm}
              type="button"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
