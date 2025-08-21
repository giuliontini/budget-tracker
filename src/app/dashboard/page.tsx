// src/app/dashboard/page.tsx
'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Doughnut, Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
} from 'chart.js'
import Navbar from '@/components/Navbar'
import { microCategories } from '@/utils/categories'
import { getCurrentMonth } from '@/utils/date'

// Register ChartJS components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement
)

type Settings = {
  hourlyRate: number
  hoursPP1: number
  hoursPP2: number
}

type Transaction = {
  id: string
  description: string
  amount: number
  date: string
  category: string  // micro-category string
}

type BudgetItem = {
  id: string
  amount: number
  category: {
    macro: string
    micro: string
  }
}

// --- Chip filter persistence (replace your current hook with this)
const MICRO_FILTERS_KEY = "budgetTracker:microEnabled"
type MicroEnabled = Record<string, boolean>

function useMicroFilters(
  microCats: readonly string[],
  defaultOff: readonly string[] = []
) {
  // Compute initial state ONCE (no setState in effects)
  const [enabled, setEnabled] = useState<MicroEnabled>(() => {
    // base: all ON except defaultOff
    const base: MicroEnabled = {}
    for (const m of microCats) base[m] = !defaultOff.includes(m)

    if (typeof window === "undefined") return base

    const saved = localStorage.getItem(MICRO_FILTERS_KEY)
    if (!saved) return base

    try {
      const parsed = JSON.parse(saved) as MicroEnabled
      // merge saved on top of base
      for (const m of microCats) {
        base[m] = parsed[m] ?? base[m]
      }
    } catch {
      // ignore corrupted storage
    }
    return base
  })

  // Persist when enabled changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(MICRO_FILTERS_KEY, JSON.stringify(enabled))
    }
  }, [enabled])

  // If the list of categories changes, reconcile once (no infinite loops)
  useEffect(() => {
    setEnabled(prev => {
      // build next mapping with previous values when available
      const next: MicroEnabled = {}
      for (const m of microCats) {
        next[m] = prev[m] ?? !defaultOff.includes(m)
      }
      // avoid unnecessary state updates
      const sameKeys =
        Object.keys(prev).length === Object.keys(next).length &&
        Object.keys(next).every(k => prev[k] === next[k])
      return sameKeys ? prev : next
    })
  }, [microCats, defaultOff])

  const toggle = (m: string) => setEnabled(prev => ({ ...prev, [m]: !prev[m] }))
  const setAll = (value: boolean) =>
    setEnabled(Object.fromEntries(microCats.map(m => [m, value])) as MicroEnabled)

  const active = useMemo(
    () => microCats.filter(m => enabled[m]),
    [microCats, enabled]
  )

  return { enabled, toggle, setAll, active }
}

