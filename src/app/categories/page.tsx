// // src/app/categories/page.tsx
// 'use client'

// import React, { useEffect, useState } from 'react'
// import { useForm } from 'react-hook-form'
// import Navbar from '@/components/Navbar'
// import { macroCategories, microCategories, microToMacro } from '@/utils/categories'
// import type { MacroCategory, MicroCategory } from '@/utils/categories'
// import { getCurrentMonth } from '@/utils/date'
// import { Pie } from 'react-chartjs-2'
// import {
//   Chart as ChartJS,
//   ArcElement,
//   Tooltip,
//   Legend,
// } from 'chart.js'

// ChartJS.register(ArcElement, Tooltip, Legend)

// // BudgetItem type matches prisma schema response
// type BudgetItem = {
//   id: string
//   name: string
//   amount: number
//   category: {
//     id: string
//     macro: MacroCategory
//     micro: MicroCategory
//   }
// }

// // Form values for new budget item
// type FormValues = {
//   name: string
//   amount: string
//   macro: MacroCategory
//   micro: MicroCategory
// }

// // Monthly settings response shape
// type Settings = {
//   hourlyRate: number
//   hoursPP1: number
//   hoursPP2: number
// }

// export default function CategoriesPage() {
//   const month = getCurrentMonth()
//   const [items, setItems] = useState<BudgetItem[]>([])
//   const [settings, setSettings] = useState<Settings | null>(null)
//   const [loading, setLoading] = useState(true)

//   const {
//     register,
//     handleSubmit,
//     reset,
//     setValue,
//     watch,
//     formState: { errors },
//   } = useForm<FormValues>({
//     defaultValues: {
//       name: '',
//       amount: '',
//       macro: macroCategories[0],
//       micro: '' as MicroCategory,
//     },
//   })

//   // Fetch budget items and settings
//   useEffect(() => {
//     async function load() {
//       try {
//         const [itemsRes, settingsRes] = await Promise.all([
//           fetch('/api/budget-items'),
//           fetch(`/api/settings?month=${month}`),
//         ])
//         const [itemsData, settingsData] = await Promise.all([
//           itemsRes.json(),
//           settingsRes.json(),
//         ])
//         setItems(itemsData)
//         setSettings(settingsData)
//       } catch (err) {
//         console.error('Error loading data:', err)
//       } finally {
//         setLoading(false)
//       }
//     }
//     load()
//   }, [month])

//   // Submit new or updated budget item
//   const onSubmit = async (data: FormValues) => {
//     try {
//       const res = await fetch('/api/budget-items', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           name: data.name,
//           amount: parseFloat(data.amount),
//           macro: data.macro,
//           micro: data.micro,
//         }),
//       })
//       if (!res.ok) throw new Error('Failed to save')
//       reset()
//       // refresh items
//       const refreshed = await fetch('/api/budget-items')
//       setItems(await refreshed.json())
//     } catch (err) {
//       console.error('Submit error:', err)
//     }
//   }

//   // Group items by macro
//   const grouped = items.reduce((acc, item) => {
//     const m = item.category.macro
//     acc[m] = acc[m] || []
//     acc[m].push(item)
//     return acc
//   }, {} as Record<MacroCategory, BudgetItem[]>)

//   // Calculate monthly budget if settings loaded
//   const monthlyBudget = settings
//     ? (settings.hoursPP1 + settings.hoursPP2) * settings.hourlyRate * (1 - 0.51) - 99.38
//     : 0

//   // Helper to build pie data for each macro portion
//   const makePieData = (macro: MacroCategory, portion: number) => {
//     const itemsForMacro = grouped[macro] || []
//     const allocated = itemsForMacro.reduce((sum, i) => sum + i.amount, 0)
//     const ideal = monthlyBudget * portion
//     const available = Math.max(ideal - allocated, 0)

//     // Use string[] to allow 'Available'
//     const labels: string[] = itemsForMacro.map((i) => i.category.micro)
//     const data: number[] = itemsForMacro.map((i) => i.amount)

//     if (available > 0) {
//       labels.push('Available')
//       data.push(available)
//     }

//     return {
//       labels,
//       datasets: [
//         {
//           data,
//           backgroundColor: [
//             '#60A5FA',
//             '#FBBF24',
//             '#34D399',
//             '#F87171',
//             '#A78BFA',
//             '#D1D5DB', // grey for available
//           ],
//         },
//       ],
//     }
//   }

