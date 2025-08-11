// src/app/settings/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { getCurrentMonth } from '@/utils/date' // You’ll define this below
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
    formState: { isSubmitting, isSubmitSuccessful },
  } = useForm<SettingsForm>()

  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [loading, setLoading] = useState(true)

  const month = getCurrentMonth()

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`/api/settings?month=${month}`)
        const data = await res.json()
        if (data) {
          reset({
            hourlyRate: data.hourlyRate ?? 0,
            hoursPP1: data.hoursPP1 ?? 0,
            hoursPP2: data.hoursPP2 ?? 0,
          })
        }
      } catch (err) {
        console.error('Error loading settings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [month, reset])

  const onSubmit = async (values: SettingsForm) => {
    setStatus('idle')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ ...values, month }),
        headers: { 'Content-Type': 'application/json' },
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
      <h1 className="text-2xl font-semibold mb-4">Monthly Settings</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block mb-1">Hourly Rate ($)</label>
            <input
              type="number"
              step="0.01"
              {...register('hourlyRate', { required: true })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block mb-1">Hours (1st–15th)</label>
            <input
              type="number"
              {...register('hoursPP1', { required: true })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block mb-1">Hours (16th–end)</label>
            <input
              type="number"
              {...register('hoursPP2', { required: true })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {isSubmitting ? 'Saving...' : 'Save Settings'}
          </button>

          {status === 'success' && (
            <p className="text-green-600">Settings saved!</p>
          )}
          {status === 'error' && (
            <p className="text-red-600">Failed to save settings.</p>
          )}
        </form>
      )}
    </div>
  )
}
