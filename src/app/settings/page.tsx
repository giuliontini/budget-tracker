'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { getCurrentMonth } from '@/utils/date'
import Navbar from '@/components/Navbar'

type SettingsForm = {
  hourlyRate: number
  hoursPP1: number
  hoursPP2: number
}

export default function SettingsPage() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<SettingsForm>()

  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [loading, setLoading] = useState(true)

  // NEW: which month are we editing?
  const [editMonth, setEditMonth] = useState<string>(() => {
    // Persist the picker so you return to what you were editing
    if (typeof window === 'undefined') return getCurrentMonth()
    return localStorage.getItem('budgetTracker:settingsMonth') ?? getCurrentMonth()
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('budgetTracker:settingsMonth', editMonth)
    }
  }, [editMonth])

  // Load settings for the selected month (or clear if none exist)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setStatus('idle')

    ;(async () => {
      try {
        const res = await fetch(`/api/settings?month=${editMonth}`)
        if (!res.ok) {
          // If API returns 404 or not found, treat as empty
          reset({ hourlyRate: 0, hoursPP1: 0, hoursPP2: 0 })
          return
        }
        const data = await res.json()
        if (cancelled) return

        if (data) {
          reset({
            hourlyRate: data.hourlyRate ?? 0,
            hoursPP1: data.hoursPP1 ?? 0,
            hoursPP2: data.hoursPP2 ?? 0,
          })
        } else {
          // No settings yet for this month
          reset({ hourlyRate: 0, hoursPP1: 0, hoursPP2: 0 })
        }
      } catch (err) {
        console.error('Error loading settings:', err)
        reset({ hourlyRate: 0, hoursPP1: 0, hoursPP2: 0 })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [editMonth, reset])

  // Save to the selected month
  const onSubmit = async (values: SettingsForm) => {
    setStatus('idle')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          month: editMonth, // <-- IMPORTANT: save to chosen month
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setStatus('success')
    } catch (err) {
      console.error('Submit error:', err)
      setStatus('error')
    }
  }

  return (
    <div className="p-6 space-y-8">
      <Navbar title="Settings" />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Monthly Settings</h1>

        {/* NEW: Month picker */}
        <div className="flex items-center gap-2">
          <label className="text-sm">Editing month</label>
          <input
            type="month"
            className="border rounded px-2 py-1"
            value={editMonth}
            onChange={(e) => setEditMonth(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block mb-1">Hourly Rate ($)</label>
            <input
              type="number"
              step="0.01"
              // valueAsNumber makes sure the value is a number, not a string
              {...register('hourlyRate', { required: true, valueAsNumber: true })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block mb-1">Hours (1st–15th)</label>
            <input
              type="number"
              {...register('hoursPP1', { required: true, valueAsNumber: true })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block mb-1">Hours (16th–end)</label>
            <input
              type="number"
              {...register('hoursPP2', { required: true, valueAsNumber: true })}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : 'Save Settings'}
          </button>

          {/* Save feedback */}
          {status === 'success' && (
            <p className="text-green-600">Settings saved for {editMonth}.</p>
          )}
          {status === 'error' && (
            <p className="text-red-600">Failed to save settings.</p>
          )}

          {/* Optional helper note */}
          <p className="text-xs text-gray-500">
            These values are stored per-month. Switch the month above to review or
            define settings for a different month.
          </p>
        </form>
      )}
    </div>
  )
}