//   if (loading) {
//     return <p className="p-6">Loading...</p>
//   }

//   return (
//     <div>
//       <Navbar title="Categories" />

//       <div className="p-6 space-y-8">
//         {/* Form */}
//         <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
//           <div>
//             <label className="block mb-1">Item Name</label>
//             <input
//               {...register('name', { required: true })}
//               className="w-full border rounded px-3 py-2"
//             />
//             {errors.name && <p className="text-red-500">Required</p>}
//           </div>

//           <div>
//             <label className="block mb-1">Amount</label>
//             <input
//               type="number"
//               step="0.01"
//               {...register('amount', { required: true })}
//               className="w-full border rounded px-3 py-2"
//             />
//             {errors.amount && <p className="text-red-500">Required</p>}
//           </div>

//           {/* Macro buttons */}
//           <div>
//             <span className="block mb-1">Category Type</span>
//             <div className="flex space-x-2">
//               {macroCategories.map((m) => (
//                 <button
//                   key={m}
//                   type="button"
//                   onClick={() => setValue('macro', m)}
//                   className={`px-3 py-1 rounded ${
//                     watch('macro') === m
//                       ? 'bg-blue-600 text-black'
//                       : 'bg-gray-200 text-black'
//                   }`}
//                 >
//                   {m}
//                 </button>
//               ))}
//             </div>
//           </div>

//           {/* Micro dropdown */}
//           <div>
//             <label className="block mb-1">Sub-category</label>
//             <select
//               {...register('micro', { required: true })}
//               className="w-full border rounded px-3 py-2"
//             >
//               <option value="">– Choose a sub-category –</option>
//               {microCategories
//                 .filter((µ) => microToMacro[µ] === watch('macro'))
//                 .map((µ) => (
//                   <option key={µ} value={µ}>
//                     {µ}
//                   </option>
//                 ))}
//             </select>
//             {errors.micro && <p className="text-red-500">Required</p>}
//           </div>

//           <button
//             type="submit"
//             className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
//           >
//             Add Budget Item
//           </button>
//         </form>

//         {/* Grouped Items */}
//         <div>
//           <h2 className="text-xl font-bold mt-8 mb-4">
//             Budgeted Items
//           </h2>
//           {Object.entries(grouped).map(([macro, entries]) => (
//             <div key={macro} className="mb-6">
//               <h3 className="text-lg font-bold mb-2">{macro}</h3>
//               <ul className="space-y-2">
//                 {entries.map((item) => (
//                   <li
//                     key={item.id}
//                     className="border p-2 rounded bg-white flex justify-between items-center"
//                   >
//                     <div className="flex flex-col">
//                       <span className="font-medium text-black">{item.name}</span>
//                       <span className="text-sm text-gray-600">
//                         {item.category.micro}
//                       </span>
//                       <span className="text-black font-bold">
//                         ${item.amount.toFixed(2)}
//                       </span>
//                     </div>
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           ))}
//         </div>

//         {/* 50/30/20 Pie Charts */}
//         <div>
//           <h2 className="text-xl font-bold mt-8 mb-4">
//             50/30/20 Budget Allocation
//           </h2>
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//             <div className="bg-white p-4 border rounded shadow-sm">
//               <h3 className="font-bold text-black mb-1">Needs (50%)</h3>
//               <Pie data={makePieData('Needs', 0.5)} />
//             </div>
//             <div className="bg-white p-4 border rounded shadow-sm">
//               <h3 className="font-bold text-black mb-1">Wants (30%)</h3>
//               <Pie data={makePieData('Wants', 0.3)} />
//             </div>
//             <div className="bg-white p-4 border rounded shadow-sm">
//               <h3 className="font-bold text-black mb-1">Savings (20%)</h3>
//               <Pie data={makePieData('Savings', 0.2)} />
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }


// src/app/categories/page.tsx
'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { macroCategories } from '@/utils/categories'
import type { MacroCategory, MicroCategory } from '@/utils/categories'
import { getCurrentMonth } from '@/utils/date'
import { Pie } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

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

