// src/app/transactions/pending/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import { microCategories, microToMacro } from '@/utils/categories'
import ConfirmDialog from '@/components/ConfirmDialog';

const [toDelete, setToDelete] = useState<Tx | null>(null);

type Tx = {
  id: number
  description: string
  amount: number
  date: string
  status: 'pending' | 'confirmed'
}

export default function PendingTransactionsPage() {
  const [txs, setTxs] = useState<Tx[]>([])
  const [selected, setSelected] = useState<Record<number, string>>({})
  const [addLookup, setAddLookup] = useState<Record<number, boolean>>({})

  useEffect(() => {
    // fetch all and filter pending client-side
    fetch('/api/transactions')
      .then((res) => res.json())
      .then((all: Tx[]) =>
        setTxs(all.filter((t) => t.status === 'pending'))
      )
  }, [])

  const handleSave = async (tx: Tx) => {
    const raw = selected[tx.id] || ''
    const [, micro] = raw.split(':')       // drop the “Needs” part
    const addToLookupFlag = addLookup[tx.id] ?? false

    await fetch(`/api/transactions/${tx.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: micro,                   // send just the micro string
        addToLookup: addToLookupFlag,
      }),
    })

    setTxs((prev) => prev.filter((t) => t.id !== tx.id))
  }
  
  return (
    <div className="p-6 space-y-8">
      <Navbar title="Pending" />
      <h1 className="text-2xl font-semibold mb-4">
        Pending Transactions
      </h1>

      {txs.length === 0 && <p>No pending transactions 🎉</p>}
      {txs.map((tx) => (
        <div
          key={tx.id}
          className="border rounded-2xl p-3 sm:p-4 md:p-6 mb-4 shadow-sm overflow-hidden
                   bg-white text-gray-900 border-zinc-200
                   dark:bg-zinc-900 dark:text-gray-100 dark:border-zinc-800"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div>
              <p className="font-medium">{tx.description}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(tx.date).toLocaleString()} — ${tx.amount.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              className="border rounded px-3 py-2 w-full sm:w-72
                       bg-white text-gray-900 border-zinc-200
                       dark:bg-zinc-800 dark:text-gray-100 dark:border-zinc-700"
              value={selected[tx.id] || ''}
              onChange={(e) => setSelected((s) => ({ ...s, [tx.id]: e.target.value }))}
            >
              <option value="">– select sub-category –</option>
              {['Needs', 'Wants', 'Savings'].map((macro) => (
                <optgroup key={macro} label={macro}>
                {microCategories
                    .filter((µ) => microToMacro[µ] === macro)
                    .map((µ) => (
                    <option key={µ} value={`${macro}:${µ}`}>
                        {µ}
                    </option>
                    ))}
                </optgroup>
            ))}
            </select>

            <label className="inline-flex items-center text-sm">
              <input
                type="checkbox"
                className="mr-2 accent-blue-600"
                checked={addLookup[tx.id] || false}
                onChange={(e) => setAddLookup((l) => ({ ...l, [tx.id]: e.target.checked }))}
              />
              <span className="text-gray-700 dark:text-gray-300">Add to lookup</span>
            </label>

            <button
              className="text-red-600 hover:underline text-sm"
              onClick={() => setToDelete(tx)}
              type="button"
            >
              Delete
            </button>


            <button
              className="sm:ml-auto bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 w-full sm:w-auto"
              disabled={!selected[tx.id]}
              onClick={() => handleSave(tx)}>
              Save
            </button>
          </div>
        </div>
      ))}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete transaction?"
        message={
          <span>
            Delete <strong>{toDelete?.description}</strong> for ${toDelete?.amount.toFixed(2)}?
            <br />This cannot be undone.
          </span>
        }
        confirmText="Delete"
        cancelText="Cancel"
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          const tx = toDelete;
          setToDelete(null);

          // optimistic remove
          setTxs((prev) => prev.filter((t) => t.id !== tx.id));
          try {
            const res = await fetch(`/api/transactions/${tx.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed');
          } catch {
            setTxs((prev) => [tx, ...prev]);
            alert('Delete failed');
          }
        }}
      />
    </div>
  )
}
