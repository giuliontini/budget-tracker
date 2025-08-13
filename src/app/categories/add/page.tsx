// src/app/categories/add/page.tsx
'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import Navbar from '@/components/Navbar'
import { macroCategories, microCategories, microToMacro } from '@/utils/categories'
import type { MacroCategory, MicroCategory } from '@/utils/categories'
import ConfirmDialog from '@/components/ConfirmDialog';

const [toDelete, setToDelete] = useState<BudgetItem | null>(null);

type BudgetItem = {
  id: string
  name: string
  amount: number
  category: {
    id: string
    macro: MacroCategory
    micro: MicroCategory
  }
}

type FormValues = {
  name: string
  amount: string
  macro: MacroCategory
  micro: MicroCategory
}

export default function AddBudgetItemPage() {
  const [items, setItems] = useState<BudgetItem[]>([])

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      amount: '',
      macro: macroCategories[0],
      micro: '' as MicroCategory,
    },
  })

  useEffect(() => {
    fetch('/api/budget-items')
      .then((r) => r.json())
      .then(setItems)
      .catch((e) => console.error(e))
  }, [])

  const onSubmit = async (data: FormValues) => {
    try {
      const res = await fetch('/api/budget-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          amount: parseFloat(data.amount),
          macro: data.macro,
          micro: data.micro,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      reset()
      const refreshed = await fetch('/api/budget-items')
      setItems(await refreshed.json())
    } catch (err) {
      console.error('Submit error:', err)
    }
  }

  const handleDelete = async (item: BudgetItem) => {
    const ok = window.confirm(`Delete "${item.name}"? This action cannot be undone.`);
    if (!ok) return;
    // optimistic update
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    try {
      const res = await fetch(`/api/budget-items/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // revert if it fails
      setItems((prev) => [...prev, item].sort((a,b)=>a.name.localeCompare(b.name)));
      alert("Delete failed");
    }
  }

  return (
    <div>
      <Navbar title="Add / Edit Budget Items" />

      <div className="p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Add a Budget Item</h1>
          <Link
            href="/categories"
            className="rounded px-4 py-2 bg-black text-white hover:opacity-90"
          >
            Back to Categories
          </Link>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
          <div>
            <label className="block mb-1">Item Name</label>
            <input
              {...register('name', { required: true })}
              className="w-full border rounded px-3 py-2"
            />
            {errors.name && <p className="text-red-500">Required</p>}
          </div>

          <div>
            <label className="block mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              {...register('amount', { required: true })}
              className="w-full border rounded px-3 py-2"
            />
            {errors.amount && <p className="text-red-500">Required</p>}
          </div>

          <div>
            <span className="block mb-1">Category Type</span>
            <div className="flex flex-wrap gap-2">
              {macroCategories.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setValue('macro', m)}
                  className={`px-3 py-1 rounded ${
                    watch('macro') === m ? 'bg-blue-600 text-black' : 'bg-gray-200 text-black'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block mb-1">Sub-category</label>
            <select
              {...register('micro', { required: true })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">– Choose a sub-category –</option>
              {microCategories
                .filter((µ) => microToMacro[µ] === watch('macro'))
                .map((µ) => (
                  <option key={µ} value={µ}>
                    {µ}
                  </option>
                ))}
            </select>
            {errors.micro && <p className="text-red-500">Required</p>}
          </div>

          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Save Budget Item
          </button>
        </form>

        {/* quick peek at what's saved so far */}
        {items.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mt-8 mb-4">Current Items</h2>
            <ul className="space-y-2 max-w-xl">
              {items.map((item) => (
                <li key={item.id} className="border p-2 rounded bg-white">
                  <div className="flex justify-between">
                    <div>
                      <div className="font-medium text-black">{item.name}</div>
                      <div className="text-sm text-gray-600">
                        {item.category.macro} • {item.category.micro}
                      </div>
                    </div>
                    <div className="text-black font-bold">${item.amount.toFixed(2)}</div>
                  </div>

                  {/* Delete sits UNDER the amount */}
                  <div className="mt-2">
                    <button
                      className="text-red-600 hover:underline text-sm"
                      onClick={() => setToDelete(item)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={!!toDelete}
        title="Delete budget item?"
        message={
          <span>
            Delete <strong>{toDelete?.name}</strong> ({toDelete?.category.macro} • {toDelete?.category.micro})?
            <br />This cannot be undone.
          </span>
        }
        confirmText="Delete"
        cancelText="Cancel"
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          const item = toDelete;
          setToDelete(null);

          // optimistic remove
          setItems((prev) => prev.filter((x) => x.id !== item.id));
          try {
            const res = await fetch(`/api/budget-items/${item.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed');
          } catch {
            setItems((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
            alert('Delete failed');
          }
        }}
      />
    </div>
  )
}