export default function DashboardPage() {
  const _month = getCurrentMonth()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [monthOffset, setMonthOffset] = useState(0)
  const [filter, setFilter] = useState('')
  const { enabled, toggle, setAll, active } = useMicroFilters(
    microCategories,
    ["Housing/Rent"]            // default-off
  )  

  // Compute viewedMonth based on offset
  const now = new Date()
  const viewedDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const viewedMonth = `${viewedDate.getFullYear()}-${String(
    viewedDate.getMonth() + 1
  ).padStart(2, '0')}`

  useEffect(() => {
    async function loadData() {
      try {
        const [settingsRes, txRes, budgetRes] = await Promise.all([
          fetch(`/api/settings?month=${viewedMonth}`),
          fetch('/api/transactions'),
          fetch('/api/budget-items'),
        ])
        const [settingsData, txData, budgetData] = await Promise.all([
          settingsRes.json(),
          txRes.json(),
          budgetRes.json(),
        ])
        setSettings(settingsData)
        setTransactions(txData)
        setBudgetItems(budgetData)
      } catch (err) {
        console.error('Error loading dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [viewedMonth])

  if (loading) {
    return <p className="p-6">Loading dashboard...</p>
  }

  if (!settings) {
    return <p className="p-6">No settings found for {viewedMonth}</p>
  }

  // Summary calculations
  const totalHours = settings.hoursPP1 + settings.hoursPP2
  const gross = totalHours * settings.hourlyRate
  const deductions = gross * 0.51 + 99.38
  const monthlyBudget = gross - deductions

  // Filter transactions for viewedMonth
  const txThisMonth = transactions.filter((tx) => {
    const d = new Date(tx.date)
    return (
      d.getFullYear() === viewedDate.getFullYear() &&
      d.getMonth() === viewedDate.getMonth()
    )
  })

  const totalSpent = txThisMonth.reduce((sum, tx) => sum + tx.amount, 0)
  const remaining = monthlyBudget - totalSpent

  // Donut: expense distribution per micro
  const microTotals = microCategories.reduce((acc, µ) => {
    acc[µ] = txThisMonth
      .filter((tx) => tx.category === µ)
      .reduce((s, t) => s + t.amount, 0)
    return acc
  }, {} as Record<string, number>)
  const donutData = {
    labels: [...microCategories],
    datasets: [{
      data: microCategories.map((µ) => microTotals[µ]),
      backgroundColor: [
        '#191e0c',
        '#343e19',
        '#4f5d26',
        '#6a7d33',
        '#849d40',
        '#9fbd4d',
        '#badd5a'
      ],
      hoverOffset: 4
    }],
  }

  // Line: spending trends last 6 months
  const lastSix = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }).reverse()
  const lineData = {
    labels: lastSix,
    datasets: [
      {
        label: 'Total Spend',
        data: lastSix.map((m) =>
          transactions
            .filter((tx) => tx.date.slice(0, 7) === m)
            .reduce((s, t) => s + t.amount, 0)
        ),
        borderColor: '#d5fd67',
      },
    ],
  }

  // Bar: spend vs budget per micro (with chip filters)
  const budgetByMicro = active.map((m) => {
    const item = budgetItems.find((b) => b.category.micro === m)
    return item ? item.amount : 0
  })

  const spentByMicro = active.map((m) => microTotals[m] ?? 0)

  const barData = {
    labels: active,
    datasets: [
      { label: 'Spent', data: spentByMicro, backgroundColor: 'red' },
      { label: 'Budget', data: budgetByMicro, backgroundColor: 'blue' },
    ],
  }


  // Filtered transactions for table
  const filteredTx = txThisMonth.filter((tx) =>
    tx.description.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-8 mx-auto w-full max-w-screen-xl">
      <Navbar title="Dashboard" />

      {/* Month Navigation */}
      <div className="flex justify-center items-center gap-4">
        <button onClick={() => setMonthOffset((o) => o - 1)} className="px-2 py-1 border rounded">
          ← Prev
        </button>
        <p className="font-semibold">
          {viewedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </p>
        <button onClick={() => setMonthOffset((o) => o + 1)} className="px-2 py-1 border rounded">
          Next →
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded text-black p-4 shadow-sm bg-white">
          <p className="text-sm text-gray-700 font-medium">Net Budget</p>
          <p className="text-lg font-bold">${monthlyBudget.toFixed(2)}</p>
        </div>
        <div className="border rounded text-black p-4 shadow-sm bg-white">
          <p className="text-sm text-gray-700 font-medium">Spent</p>
          <p className="text-lg font-bold">${totalSpent.toFixed(2)}</p>
        </div>
        <div className="border rounded text-black p-4 shadow-sm bg-white">
          <p className="text-sm text-gray-700 font-medium">Remaining</p>
          <p className="text-lg font-bold">${remaining.toFixed(2)}</p>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-4">Expense Distribution</h2>
        <div className="relative w-full h-[220px] sm:h-[260px] md:h-[320px] lg:h-[360px]">
          <Doughnut
            data={donutData}
            options={{
              responsive: true,
              maintainAspectRatio: false, // parent controls height
              plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12 } },
                tooltip: { intersect: false }
              },
              cutout: '60%', // you can bump to '70%' on lg+ if you like
            }}
          />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Spending Trends (6mo)</h2>
        <div className="relative w-full h-[240px] sm:h-[300px] md:h-[360px]">
          <Line
            data={lineData}
            options={{ responsive: true, maintainAspectRatio: false }}
          />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Spending vs. Budget</h2>
        {/* Chip filter toolbar */}
        <div className="mb-3 rounded-2xl border p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Showing <span className="font-medium text-gray-900 dark:text-gray-100">{active.length}</span> / {microCategories.length}
            </div>
            <div className="space-x-2">
              <button
                onClick={() => setAll(true)}
                className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                Select all
              </button>
              <button
                onClick={() => setAll(false)}
                className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {microCategories.map((m) => {
              const on = !!enabled[m]
              return (
                <button
                  key={m}
                  onClick={() => toggle(m)}
                  className={[
                    "rounded-full px-3 py-1.5 text-sm transition-all border",
                    on
                      ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-black dark:border-white"
                      : "bg-white text-gray-900 border-gray-300 hover:border-gray-500 dark:bg-zinc-900 dark:text-gray-100 dark:border-zinc-700 dark:hover:border-zinc-500",
                  ].join(" ")}
                  title={on ? "Click to hide" : "Click to show"}
                >
                  {m}
                </button>
              )
            })}
          </div>
        </div>
        <div className="relative w-full h-[240px] sm:h-[300px] md:h-[360px]">
          <Bar
            data={barData}
            options={{ responsive: true, maintainAspectRatio: false }}
          />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">All Transactions</h2>
        <input
          placeholder="Search descriptions..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded px-3 py-2 mb-4 w-full sm:w-80
                    bg-white text-gray-900 dark:bg-zinc-900 dark:text-gray-100"
        />

        <div
          className="rounded-2xl border shadow-sm overflow-x-auto
                    bg-white text-gray-900 border-zinc-200
                    dark:bg-zinc-900 dark:text-gray-100 dark:border-zinc-800"
        >
          <table className="min-w-[720px] w-full table-auto border-collapse text-sm">
            <thead>
              <tr>
                {['Date', 'Description', 'Category', 'Amount', 'Notes'].map((h) => (
                  <th
                    key={h}
                    className={[
                      'border px-3 py-2 text-left',
                      'bg-gray-100 text-gray-900 border-zinc-200',
                      'dark:bg-zinc-800 dark:text-gray-100 dark:border-zinc-800',
                      h === 'Notes' ? 'hidden sm:table-cell' : '',
                    ].join(' ')}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTx.map((tx) => (
                <tr key={tx.id} className="hover:bg-white-50 hover:text-black-900 dark:hover:bg-zinc-800">
                  <td className="border px-3 py-2 whitespace-nowrap border-zinc-200 dark:border-zinc-800">
                    {tx.date.slice(0, 10)}
                  </td>
                  <td className="border px-3 py-2 border-zinc-200 dark:border-zinc-800">{tx.description}</td>
                  <td className="border px-3 py-2 border-zinc-200 dark:border-zinc-800">{tx.category}</td>
                  <td className="border px-3 py-2 border-zinc-200 dark:border-zinc-800">${tx.amount.toFixed(2)}</td>
                  <td className="border px-3 py-2 hidden sm:table-cell border-zinc-200 dark:border-zinc-800"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
