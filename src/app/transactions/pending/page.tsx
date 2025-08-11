// src/app/transactions/pending/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import { microCategories, microToMacro } from '@/utils/categories'


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
          className="border rounded p-4 mb-4 shadow-sm"
        >
          <div className="flex justify-between">
            <div>
              <p className="font-medium">{tx.description}</p>
              <p className="text-sm text-gray-500">
                {new Date(tx.date).toLocaleString()} — $
                {tx.amount.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center space-x-4">
            <select
            value={selected[tx.id] || ''}
            onChange={(e) =>
                setSelected((s) => ({ ...s, [tx.id]: e.target.value }))
            }
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

            <label className="inline-flex items-center">
              <input
                type="checkbox"
                className="mr-1"
                checked={addLookup[tx.id] || false}
                onChange={(e) =>
                  setAddLookup((l) => ({
                    ...l,
                    [tx.id]: e.target.checked,
                  }))
                }
              />
              Add to lookup
            </label>

            <button
              className="ml-auto bg-blue-600 text-white px-4 py-1 rounded disabled:opacity-50"
              disabled={!selected[tx.id]}
              onClick={() => handleSave(tx)}
            >
              Save
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
