// src/app/dashboard/page.tsx
'use client'

import React, { useEffect, useState } from 'react'
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

export default function DashboardPage() {
  const month = getCurrentMonth()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [monthOffset, setMonthOffset] = useState(0)
  const [filter, setFilter] = useState('')

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

  // Bar: spend vs budget per micro
  const budgetByMicro = microCategories.map((µ) => {
    const item = budgetItems.find((b) => b.category.micro === µ)
    return item ? item.amount : 0
  })
  const spentByMicro = microCategories.map((µ) => microTotals[µ])
  const barData = {
    labels: [...microCategories],
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
    <div className="p-6 space-y-8">
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

      {/* Expense Distribution */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Expense Distribution</h2>
        <Doughnut data={donutData} />
      </section>

      {/* Spending Trends */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Spending Trends (6mo)</h2>
        <Line data={lineData} />
      </section>

      {/* Spending vs Budget */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Spending vs. Budget</h2>
        <Bar data={barData} />
      </section>

      {/* Transaction Table */}
      <section>
        <h2 className="text-xl font-semibold mb-4">All Transactions</h2>
        <input
          placeholder="Search descriptions..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded px-3 py-1 mb-4"
        />
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr>
              {['Date', 'Description', 'Category', 'Amount', 'Notes'].map((h) => (
                <th key={h} className="border text-black px-2 py-1 text-left bg-gray-100">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTx.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50 hover:text-black">
                <td className="border px-2 py-1">{tx.date.slice(0, 10)}</td>
                <td className="border px-2 py-1">{tx.description}</td>
                <td className="border px-2 py-1">{tx.category}</td>
                <td className="border px-2 py-1">${tx.amount.toFixed(2)}</td>
                <td className="border px-2 py-1"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