type Settings = {
  hourlyRate: number
  hoursPP1: number
  hoursPP2: number
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export default function CategoriesPage() {
  const month = getCurrentMonth()
  const [items, setItems] = useState<BudgetItem[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [itemsRes, settingsRes] = await Promise.all([
          fetch('/api/budget-items'),
          fetch(`/api/settings?month=${month}`),
        ])
        const [itemsData, settingsData] = await Promise.all([
          itemsRes.json(),
          settingsRes.json(),
        ])
        setItems(itemsData)
        setSettings(settingsData)
      } catch (err) {
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [month])

  // Group items by macro
  const grouped = items.reduce((acc, item) => {
    const m = item.category.macro
    acc[m] = acc[m] || []
    acc[m].push(item)
    return acc
  }, {} as Record<MacroCategory, BudgetItem[]>)

  // Monthly budget (same formula as before)
  const monthlyBudget = settings
    ? (settings.hoursPP1 + settings.hoursPP2) * settings.hourlyRate * (1 - 0.51) - 99.38
    : 0

  // Summed pie data: one slice per unique micro + Grey "Available"
  const makePieData = (macro: MacroCategory, portion: number) => {
    const itemsForMacro = grouped[macro] || []

    // aggregate by micro (sum duplicates)
    const microTotals = new Map<string, number>()
    for (const it of itemsForMacro) {
      const key = it.category.micro
      microTotals.set(key, (microTotals.get(key) ?? 0) + it.amount)
    }

    const labels: string[] = []
    const data: number[] = []
    microTotals.forEach((val, key) => {
      labels.push(key)
      data.push(val)
    })

    const allocated = data.reduce((a, b) => a + b, 0)
    const ideal = monthlyBudget * portion
    const available = Math.max(ideal - allocated, 0)
    if (available > 0.01) {
      labels.push('Available')
      data.push(available)
    }

    // color palette for real slices (keep grey for Available at the end)
    const palette = [
      '#60A5FA', // blue
      '#FBBF24', // amber
      '#34D399', // green
      '#F87171', // red
      '#A78BFA', // violet
      '#22D3EE', // cyan
      '#F59E0B', // orange
      '#10B981', // emerald
      '#EF4444', // rose
      '#6366F1', // indigo
      '#14B8A6', // teal
      '#F472B6', // pink
    ]

    const bg = labels.map((lbl, idx) =>
      lbl === 'Available' ? '#D1D5DB' : palette[idx % palette.length]
    )

    return {
      labels,
      datasets: [{ data, backgroundColor: bg }],
    }
  }

  if (loading) return <p className="p-6">Loading...</p>

  return (
    <div>
      <Navbar title="Categories" />

      <div className="p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Budgeted Items</h1>
          <Link
            href="/categories/add"
            className="rounded px-4 py-2 bg-black text-white hover:opacity-90"
          >
            Add / Edit Budget Items
          </Link>
        </div>

        {/* Grouped Items (read-only) */}
        <div>
          {macroCategories.map((macro) => {
            const entries = grouped[macro] ?? []
            if (!entries.length) return null
            return (
              <div key={macro} className="mb-6">
                <h3 className="text-lg font-bold mb-2">{macro}</h3>
                <ul className="space-y-2">
                  {entries.map((item) => (
                    <li
                      key={item.id}
                      className="border p-2 rounded bg-white flex justify-between items-center"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-black">{item.name}</span>
                        <span className="text-sm text-gray-600">{item.category.micro}</span>
                        <span className="text-black font-bold">${item.amount.toFixed(2)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* 50/30/20 Pie Charts */}
        <div>
          <h2 className="text-xl font-bold mt-8 mb-4">50/30/20 Budget Allocation</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-4 border rounded shadow-sm">
              <h3 className="font-bold text-black mb-1">Needs (50%) {currencyFormatter.format(monthlyBudget*0.5)}</h3>
              <Pie data={makePieData('Needs', 0.5)} />
            </div>
            <div className="bg-white p-4 border rounded shadow-sm">
              <h3 className="font-bold text-black mb-1">Wants (30%) {currencyFormatter.format(monthlyBudget*0.3)}</h3>
              <Pie data={makePieData('Wants', 0.3)} />
            </div>
            <div className="bg-white p-4 border rounded shadow-sm">
              <h3 className="font-bold text-black mb-1">Savings (20%) {currencyFormatter.format(monthlyBudget*0.2)}</h3>
              <Pie data={makePieData('Savings', 0.2)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
