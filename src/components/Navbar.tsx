// // src/components/Navbar.tsx
// import { useState } from 'react'
// import Link from 'next/link'

// export default function Navbar({ title }: { title: string }) {
//   const [isOpen, setIsOpen] = useState(false)

//   return (
//     <nav className="flex justify-between items-center border-b pb-2 mb-4 px-6 relative">
//       {/* Site title */}
//       <h1 className="text-2xl font-bold">{title}</h1>

//       {/* Toggle button */}
//       <button
//         className="p-2 rounded hover:bg-gray-100 hover:text-black"
//         onClick={() => setIsOpen(!isOpen)}
//         aria-label="Toggle menu"
//       >
//         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//           <path
//             strokeWidth="2"
//             strokeLinecap="round"
//             strokeLinejoin="round"
//             d="M4 6h16M4 12h16M4 18h16"
//           />
//         </svg>
//       </button>

//       {/* Collapsible links */}
//       <div
//         className={`${isOpen ? 'block' : 'hidden'} flex flex-col items-start absolute top-full left-0 w-full bg-white border-t px-6 py-4 transition-all duration-200`}
//       >
//         <Link href="/dashboard" className="block text-black py-2">
//           Dashboard
//         </Link>
//         <Link href="/categories" className="block text-black py-2">
//           Categories
//         </Link>
//         <Link href="/settings" className="block text-black py-2">
//           Settings
//         </Link>
//         <Link href="/transactions/pending" className="block text-black py-2">
//           Pending
//         </Link>
//       </div>
//     </nav>
//   )
// }


'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/utils/supabase/supabaseBrowser'


export default function Navbar({ title }: { title: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleSignOut = async () => {
    setIsOpen(false)
    await supabaseBrowser.auth.signOut()
    router.push('/login') // or '/'
  }

  return (
    <nav className="flex justify-between items-center border-b pb-2 mb-4 px-6 relative">
      <h1 className="text-2xl font-bold">{title}</h1>

      <button
        className="p-2 rounded hover:bg-gray-100 hover:text-black"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>

      <div className={`${isOpen ? 'block' : 'hidden'} flex flex-col items-start absolute top-full left-0 w-full bg-white border-t px-6 py-4 transition-all duration-200`}>
        <Link href="/dashboard" className="block text-black py-2">Dashboard</Link>
        <Link href="/categories" className="block text-black py-2">Categories</Link>
        <Link href="/settings" className="block text-black py-2">Settings</Link>
        <Link href="/transactions/pending" className="block text-black py-2">Pending</Link>

        <button
          onClick={handleSignOut}
          className="mt-2 inline-flex items-center rounded-md bg-black text-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-black hover:text-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
